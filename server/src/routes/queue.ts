import { Router } from "express";
import type { FileStore } from "../fileStore.js";
import type { QueueItem } from "@sd-prompt/shared";
import type { QueueRunner } from "../queueRunner.js";

interface QueueData {
  queue: QueueItem[];
}

export function createQueueRoutes(
  store: FileStore<QueueData>,
  runner: QueueRunner
) {
  const router = Router();

  // ===== Queue Runner Controls (before /:id routes) =====

  // GET /api/queue/status - runner status
  router.get("/status", (_req, res) => {
    res.json(runner.getStatusInfo());
  });

  // GET /api/queue/events - SSE endpoint
  router.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    runner.addClient(res);

    req.on("close", () => {
      // Client disconnected - cleanup handled in addClient
    });
  });

  // POST /api/queue/run - start processing
  router.post("/run", async (_req, res) => {
    await runner.start();
    res.json(runner.getStatusInfo());
  });

  // POST /api/queue/pause - pause processing
  router.post("/pause", (_req, res) => {
    runner.pause();
    res.json(runner.getStatusInfo());
  });

  // POST /api/queue/resume - resume processing
  router.post("/resume", async (_req, res) => {
    await runner.resume();
    res.json(runner.getStatusInfo());
  });

  // ===== Standard CRUD =====

  // GET /api/queue
  router.get("/", (_req, res) => {
    res.json(store.get().queue);
  });

  // POST /api/queue
  router.post("/", async (req, res) => {
    const data = store.get();
    const now = new Date().toISOString();
    const item: QueueItem = {
      ...req.body,
      id:
        req.body.id ||
        `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: "pending",
      result_images: [],
      error_message: null,
      created_at: now,
      updated_at: now,
    };
    data.queue.push(item);
    await store.save(data);
    res.status(201).json(item);
  });

  // PUT /api/queue/:id
  router.put("/:id", async (req, res) => {
    const data = store.get();
    const idx = data.queue.findIndex((q) => q.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Queue item not found" });
      return;
    }
    data.queue[idx] = {
      ...data.queue[idx],
      ...req.body,
      updated_at: new Date().toISOString(),
    };
    await store.save(data);
    res.json(data.queue[idx]);
  });

  // DELETE /api/queue/:id
  router.delete("/:id", async (req, res) => {
    const data = store.get();
    const idx = data.queue.findIndex((q) => q.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Queue item not found" });
      return;
    }
    data.queue.splice(idx, 1);
    await store.save(data);
    res.status(204).send();
  });

  // DELETE /api/queue (clear by status: ?status=pending or ?status=history)
  router.delete("/", async (req, res) => {
    const data = store.get();
    const status = req.query.status as string;
    if (status === "history") {
      data.queue = data.queue.filter((q) => q.status !== "done" && q.status !== "failed");
    } else {
      // Default: clear pending
      data.queue = data.queue.filter((q) => q.status !== "pending");
    }
    await store.save(data);
    res.status(204).send();
  });

  // ===== Per-item actions =====

  // POST /api/queue/:id/run - run specific task
  router.post("/:id/run", async (req, res) => {
    await runner.runTask(req.params.id);
    res.json(runner.getStatusInfo());
  });

  // POST /api/queue/:id/requeue - requeue failed/done task
  router.post("/:id/requeue", async (req, res) => {
    await runner.requeueTask(req.params.id);
    res.json({ ok: true });
  });

  // POST /api/queue/:id/move - move pending item up/down
  router.post("/:id/move", async (req, res) => {
    const { direction } = req.body as { direction: "up" | "down" };
    const data = store.get();
    const idx = data.queue.findIndex((q) => q.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Queue item not found" });
      return;
    }
    if (data.queue[idx].status !== "pending") {
      res.status(400).json({ error: "Can only move pending items" });
      return;
    }

    // Find next/prev pending item to swap with
    if (direction === "up") {
      for (let i = idx - 1; i >= 0; i--) {
        if (data.queue[i].status === "pending") {
          [data.queue[idx], data.queue[i]] = [data.queue[i], data.queue[idx]];
          break;
        }
      }
    } else {
      for (let i = idx + 1; i < data.queue.length; i++) {
        if (data.queue[i].status === "pending") {
          [data.queue[idx], data.queue[i]] = [data.queue[i], data.queue[idx]];
          break;
        }
      }
    }

    await store.save(data);
    res.json(data.queue);
  });

  return router;
}
