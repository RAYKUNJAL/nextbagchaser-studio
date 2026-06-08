import fs from "node:fs/promises";
import path from "node:path";

export type AdminSecretDefinition = {
  name: string;
  label: string;
  description: string;
  provider: string;
  requiredFor: string;
  placeholder: string;
};

export type AdminSecretStatus = AdminSecretDefinition & {
  configured: boolean;
  maskedValue: string;
};

const secretDefinitions: AdminSecretDefinition[] = [
  {
    name: "GEMINI_API_KEY",
    label: "Gemini API Key",
    provider: "Google Gemini",
    description: "Preferred keyframe provider for exact Opaija bible-sheet reference images.",
    requiredFor: "Bible-locked storyboard artwork",
    placeholder: "AIza...",
  },
  {
    name: "GOOGLE_API_KEY",
    label: "Google API Key",
    provider: "Google Gemini",
    description: "Optional fallback name used by the Google GenAI SDK.",
    requiredFor: "Gemini image provider fallback",
    placeholder: "AIza...",
  },
  {
    name: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    provider: "OpenAI",
    description: "Brain, prompt polish, fallback image generation, and optional voice/video routes.",
    requiredFor: "OpenAI escalation and fallback providers",
    placeholder: "sk-...",
  },
  {
    name: "OPENROUTER_API_KEY",
    label: "OpenRouter API Key",
    provider: "OpenRouter",
    description: "Cloud LLM escalation path for story, QC, and prompt repair.",
    requiredFor: "Hybrid multi-LLM workflow",
    placeholder: "sk-or-...",
  },
  {
    name: "FAL_KEY",
    label: "fal.ai / Seedance Key",
    provider: "fal.ai",
    description: "Seedance image-to-video animation jobs.",
    requiredFor: "Storyboard-to-video animation",
    placeholder: "fal_...",
  },
  {
    name: "ELEVENLABS_API_KEY",
    label: "ElevenLabs API Key",
    provider: "ElevenLabs",
    description: "Higher-quality performance voiceover.",
    requiredFor: "Narration and character voice",
    placeholder: "el_...",
  },
  {
    name: "RESEND_API_KEY",
    label: "Resend API Key",
    provider: "Resend",
    description: "Founder-list email capture and launch email flows.",
    requiredFor: "Email list and launch updates",
    placeholder: "re_...",
  },
  {
    name: "PRINTFUL_API_KEY",
    label: "Printful API Key",
    provider: "Printful",
    description: "Merch provider integration.",
    requiredFor: "Merch tests",
    placeholder: "pf_...",
  },
  {
    name: "PRINTIFY_API_KEY",
    label: "Printify API Key",
    provider: "Printify",
    description: "Alternate merch provider integration.",
    requiredFor: "Merch tests",
    placeholder: "printify...",
  },
];

const allowedSecretNames = new Set(secretDefinitions.map((secret) => secret.name));

export function listAdminSecretStatuses(): AdminSecretStatus[] {
  return secretDefinitions.map((secret) => {
    const value = process.env[secret.name] ?? "";
    return {
      ...secret,
      configured: Boolean(value.trim()),
      maskedValue: maskSecret(value),
    };
  });
}

export async function updateAdminSecrets(input: Record<string, unknown>) {
  const updates: Record<string, string> = Object.fromEntries(
    Object.entries(input)
      .filter(([name, value]) => allowedSecretNames.has(name) && typeof value === "string")
      .map(([name, value]) => [name, String(value).trim()]),
  );

  if (!Object.keys(updates).length) {
    throw new Error("No supported API key fields were provided.");
  }

  await writeEnvUpdates(updates);
  for (const [name, value] of Object.entries(updates)) {
    process.env[name] = value;
  }

  return {
    ok: true,
    updated: Object.keys(updates),
    secrets: listAdminSecretStatuses(),
  };
}

function getEnvPath() {
  return path.resolve(process.cwd(), ".env");
}

async function writeEnvUpdates(updates: Record<string, string>) {
  const envPath = getEnvPath();
  const original = await fs.readFile(envPath, "utf8").catch(() => "");
  const lines = original ? original.split(/\r?\n/) : [];
  const handled = new Set<string>();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) return line;
    const name = match[1];
    if (!(name in updates)) return line;
    handled.add(name);
    return `${name}=${serializeEnvValue(updates[name])}`;
  });

  for (const [name, value] of Object.entries(updates)) {
    if (!handled.has(name)) nextLines.push(`${name}=${serializeEnvValue(value)}`);
  }

  await fs.writeFile(envPath, `${nextLines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

function serializeEnvValue(value: string) {
  if (!value) return "";
  if (/[\s#"']/u.test(value)) return JSON.stringify(value);
  return value;
}

function maskSecret(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.length <= 8) return "configured";
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}
