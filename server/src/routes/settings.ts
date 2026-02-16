import { Router } from "express";
import type { FileStore } from "../fileStore.js";
import type { AppSettings } from "@sd-prompt/shared";

export function createSettingsRoutes(store: FileStore<AppSettings>) {
  const router = Router();

  // GET /api/settings
  router.get("/", (_req, res) => {
    res.json(store.get());
  });

  // PUT /api/settings
  router.put("/", async (req, res) => {
    const current = store.get();
    const updated = { ...current, ...req.body };
    await store.save(updated);
    res.json(updated);
  });

  return router;
}
