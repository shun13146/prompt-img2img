import { Router } from "express";
import { ForgeApi } from "../forgeApi.js";
import type { FileStore } from "../fileStore.js";
import type { AppSettings } from "@sd-prompt/shared";

export function createForgeRoutes(settingsStore: FileStore<AppSettings>) {
  const router = Router();

  function getApi() {
    return new ForgeApi(settingsStore.get().forge_api_url);
  }

  // GET /api/forge/status - check connection
  router.get("/status", async (_req, res) => {
    const api = getApi();
    const connected = await api.checkConnection();
    res.json({ connected, url: settingsStore.get().forge_api_url });
  });

  // GET /api/forge/models - list checkpoints
  router.get("/models", async (_req, res) => {
    try {
      const api = getApi();
      const models = await api.getModels();
      res.json(models);
    } catch (err) {
      res.status(502).json({
        error: "Forge に接続できません",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/forge/samplers - list samplers
  router.get("/samplers", async (_req, res) => {
    try {
      const api = getApi();
      const samplers = await api.getSamplers();
      res.json(samplers);
    } catch (err) {
      res.status(502).json({
        error: "Forge に接続できません",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
