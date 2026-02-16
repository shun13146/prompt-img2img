import { Router } from "express";
import { readdir, stat } from "fs/promises";
import { resolve, extname, basename, isAbsolute, normalize } from "path";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);

/** Validate that a path is absolute and doesn't contain traversal sequences */
function isValidPath(p: string): boolean {
  if (!p || !isAbsolute(p)) return false;
  const normalized = normalize(p);
  // Reject if path contains traversal after normalization
  if (normalized.includes("..")) return false;
  return true;
}

export function createImageRoutes() {
  const router = Router();

  // GET /api/images/list?folder=...
  // Returns sorted list of image file paths in the given folder
  router.get("/list", async (req, res) => {
    const folder = req.query.folder as string;
    if (!folder) {
      res.status(400).json({ error: "folder query parameter required" });
      return;
    }

    if (!isValidPath(folder)) {
      res.status(400).json({ error: "Invalid folder path" });
      return;
    }

    try {
      const resolvedFolder = normalize(folder);
      const entries = await readdir(resolvedFolder);
      const images: { name: string; path: string }[] = [];

      for (const entry of entries) {
        const ext = extname(entry).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) continue;
        // Ensure entry doesn't escape the folder
        const fullPath = resolve(resolvedFolder, basename(entry));
        const s = await stat(fullPath);
        if (s.isFile()) {
          images.push({ name: entry, path: fullPath });
        }
      }

      // Sort by name
      images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      res.json(images);
    } catch (err: any) {
      res.status(400).json({ error: `Cannot read folder: ${err.message}` });
    }
  });

  // GET /api/images/file?path=...
  // Serves an image file from the local filesystem
  router.get("/file", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter required" });
      return;
    }

    if (!isValidPath(filePath)) {
      res.status(400).json({ error: "Invalid file path" });
      return;
    }

    const normalized = normalize(filePath);
    const ext = extname(normalized).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) {
      res.status(400).json({ error: "Not an image file" });
      return;
    }

    res.sendFile(normalized, (err) => {
      if (err) {
        res.status(404).json({ error: "File not found" });
      }
    });
  });

  return router;
}
