type ProviderStatus = "ready" | "missing_secret" | "dry_run" | "needs_config";

export type ProviderReadinessItem = {
  id: string;
  label: string;
  status: ProviderStatus;
  configured: boolean;
  secretNames: string[];
  mode: "planning" | "keyframe" | "video" | "voice" | "editor";
  recommendation: string;
};

export type VideoAgentReadiness = {
  recommendation: string;
  stack: string[];
  liveReady: boolean;
  liveGenerationVerified: boolean;
  providers: ProviderReadinessItem[];
  blockers: string[];
  verificationNote: string;
};

export function getVideoAgentReadiness({
  liveGenerationVerified = false,
}: {
  liveGenerationVerified?: boolean;
} = {}): VideoAgentReadiness {
  const providers: ProviderReadinessItem[] = [
    {
      id: "qwen-local",
      label: "Local Qwen planner",
      status: "ready",
      configured: true,
      secretNames: [],
      mode: "planning",
      recommendation: "Use Qwen as the low-cost showrunner for story packets, agent routing, storyboard planning, QC summaries, and memory updates.",
    },
    {
      id: "openai-keyframes",
      label: "OpenAI GPT Image 2 storyboards",
      status: process.env.OPENAI_API_KEY ? "ready" : "missing_secret",
      configured: Boolean(process.env.OPENAI_API_KEY),
      secretNames: ["OPENAI_API_KEY"],
      mode: "keyframe",
      recommendation: "Use for character-safe storyboard frames, thumbnails, first frames, and image edits.",
    },
    {
      id: "seedance-clips",
      label: "Seedance 2.0 clips through fal.ai",
      status: process.env.FAL_KEY ? "ready" : "missing_secret",
      configured: Boolean(process.env.FAL_KEY),
      secretNames: ["FAL_KEY"],
      mode: "video",
      recommendation: "Keep as the primary production clip engine until Sora consistency and cost are proven.",
    },
    {
      id: "openai-sora",
      label: "OpenAI Sora video",
      status: process.env.OPENAI_API_KEY ? "ready" : "missing_secret",
      configured: Boolean(process.env.OPENAI_API_KEY),
      secretNames: ["OPENAI_API_KEY"],
      mode: "video",
      recommendation: "Use as an A/B provider for Sora clips after API access and pricing are confirmed.",
    },
    {
      id: "voice",
      label: "Voiceover",
      status: process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY ? "ready" : "dry_run",
      configured: Boolean(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY),
      secretNames: ["ELEVENLABS_API_KEY", "OPENAI_API_KEY"],
      mode: "voice",
      recommendation: "Use ElevenLabs for character voices or OpenAI TTS for simpler narration.",
    },
    {
      id: "remotion",
      label: "Remotion editor",
      status: "ready",
      configured: true,
      secretNames: [],
      mode: "editor",
      recommendation: "Use as the final deterministic renderer, captioner, brand layer, and export step.",
    },
  ];

  const requiredForRecommendedLiveStack = ["openai-keyframes", "seedance-clips"];
  const blockers = providers
    .filter((provider) => requiredForRecommendedLiveStack.includes(provider.id) && provider.status !== "ready")
    .map((provider) => `${provider.label}: missing ${provider.secretNames.join(" or ")}`);

  return {
    recommendation: "Build with Qwen-led routing: Qwen for planning and memory, OpenAI/OpenRouter for escalation, GPT Image for frames, Seedance for clips, Remotion for final editing.",
    stack: ["Qwen local brain", "OpenAI/OpenRouter escalation", "GPT Image 2 storyboard frames", "Seedance 2 reference clips", "Voiceover", "Remotion export", "Manual approve/reject"],
    liveReady: blockers.length === 0,
    liveGenerationVerified,
    providers,
    blockers,
    verificationNote:
      "Readiness confirms configuration only. Paid provider smoke tests must generate one GPT Image storyboard frame and one Seedance reference clip to verify live output.",
  };
}
