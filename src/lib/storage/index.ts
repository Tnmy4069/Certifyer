import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { GridFSBucket } from "mongodb";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
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

function getLocalDiskPath(safeKey: string): string {
  const env = getEnv();
  const basePath = env.STORAGE_ROOT || "./storage";
  return path.isAbsolute(basePath)
    ? path.join(basePath, safeKey)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), basePath, safeKey);
}

/**
 * Universal Hybrid Storage Adapter.
 * 1. Primary storage: MongoDB GridFS (safe for Vercel, Serverless, Docker, Production).
 * 2. Fallback storage: Local filesystem (for existing files in ./storage during local dev).
 * 3. Auto-sync: If a file exists locally but not in GridFS, it automatically backfills GridFS!
 */
export class HybridStorageAdapter implements StorageAdapter {
  private secret: string;

  constructor(secret?: string) {
    const env = getEnv();
    this.secret = secret || env.AUTH_SECRET;
  }

  private async getBucket(): Promise<GridFSBucket | null> {
    try {
      await connectDb();
      const db = mongoose.connection.db;
      if (!db) return null;
      return new GridFSBucket(db, { bucketName: "storage" });
    } catch (err) {
      console.warn("[Storage] GridFS bucket connect warning:", err);
      return null;
    }
  }

  getAbsolutePath(key: string): string {
    const safe = ensureSafeKey(key);
    return `gridfs://${safe}`;
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const safe = ensureSafeKey(key);
    const bucket = await this.getBucket();

    if (bucket) {
      // Delete any existing files in GridFS with this key
      try {
        const existing = await bucket.find({ filename: safe }).toArray();
        for (const file of existing) {
          await bucket.delete(file._id).catch(() => {});
        }
      } catch {}

      // Upload to GridFS
      await new Promise<void>((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(safe, {
          metadata: { mimeType, contentType: mimeType, size: data.length },
        });
        uploadStream.on("error", reject);
        uploadStream.on("finish", () => resolve());
        uploadStream.end(data);
      });
    }

    // Also write to local disk if NOT running in serverless read-only environment
    if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
      try {
        const localPath = getLocalDiskPath(safe);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, data);
      } catch (err) {
        console.warn("[Storage] Local cache write skipped:", err);
      }
    }

    return { key: safe, absolutePath: `gridfs://${safe}`, size: data.length, mimeType };
  }

  async get(key: string): Promise<Buffer> {
    const safe = ensureSafeKey(key);
    const bucket = await this.getBucket();

    // 1. Try fetching from GridFS
    if (bucket) {
      try {
        const files = await bucket.find({ filename: safe }).toArray();
        if (files.length > 0) {
          return await new Promise<Buffer>((resolve, reject) => {
            const downloadStream = bucket.openDownloadStreamByName(safe);
            const chunks: Buffer[] = [];
            downloadStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            downloadStream.on("error", reject);
            downloadStream.on("end", () => resolve(Buffer.concat(chunks)));
          });
        }
      } catch (err) {
        console.warn(`[Storage] GridFS read error for ${safe}:`, err);
      }
    }

    // 2. Fallback: check local disk (for files created before GridFS was enabled)
    try {
      const localPath = getLocalDiskPath(safe);
      const localData = await fs.readFile(localPath);

      // Auto-backfill to GridFS so future serverless requests have it in DB
      if (bucket) {
        this.put(safe, localData, "application/octet-stream").catch(() => {});
      }

      return localData;
    } catch {
      throw new Error(`File not found in storage: ${safe}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const safe = ensureSafeKey(key);
      const bucket = await this.getBucket();
      if (bucket) {
        const hasGridFile = await bucket.find({ filename: safe }).hasNext();
        if (hasGridFile) return true;
      }

      const localPath = getLocalDiskPath(safe);
      await fs.access(localPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const safe = ensureSafeKey(key);
    const bucket = await this.getBucket();
    if (bucket) {
      try {
        const files = await bucket.find({ filename: safe }).toArray();
        for (const file of files) {
          await bucket.delete(file._id).catch(() => {});
        }
      } catch {}
    }

    try {
      const localPath = getLocalDiskPath(safe);
      await fs.unlink(localPath);
    } catch {}
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
    storageSingleton = new HybridStorageAdapter();
  }
  return storageSingleton;
}

export function randomStorageId(bytes = 12): string {
  return randomBytes(bytes).toString("hex");
}
