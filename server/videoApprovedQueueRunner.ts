import dotenv from "dotenv";
import { processApprovedStoryboardQueue } from "./videoApprovedQueue.js";

dotenv.config();

const result = await processApprovedStoryboardQueue({
  keyframeProvider: process.env.APPROVED_QUEUE_KEYFRAME_PROVIDER ?? "mock",
  clipProvider: process.env.APPROVED_QUEUE_CLIP_PROVIDER ?? "mock",
  voiceProvider: process.env.APPROVED_QUEUE_VOICE_PROVIDER ?? "mock",
  storyboardFrameProvider: process.env.APPROVED_QUEUE_STORYBOARD_FRAME_PROVIDER ?? "mock",
  waitForClip: process.env.APPROVED_QUEUE_WAIT_FOR_CLIP === "true",
  confirmLiveSpend: process.env.CONFIRM_LIVE_PROVIDER_SPEND === "true",
  maxRuns: Number(process.env.APPROVED_QUEUE_MAX_RUNS ?? 3),
  renderWidth: process.env.APPROVED_QUEUE_RENDER_WIDTH,
  renderHeight: process.env.APPROVED_QUEUE_RENDER_HEIGHT,
  renderDurationFrames: process.env.APPROVED_QUEUE_RENDER_DURATION_FRAMES,
});

console.log(JSON.stringify(result, null, 2));
