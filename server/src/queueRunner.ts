import type { Response } from "express";
import type { QueueItem, AppSettings, QueueRunnerStatus, QueueStatusInfo, QueueEvent } from "@sd-prompt/shared";
import type { FileStore } from "./fileStore.js";
import { ForgeApi } from "./forgeApi.js";

interface QueueData {
  queue: QueueItem[];
}

export class QueueRunner {
  private status: QueueRunnerStatus = "idle";
  private currentTaskId: string | null = null;
  private sseClients: Set<Response> = new Set();
  private forgeApi: ForgeApi;
  private progressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private queueStore: FileStore<QueueData>,
    private settingsStore: FileStore<AppSettings>
  ) {
    const settings = settingsStore.get();
    this.forgeApi = new ForgeApi(settings.forge_api_url);
  }

  /** Get current runner status info */
  getStatusInfo(): QueueStatusInfo {
    const data = this.queueStore.get();
    return {
      runner: this.status,
      current_task_id: this.currentTaskId,
      pending_count: data.queue.filter((q) => q.status === "pending").length,
      done_count: data.queue.filter((q) => q.status === "done").length,
      failed_count: data.queue.filter((q) => q.status === "failed").length,
    };
  }

  /** Register an SSE client */
  addClient(res: Response) {
    this.sseClients.add(res);
    res.on("close", () => this.sseClients.delete(res));
    // Send current status immediately
    this.sendEvent({ type: "status", data: this.getStatusInfo() });
  }

  /** Send event to all SSE clients */
  private sendEvent(event: QueueEvent) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      client.write(payload);
    }
  }

  /** Start processing the queue */
  async start() {
    if (this.status === "running") return;
    this.status = "running";
    this.sendEvent({ type: "status", data: this.getStatusInfo() });
    await this.processNext();
  }

  /** Pause the queue (current task finishes before stopping) */
  pause() {
    if (this.status !== "running") return;
    this.status = "paused";
    // Don't stop progress polling - let current task finish naturally
    this.sendEvent({ type: "status", data: this.getStatusInfo() });
  }

  /** Resume processing */
  async resume() {
    if (this.status !== "paused") return;
    this.status = "running";
    this.sendEvent({ type: "status", data: this.getStatusInfo() });
    // If no task is currently running, start the next one
    if (!this.currentTaskId) {
      await this.processNext();
    }
  }

  /** Run a specific task immediately (single task only, does not continue queue) */
  async runTask(taskId: string) {
    const data = this.queueStore.get();
    const item = data.queue.find((q) => q.id === taskId);
    if (!item || item.status !== "pending") return;

    const prevStatus = this.status;
    this.status = "running";
    this.sendEvent({ type: "status", data: this.getStatusInfo() });

    await this.executeTask(item, true); // singleRun = true

    // Restore previous status instead of continuing queue
    if (this.status === "running") {
      this.status = prevStatus === "running" ? "running" : "idle";
      this.sendEvent({ type: "status", data: this.getStatusInfo() });

      // If queue was already running before, continue processing
      if (prevStatus === "running") {
        await this.processNext();
      }
    }
  }

  /** Requeue a failed/done task */
  async requeueTask(taskId: string) {
    const data = this.queueStore.get();
    const item = data.queue.find((q) => q.id === taskId);
    if (!item) return;

    item.status = "pending";
    item.result_images = [];
    item.error_message = null;
    item.updated_at = new Date().toISOString();
    await this.queueStore.save(data);
    this.sendEvent({ type: "status", data: this.getStatusInfo() });
  }

  /** Process the next pending item */
  private async processNext() {
    if (this.status !== "running") return;

    const data = this.queueStore.get();
    const next = data.queue.find((q) => q.status === "pending");

    if (!next) {
      // No more pending tasks
      this.status = "idle";
      this.currentTaskId = null;
      this.sendEvent({ type: "status", data: this.getStatusInfo() });
      return;
    }

    await this.executeTask(next, false);
  }

  /** Start polling Forge for progress */
  private startProgressPolling(taskId: string) {
    this.stopProgressPolling();
    this.progressInterval = setInterval(async () => {
      try {
        const progress = await this.forgeApi.getProgress();
        if (progress.state.sampling_steps > 0) {
          this.sendEvent({
            type: "progress",
            data: {
              id: taskId,
              step: progress.state.sampling_step,
              total: progress.state.sampling_steps,
              preview: progress.current_image || undefined,
            },
          });
        }
      } catch {
        // Ignore progress polling errors
      }
    }, 1000);
  }

  /** Stop progress polling */
  private stopProgressPolling() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /** Execute a single task. singleRun=true skips processNext after completion. */
  private async executeTask(item: QueueItem, singleRun = false) {
    const data = this.queueStore.get();
    this.currentTaskId = item.id;

    // Update status to running
    item.status = "running";
    item.updated_at = new Date().toISOString();
    await this.queueStore.save(data);
    this.sendEvent({ type: "task_start", data: { id: item.id } });
    this.sendEvent({ type: "status", data: this.getStatusInfo() });

    try {
      // Refresh settings in case they changed
      const settings = this.settingsStore.get();
      this.forgeApi = new ForgeApi(settings.forge_api_url);

      // Check Forge connection
      const connected = await this.forgeApi.checkConnection();
      if (!connected) {
        throw new Error("Forge に接続できません。Forge WebUI が起動しているか確認してください。");
      }

      // Read source image + get dimensions
      if (!item.source_image_path) {
        throw new Error("ソース画像パスが指定されていません。");
      }
      const sourceImage = await this.forgeApi.readImage(item.source_image_path);

      // Build request (use source image dimensions)
      const request = this.forgeApi.buildRequest({
        sourceImageBase64: sourceImage.base64,
        sourceWidth: sourceImage.width,
        sourceHeight: sourceImage.height,
        prompt: item.final_prompt,
        negativePrompt: settings.negative_prompt,
        settings: item.settings,
        checkpointModel: settings.checkpoint_model || undefined,
      });

      // Start progress polling
      this.startProgressPolling(item.id);

      // Execute img2img
      const result = await this.forgeApi.img2img(request);

      // Stop progress polling
      this.stopProgressPolling();

      // Save result images
      const outputFolder = settings.output_folder || "./outputs";
      const savedPaths: string[] = [];
      for (let i = 0; i < result.images.length; i++) {
        const filename = this.forgeApi.makeOutputFilename(
          item.source_image_path,
          `${item.id}_${i}`
        );
        const savedPath = await this.forgeApi.saveImage(
          result.images[i],
          outputFolder,
          filename
        );
        savedPaths.push(savedPath);
      }

      // Update item as done
      item.status = "done";
      item.result_images = savedPaths;
      item.error_message = null;
      item.updated_at = new Date().toISOString();
      await this.queueStore.save(data);

      this.sendEvent({
        type: "task_done",
        data: { id: item.id, result_images: savedPaths },
      });
    } catch (err) {
      this.stopProgressPolling();
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Update item as failed
      item.status = "failed";
      item.error_message = errorMsg;
      item.updated_at = new Date().toISOString();
      await this.queueStore.save(data);

      this.sendEvent({
        type: "task_failed",
        data: { id: item.id, error: errorMsg },
      });

      console.error(`[QueueRunner] Task ${item.id} failed:`, errorMsg);
    }

    this.currentTaskId = null;
    this.sendEvent({ type: "status", data: this.getStatusInfo() });

    // Process next task if still running (skip for single-run tasks)
    if (!singleRun && this.status === "running") {
      await this.processNext();
    }
  }
}
