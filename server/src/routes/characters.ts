import { Router } from "express";
import type { FileStore } from "../fileStore.js";
import type { Character } from "@sd-prompt/shared";

interface CharactersData {
  characters: Character[];
}

export function createCharacterRoutes(store: FileStore<CharactersData>) {
  const router = Router();

  // GET /api/characters
  router.get("/", (_req, res) => {
    const data = store.get();
    res.json(data.characters);
  });

  // GET /api/characters/:id
  router.get("/:id", (req, res) => {
    const data = store.get();
    const char = data.characters.find((c) => c.id === req.params.id);
    if (!char) {
      res.status(404).json({ error: "Character not found" });
      return;
    }
    res.json(char);
  });

  // POST /api/characters
  router.post("/", async (req, res) => {
    const data = store.get();
    const newChar: Character = req.body;
    data.characters.push(newChar);
    await store.save(data);
    res.status(201).json(newChar);
  });

  // PUT /api/characters/:id
  router.put("/:id", async (req, res) => {
    const data = store.get();
    const idx = data.characters.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Character not found" });
      return;
    }
    data.characters[idx] = req.body;
    await store.save(data);
    res.json(data.characters[idx]);
  });

  // DELETE /api/characters/:id
  router.delete("/:id", async (req, res) => {
    const data = store.get();
    const idx = data.characters.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Character not found" });
      return;
    }
    data.characters.splice(idx, 1);
    await store.save(data);
    res.status(204).send();
  });

  return router;
}
