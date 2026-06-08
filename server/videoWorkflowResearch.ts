export type VideoWorkflowResearchReport = {
  generatedAt: string;
  currentAnswer: string;
  recommendedStack: string[];
  providerDecision: {
    defaultProvider: "seedance";
    challengerProvider: "openai-sora";
    reason: string;
    gate: string;
  };
  workflow: Array<{
    step: string;
    owner: string;
    output: string;
  }>;
  references: Array<{
    label: string;
    url: string;
    use: string;
  }>;
};

export function getVideoWorkflowResearch(): VideoWorkflowResearchReport {
  return {
    generatedAt: new Date().toISOString(),
    currentAnswer:
      "Build this with a Qwen-led hybrid agent: local Qwen handles story direction, agent routing, storyboard planning, QC, and memory; OpenAI/OpenRouter escalates weak outputs and polishes final prompts; Seedance 2.0 remains the production motion layer until live Sora artifacts beat it.",
    recommendedStack: [
      "Local Qwen planner for low-cost scripts, shot plans, agent coordination, QC, and memory",
      "OpenAI/OpenRouter escalation for failed JSON repair, canon-sensitive rewrites, style audits, and final prompt polish",
      "OpenAI GPT Image 2 for consistent storyboard frames, first frames, last frames, thumbnails, and image edits",
      "Seedance 2.0 reference-to-video through fal.ai for character motion and cinematic shots",
      "OpenAI Sora as an A/B challenger after a paid live bakeoff proves access, cost, and character consistency",
      "OpenAI or ElevenLabs voiceover",
      "Remotion final render with captions, CTA, brand footer, and publish-safe exports",
    ],
    providerDecision: {
      defaultProvider: "seedance",
      challengerProvider: "openai-sora",
      reason:
        "Opaija needs multi-reference anime continuity more than one-off cinematic novelty. Seedance remains the production default because the app already has the fal/Seedance reference-video path and the bakeoff gate has not yet proven Sora is better for these exact characters.",
      gate:
        "Run Live Bakeoff only after enabling live spend. Apply a winner only when both Seedance and Sora return playable artifacts and review scores clear the configured quality margin.",
    },
    workflow: [
      {
        step: "Canon packet",
        owner: "Story Director Agent",
        output: "story.json with hook, beat, caption lines, and social CTA",
      },
      {
        step: "Character lock",
        owner: "Visual Continuity Agent",
        output: "reference-pack.json and visual-lock.json with identity, wardrobe, powers, and forbidden drift",
      },
      {
        step: "Production storyboard",
        owner: "Storyboard Agent",
        output: "4-6 clean cinematic frames, not a character bible sheet or labeled grid",
      },
      {
        step: "Motion handoff",
        owner: "Video Generator Agent",
        output: "Seedance/Sora prompt using storyboard frames as ordered references with first frame, motion arc, last frame, and continuity lock",
      },
      {
        step: "Final edit",
        owner: "Remotion Editor Agent",
        output: "vertical MP4 with voice, captions, CTA, thumbnail, and publish-copy.json",
      },
      {
        step: "Review gate",
        owner: "QC Agent",
        output: "approve/reject decision based on identity, motion, artifact control, story clarity, cost, and speed",
      },
    ],
    references: [
      {
        label: "OpenAI video generation with Sora",
        url: "https://platform.openai.com/docs/guides/video-generation",
        use: "API path for Sora video jobs, polling, downloads, and reference-driven tests.",
      },
      {
        label: "OpenAI image generation",
        url: "https://platform.openai.com/docs/guides/images",
        use: "GPT Image 2 storyboard frames, first/last frames, edits, thumbnails, and reusable visual references.",
      },
      {
        label: "fal.ai Seedance 2.0",
        url: "https://fal.ai/seedance-2.0",
        use: "Seedance 2.0 queued video provider reference for production motion tests.",
      },
      {
        label: "fal.ai Seedance 2.0 reference-to-video",
        url: "https://fal.ai/seedance-2.0",
        use: "Primary architecture fit for Opaija storyboard-frame-to-video handoff.",
      },
      {
        label: "VibeFrame",
        url: "https://github.com/vericontext/vibeframe",
        use: "Architecture reference for agentic video workflows that combine storyboards, providers, narration, captions, and Remotion.",
      },
      {
        label: "OpenMontage",
        url: "https://github.com/calesthio/OpenMontage",
        use: "Architecture reference for agentic video production, schemas, runtime checkpoints, and Remotion-style final assembly.",
      },
    ],
  };
}
