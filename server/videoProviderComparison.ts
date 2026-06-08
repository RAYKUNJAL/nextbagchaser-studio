import { listProviderSmokeTests, type ProviderSmokeTestRecord, type ProviderSmokeTestStatus } from "./providerSmokeTests.js";
import { getLatestProviderBakeoffPacket } from "./providerBakeoffPackets.js";
import { fileExists, probeVideo, type VideoProbeResult } from "./videoProbe.js";

export type ProviderComparisonReport = {
  recommendation: string;
  readyForDecision: boolean;
  decisionGate: "needs_live_bakeoff" | "waiting_for_completion" | "needs_review" | "needs_tiebreaker" | "ready";
  winner?: "seedance-reference-clip" | "openai-sora-reference-clip";
  decisionQuality?: {
    minimumScore: number;
    minimumMargin: number;
    bestScore: number;
    margin: number;
  };
  generatedAt: string;
  providers: Array<{
    id: "seedance-reference-clip" | "openai-sora-reference-clip";
    label: string;
    status: ProviderSmokeTestRecord["status"] | "missing";
    liveTested: boolean;
    artifactReady: boolean;
    artifactProbe?: VideoProbeResult;
    artifactPath?: string;
    score: number;
    reviewScore?: number;
    strengths: string[];
    risks: string[];
  }>;
  nextStep: string;
};

export async function getVideoProviderComparison(): Promise<ProviderComparisonReport> {
  const tests = await listProviderSmokeTests();
  const latestBakeoff = await getLatestProviderBakeoffPacket();
  const hasComparableBakeoff = Boolean(latestBakeoff?.seedanceReference && latestBakeoff?.soraReference);
  const seedance = hasComparableBakeoff
    ? (latestBakeoff?.seedanceReference ?? undefined)
    : tests.find((test) => test.provider === "seedance-reference-clip");
  const sora = hasComparableBakeoff
    ? (latestBakeoff?.soraReference ?? undefined)
    : tests.find((test) => test.provider === "openai-sora-reference-clip");
  const providers = [
    await summarizeProvider({
      id: "seedance-reference-clip",
      label: "Seedance reference-to-video",
      test: seedance,
      baseStrengths: ["Multi-reference workflow fit", "Primary production candidate", "fal queue/result API"],
      baseRisks: ["Needs live artifact verification", "May drift without clean storyboard frames"],
    }),
    await summarizeProvider({
      id: "openai-sora-reference-clip",
      label: "OpenAI Sora reference-video",
      test: sora,
      baseStrengths: ["Same OpenAI stack as storyboard planning", "Useful A/B provider", "Strong cinematic prior"],
      baseRisks: ["Character consistency and access/cost still unproven", "Human-likeness policy/access may affect reusable character workflows"],
    }),
  ];
  const artifactsReady = providers.every((provider) => provider.liveTested && provider.status === "completed" && provider.artifactReady);
  const hasLiveAttempt = providers.some((provider) => provider.liveTested);
  const allReviewed = providers.every((provider) => typeof provider.reviewScore === "number");
  const ranked = [...providers].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const runnerUp = ranked[1];
  const minimumScore = Number(process.env.PROVIDER_DECISION_MIN_SCORE ?? 70);
  const minimumMargin = Number(process.env.PROVIDER_DECISION_MIN_MARGIN ?? 5);
  const bestScore = best?.score ?? 0;
  const margin = best && runnerUp ? best.score - runnerUp.score : 0;
  const decisionQuality = {
    minimumScore,
    minimumMargin,
    bestScore,
    margin,
  };
  const hasDecisionQuality = bestScore >= minimumScore && margin >= minimumMargin;
  const decisionGate = !hasLiveAttempt
    ? "needs_live_bakeoff"
    : !artifactsReady
      ? "waiting_for_completion"
      : !allReviewed
        ? "needs_review"
        : !hasDecisionQuality
          ? "needs_tiebreaker"
          : "ready";
  const readyForDecision = decisionGate === "ready";

  return {
    generatedAt: new Date().toISOString(),
    readyForDecision,
    decisionGate,
    winner: decisionGate === "ready" ? best.id : undefined,
    decisionQuality,
    recommendation: artifactsReady
      ? `${best.label} is currently ahead based on completed smoke artifacts. ${decisionGate === "ready" ? "Use this as the current provider decision." : "Score margin or quality is not strong enough to switch production yet."}`
      : "Keep Seedance as the production default and use Sora as an A/B provider until both live reference-video artifacts are completed and reviewed.",
    providers,
    nextStep: buildNextStep(decisionGate),
  };
}

function buildNextStep(decisionGate: ProviderComparisonReport["decisionGate"]) {
  if (decisionGate === "needs_live_bakeoff") {
    return "Turn on live provider spend, then run Live Bakeoff to produce comparable Seedance and Sora artifacts.";
  }
  if (decisionGate === "waiting_for_completion") {
    return "Fetch queued provider outputs until both live artifacts are completed, or rerun Live Bakeoff if a provider failed.";
  }
  if (decisionGate === "needs_review") {
    return "Open both completed artifacts and score character consistency, motion, artifacts, story clarity, cost, and speed.";
  }
  if (decisionGate === "needs_tiebreaker") {
    return "Scores are too low or too close. Rerun Live Bakeoff or review both artifacts again before applying a production winner.";
  }
  return "Provider bakeoff is reviewed. Keep the winner for production and rerun this gate when providers change.";
}

async function summarizeProvider({
  id,
  label,
  test,
  baseStrengths,
  baseRisks,
}: {
  id: "seedance-reference-clip" | "openai-sora-reference-clip";
  label: string;
  test?: ProviderSmokeTestRecord;
  baseStrengths: string[];
  baseRisks: string[];
}) {
  const artifactPath = test?.publicPath ? `public/${test.publicPath.replace(/^\//, "")}` : undefined;
  const artifactExists = artifactPath ? await fileExists(artifactPath) : false;
  const artifactProbe = artifactExists && artifactPath ? await safeProbeVideo(artifactPath) : undefined;
  const artifactReady = Boolean(artifactProbe?.valid);
  const liveTested = Boolean(test?.liveSpendConfirmed);
  const status: ProviderSmokeTestStatus | "missing" = test?.status ?? "missing";
  let score = 20;
  if (test?.status === "configured") score = 35;
  if (test?.status === "queued") score = 55;
  if (test?.status === "completed" && artifactReady) score = 80;
  if (test?.status === "failed") score = 5;
  if (liveTested && test?.status === "completed" && artifactReady) score += 10;
  const reviewScore = test?.review
    ? Math.round(
        ((test.review.characterConsistency +
          test.review.motionQuality +
          test.review.artifactControl +
          test.review.storyClarity +
          test.review.costScore +
          test.review.speedScore) /
          60) *
          100,
      )
    : undefined;
  if (typeof reviewScore === "number") score = reviewScore;

  return {
    id,
    label,
    status,
    liveTested,
    artifactReady,
    artifactProbe,
    artifactPath: test?.publicPath,
    score,
    reviewScore,
    strengths: baseStrengths,
    risks: [
      ...baseRisks,
      ...(test?.error ? [test.error] : []),
      ...(!artifactExists && test?.status === "completed" ? ["Completed record is missing local public artifact"] : []),
      ...(artifactExists && !artifactReady && test?.status === "completed" ? ["Completed artifact is not a valid playable video"] : []),
    ],
  };
}

async function safeProbeVideo(filePath: string) {
  try {
    return await probeVideo(filePath);
  } catch {
    return undefined;
  }
}
