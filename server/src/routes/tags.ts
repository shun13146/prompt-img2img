import { Router } from "express";
import type { FileStore } from "../fileStore.js";
import type { TagDatabase } from "@sd-prompt/shared";

export function createTagRoutes(store: FileStore<TagDatabase>) {
  const router = Router();

  // GET /api/tags
  router.get("/", (_req, res) => {
    res.json(store.get());
  });

  // GET /api/tags/search?q=...&limit=20
  router.get("/search", (req, res) => {
    const query = (req.query.q as string || "").toLowerCase();
    const limit = parseInt(req.query.limit as string) || 20;
    const data = store.get();

    if (!query) {
      res.json([]);
      return;
    }

    const results: Array<{
      id: string;
      label: string;
      prompt: string;
      category_id: string;
      category_label: string;
    }> = [];

    for (const category of data.categories) {
      if (category.subcategories) {
        for (const sub of category.subcategories) {
          for (const tag of sub.tags) {
            if (
              tag.prompt.toLowerCase().includes(query) ||
              tag.label.toLowerCase().includes(query) ||
              tag.id.toLowerCase().includes(query)
            ) {
              results.push({
                id: tag.id,
                label: tag.label,
                prompt: tag.prompt,
                category_id: category.id,
                category_label: category.label,
              });
            }
          }
        }
      }
      if (category.options) {
        for (const opt of category.options) {
          if (
            opt.prompt.toLowerCase().includes(query) ||
            opt.label.toLowerCase().includes(query) ||
            opt.id.toLowerCase().includes(query)
          ) {
            results.push({
              id: opt.id,
              label: opt.label,
              prompt: opt.prompt,
              category_id: category.id,
              category_label: category.label,
            });
          }
        }
      }
    }

    res.json(results.slice(0, limit));
  });

  // PUT /api/tags/favorite
  router.put("/favorite", async (req, res) => {
    const { category_id, tag_id, favorite } = req.body;
    const data = store.get();

    const category = data.categories.find((c) => c.id === category_id);
    if (!category?.subcategories) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    for (const sub of category.subcategories) {
      const tag = sub.tags.find((t) => t.id === tag_id);
      if (tag) {
        tag.favorite = favorite;
        await store.save(data);
        res.json({ ok: true });
        return;
      }
    }

    res.status(404).json({ error: "Tag not found" });
  });

  // PUT /api/tags - Save entire tag database
  router.put("/", async (req, res) => {
    await store.save(req.body);
    res.json({ ok: true });
  });

  return router;
}
