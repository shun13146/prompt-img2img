import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

export class FileStore<T> {
  private data: T | null = null;

  constructor(
    private filePath: string,
    private defaultData: T
  ) {}

  async load(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      this.data = JSON.parse(raw) as T;
    } catch {
      this.data = structuredClone(this.defaultData);
      await this.save(this.data);
    }
    return this.data;
  }

  async save(data: T): Promise<void> {
    this.data = data;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  get(): T {
    if (this.data === null) {
      throw new Error(`FileStore not loaded: ${this.filePath}`);
    }
    return this.data;
  }
}
