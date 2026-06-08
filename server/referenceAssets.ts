import fs from "node:fs/promises";
import path from "node:path";
import { fal } from "@fal-ai/client";

export async function resolveReferenceAssetUrl({
  outputPath,
  publicPath,
}: {
  outputPath?: string;
  publicPath?: string;
}) {
  const preferredHost = process.env.REFERENCE_ASSET_HOST?.toLowerCase() ?? "fal";
  if (preferredHost !== "public" && outputPath && process.env.FAL_KEY) {
    try {
      return await uploadReferenceAssetToFal(outputPath);
    } catch (error) {
      if (!publicPath) throw error;
      return absolutePublicUrl(publicPath);
    }
  }
  if (!publicPath) return undefined;
  return absolutePublicUrl(publicPath);
}

export async function uploadReferenceAssetToFal(filePath: string) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is required to upload reference assets to fal storage.");
  fal.config({ credentials: key });
  const buffer = await fs.readFile(filePath);
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeTypeFor(filePath) });
  try {
    return await fal.storage.upload(blob, {
      lifecycle: { expiresIn: resolveFalAssetExpiration() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("forbidden")) throw error;
    return fal.storage.upload(blob);
  }
}

export function absolutePublicUrl(publicPath: string) {
  if (/^https?:\/\//.test(publicPath)) return publicPath;
  const baseUrl = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!baseUrl) return publicPath;
  return `${baseUrl}${publicPath.startsWith("/") ? publicPath : `/${publicPath}`}`;
}

function mimeTypeFor(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".txt") return "text/plain";
  return "application/octet-stream";
}

function resolveFalAssetExpiration() {
  const value = process.env.FAL_REFERENCE_ASSET_EXPIRES_IN?.trim();
  if (!value) return "7d";
  if (value === "never" || value === "immediate" || value === "1h" || value === "1d" || value === "7d" || value === "30d" || value === "1y") {
    return value;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : "7d";
}
