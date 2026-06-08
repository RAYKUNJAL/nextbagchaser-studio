import fs from "node:fs/promises";
import path from "node:path";
import { uploadReferenceAssetToFal } from "./referenceAssets.js";

export type BakeoffPreflightCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type BakeoffPreflightReport = {
  ok: boolean;
  generatedAt: string;
  checks: BakeoffPreflightCheck[];
  nextStep: string;
};

export async function getProviderBakeoffPreflight(): Promise<BakeoffPreflightReport> {
  const publicSiteUrl = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const checks: BakeoffPreflightCheck[] = [
    {
      id: "openai-key",
      label: "OpenAI key",
      ok: Boolean(process.env.OPENAI_API_KEY),
      detail: process.env.OPENAI_API_KEY ? "Configured for GPT Image 2 and Sora tests." : "Missing OPENAI_API_KEY.",
    },
    {
      id: "fal-key",
      label: "fal / Seedance key",
      ok: Boolean(process.env.FAL_KEY),
      detail: process.env.FAL_KEY ? "Configured for Seedance reference-to-video." : "Missing FAL_KEY.",
    },
    {
      id: "public-site-url",
      label: "Public site URL",
      ok: /^https?:\/\//.test(publicSiteUrl),
      detail: publicSiteUrl || "Missing PUBLIC_SITE_URL. Seedance/Sora need public references.",
    },
    await checkPublicHealth(publicSiteUrl),
    await checkReferenceAssetTransport(publicSiteUrl),
  ];

  const ok = checks.every((check) => check.ok);
  return {
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    nextStep: ok
      ? "Preflight passed. Run Live Bakeoff when you are ready to spend provider credits."
      : "Fix the failed preflight checks before running Live Bakeoff.",
  };
}

async function checkReferenceAssetTransport(publicSiteUrl: string): Promise<BakeoffPreflightCheck> {
  const preferredHost = process.env.REFERENCE_ASSET_HOST?.toLowerCase() ?? "fal";
  if (preferredHost !== "public" && process.env.FAL_KEY) {
    try {
      const localPath = await writePreflightAsset();
      const url = await uploadReferenceAssetToFal(localPath);
      return {
        id: "reference-asset-transport",
        label: "Reference asset transport",
        ok: /^https?:\/\//.test(url),
        detail: /^https?:\/\//.test(url)
          ? "fal storage accepted a generated reference asset for live video providers."
          : "fal storage upload did not return a public URL.",
      };
    } catch (error) {
      return {
        id: "reference-asset-transport",
        label: "Reference asset transport",
        ok: false,
        detail: error instanceof Error ? error.message : "Unable to upload generated reference asset to fal storage.",
      };
    }
  }

  if (!/^https?:\/\//.test(publicSiteUrl)) {
    return {
      id: "reference-asset-transport",
      label: "Reference asset transport",
      ok: false,
      detail: "Skipped because PUBLIC_SITE_URL is missing or invalid.",
    };
  }

  const relativePath = "/generated/provider-smoke-tests/preflight.txt";
  const localPath = path.join(process.cwd(), "public", relativePath.replace(/^\//, ""));
  const token = `opaija-bakeoff-preflight-${Date.now()}`;
  try {
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, `${token}\n`, "utf8");
  } catch (error) {
    return {
      id: "reference-asset-transport",
      label: "Reference asset transport",
      ok: false,
      detail: error instanceof Error ? `Unable to write local test asset: ${error.message}` : "Unable to write local test asset.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${publicSiteUrl}${relativePath}?t=${encodeURIComponent(token)}`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    const body = response.ok ? await response.text() : "";
    const ok = response.ok && body.trim() === token;
    return {
      id: "reference-asset-transport",
      label: "Reference asset transport",
      ok,
      detail: ok
        ? `${publicSiteUrl}${relativePath} served the local generated asset.`
        : `${publicSiteUrl}${relativePath} did not serve the local generated asset. Live Seedance references may be unreachable.`,
    };
  } catch (error) {
    return {
      id: "reference-asset-transport",
      label: "Reference asset transport",
      ok: false,
      detail: error instanceof Error ? error.message : "Unable to fetch generated asset from public site.",
    };
  }
}

async function writePreflightAsset() {
  const token = `opaija-bakeoff-preflight-${Date.now()}`;
  const localPath = path.join(process.cwd(), "public", "generated", "provider-smoke-tests", "preflight.txt");
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, `${token}\n`, "utf8");
  return localPath;
}

async function checkPublicHealth(publicSiteUrl: string): Promise<BakeoffPreflightCheck> {
  if (!/^https?:\/\//.test(publicSiteUrl)) {
    return {
      id: "public-health",
      label: "Public health",
      ok: false,
      detail: "Skipped because PUBLIC_SITE_URL is missing or invalid.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${publicSiteUrl}/api/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return {
      id: "public-health",
      label: "Public health",
      ok: response.ok,
      detail: response.ok ? `${publicSiteUrl}/api/health responded ${response.status}.` : `${publicSiteUrl}/api/health responded ${response.status}.`,
    };
  } catch (error) {
    return {
      id: "public-health",
      label: "Public health",
      ok: false,
      detail: error instanceof Error ? error.message : "Unable to reach public health endpoint.",
    };
  }
}
