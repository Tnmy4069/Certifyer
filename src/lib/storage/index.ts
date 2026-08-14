import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getEnv } from "@/lib/env";

export interface StoredObject {
  key: string;
  absolutePath: string;
  size: number;
  mimeType: string;
}

export interface StorageAdapter {
  put(key: string, data: Buffer, mimeType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getAbsolutePath(key: string): string;
  createSignedUrl(key: string, expiresInSeconds?: number): string;
  verifySignedUrl(key: string, expires: string, signature: string): boolean;
}

function ensureSafeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

export class LocalStorageAdapter implements StorageAdapter {
  private root: string;
  private secret: string;

  constructor(root?: string, secret?: string) {
    const env = getEnv();
    this.root = path.resolve(root || env.STORAGE_ROOT);
    this.secret = secret || env.AUTH_SECRET;
  }

  getAbsolutePath(key: string): string {
    const safe = ensureSafeKey(key);
    return path.join(this.root, safe);
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const absolutePath = this.getAbsolutePath(key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, data);
    const stat = await fs.stat(absolutePath);
    return { key: ensureSafeKey(key), absolutePath, size: stat.size, mimeType };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.getAbsolutePath(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.getAbsolutePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.getAbsolutePath(key));
    } catch {
      // ignore missing files
    }
  }

  createSignedUrl(key: string, expiresInSeconds = 3600): string {
    const safe = ensureSafeKey(key);
    const expires = String(Math.floor(Date.now() / 1000) + expiresInSeconds);
    const signature = createHmac("sha256", this.secret).update(`${safe}:${expires}`).digest("hex");
    const params = new URLSearchParams({ key: safe, expires, signature });
    return `/api/files/signed?${params.toString()}`;
  }

  verifySignedUrl(key: string, expires: string, signature: string): boolean {
    const safe = ensureSafeKey(key);
    const exp = Number(expires);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    const expected = createHmac("sha256", this.secret).update(`${safe}:${expires}`).digest("hex");
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}

let storageSingleton: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!storageSingleton) {
    storageSingleton = new LocalStorageAdapter();
  }
  return storageSingleton;
}

export function randomStorageId(bytes = 12): string {
  return randomBytes(bytes).toString("hex");
}
