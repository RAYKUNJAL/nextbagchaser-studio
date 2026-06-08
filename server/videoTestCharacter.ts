process.env.VIDEO_AGENT_REQUIRE_LLM = "false";
process.env.VOICE_PROVIDER = "mock";
process.env.KEYFRAME_IMAGE_PROVIDER = "mock";
process.env.VIDEO_CLIP_PROVIDER = "mock";
process.env.VIDEO_AGENT_RENDER_WIDTH = "360";
process.env.VIDEO_AGENT_RENDER_HEIGHT = "640";
process.env.VIDEO_AGENT_RENDER_DURATION_FRAMES = "90";
process.env.VIDEO_AGENT_CHARACTER_ID = process.env.VIDEO_AGENT_CHARACTER_ID || "nia";

await import("./videoAgent.js");
