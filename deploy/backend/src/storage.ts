import { promises as fs } from "fs";
import path from "path";

/**
 * Storage abstraction. The filesystem implementation below is what runs
 * now; an S3-compatible implementation can replace it later by satisfying
 * this same interface, with no change to the routes that depend on it.
 * Keys are opaque strings (e.g. "<requestId>/<documentId>").
 */
export interface StorageBackend {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class FilesystemStorage implements StorageBackend {
  constructor(private rootDir: string) {}

  private resolve(key: string): string {
    // Guard against keys escaping the root via traversal.
    const full = path.resolve(this.rootDir, key);
    if (!full.startsWith(path.resolve(this.rootDir))) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

// Single shared instance, root configurable via env.
export const storage: StorageBackend = new FilesystemStorage(
  process.env.STORAGE_DIR ?? "/tmp/workflow-copilot-storage"
);
