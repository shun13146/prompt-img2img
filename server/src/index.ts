import express from "express";
import cors from "cors";
import { resolve } from "path";
import { FileStore } from "./fileStore.js";
import { QueueRunner } from "./queueRunner.js";
import { createCharacterRoutes } from "./routes/characters.js";
import { createTagRoutes } from "./routes/tags.js";
import { createQueueRoutes } from "./routes/queue.js";
import { createSettingsRoutes } from "./routes/settings.js";
import { createImageRoutes } from "./routes/images.js";
import { createForgeRoutes } from "./routes/forge.js";
import type { Character, TagDatabase, QueueItem, AppSettings } from "@sd-prompt/shared";

const PORT = 3001;
const DATA_DIR = resolve(import.meta.dirname, "../../data");

interface CharactersData {
  characters: Character[];
}

interface QueueData {
  queue: QueueItem[];
}

async function main() {
  // Initialize file stores
  const characterStore = new FileStore<CharactersData>(
    resolve(DATA_DIR, "characters.json"),
    { characters: [] }
  );
  const tagStore = new FileStore<TagDatabase>(
    resolve(DATA_DIR, "tags.json"),
    { categories: [] }
  );
  const queueStore = new FileStore<QueueData>(
    resolve(DATA_DIR, "queue.json"),
    { queue: [] }
  );
  const settingsStore = new FileStore<AppSettings>(
    resolve(DATA_DIR, "settings.json"),
    {
      forge_api_url: "http://localhost:7860",
      negative_prompt: "",
      checkpoint_model: "",
      output_folder: "",
      default_settings: {
        steps: 28,
        sampler: "DPM++ 2M Karras",
        cfg_scale: 7,
        width: 512,
        height: 768,
        denoising_strength: 0.55,
        n_iter: 7,
      },
      mode_a_carry_over: true,
    }
  );

  // Load all stores
  await Promise.all([
    characterStore.load(),
    tagStore.load(),
    queueStore.load(),
    settingsStore.load(),
  ]);

  console.log("Data loaded from", DATA_DIR);

  // Migrate old queue items to new schema
  const queueData = queueStore.get();
  let migrated = false;
  for (const item of queueData.queue) {
    // Migrate old status values
    if ((item.status as string) === "processing") { item.status = "running"; migrated = true; }
    if ((item.status as string) === "completed") { item.status = "done"; migrated = true; }
    if ((item.status as string) === "error") { item.status = "failed"; migrated = true; }
    // Migrate result_image_path → result_images
    const old = item as any;
    if (!Array.isArray(item.result_images)) {
      item.result_images = old.result_image_path ? [old.result_image_path] : [];
      delete old.result_image_path;
      migrated = true;
    }
    if (item.error_message === undefined) { item.error_message = null; migrated = true; }
    if (!item.updated_at) { item.updated_at = item.created_at; migrated = true; }
    if (!item.settings.n_iter) { item.settings.n_iter = 7; migrated = true; }
  }
  if (migrated) {
    await queueStore.save(queueData);
    console.log("Queue data migrated to new schema");
  }

  // Create queue runner
  const queueRunner = new QueueRunner(queueStore, settingsStore);

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Routes
  app.use("/api/characters", createCharacterRoutes(characterStore));
  app.use("/api/tags", createTagRoutes(tagStore));
  app.use("/api/queue", createQueueRoutes(queueStore, queueRunner));
  app.use("/api/settings", createSettingsRoutes(settingsStore));
  app.use("/api/images", createImageRoutes());
  app.use("/api/forge", createForgeRoutes(settingsStore));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(PORT, () => {
    console.log(`SD Prompt Builder API running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
