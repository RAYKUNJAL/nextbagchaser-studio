# OPAIJA Video Agent VPS Runbook

The video agent creates a 30-second vertical Opaija short:

- researches local canon files
- asks the local VPS model for a video packet
- creates narrator voiceover through the configured voice provider
- optionally waits for Seedance/Sora clip completion and downloads provider clips
- renders `OpaijaShort` with Remotion
- writes outputs under `out/video-agent/`

## PowerShell Manual Run

```powershell
ssh root@5.78.105.83 "cd /root/Opaija && npm run video:agent:prod"
```

## PowerShell Twice-Daily Schedule

Preferred production mode is the built-in server scheduler. It keeps the agent inside the running website process and rotates characters automatically.

You can turn it on from the command center at `/command` in the Video Agent panel. Use `Enable Mock Schedule` for dry runs, then use `Enable Production Schedule` only after live provider tests pass and the live-spend checkbox is intentionally enabled.

```text
VIDEO_AGENT_SCHEDULE_ENABLED=true
VIDEO_AGENT_SCHEDULE_TIMES=09:00,19:00
VIDEO_AGENT_SCHEDULE_CHARACTER_IDS=kairo,nia,malik,asha,jabari,tariq,mother-lall,papa-etienne,marius,selah
VIDEO_AGENT_SCHEDULE_KEYFRAME_PROVIDER=openai
VIDEO_AGENT_SCHEDULE_CLIP_PROVIDER=seedance
VIDEO_AGENT_SCHEDULE_VOICE_PROVIDER=openai
VIDEO_AGENT_SCHEDULE_WAIT_FOR_CLIP=true
VIDEO_AGENT_SCHEDULE_REQUIRE_LLM=true
```

The command-center API exposes this at `/api/video-agent/schedule`.

Fallback cron mode runs at 9:00 AM and 7:00 PM server time:

```powershell
ssh root@5.78.105.83 "(crontab -l 2>/dev/null; echo '0 9,19 * * * cd /root/Opaija && /usr/bin/npm run video:agent:prod >> /var/log/opaija-video-agent.log 2>&1') | crontab -"
```

Check logs:

```powershell
ssh root@5.78.105.83 "tail -n 160 /var/log/opaija-video-agent.log"
```

## Local Model Settings

Default:

```text
VIDEO_AGENT_LLM_PROVIDER=ollama
VIDEO_AGENT_LLM_BASE_URL=http://localhost:11434
VIDEO_AGENT_LLM_MODEL=llama3.1
VIDEO_AGENT_REQUIRE_LLM=false
KEYFRAME_IMAGE_PROVIDER=mock
VIDEO_CLIP_PROVIDER=mock
VIDEO_AGENT_WAIT_FOR_CLIP=false
VIDEO_AGENT_SCHEDULE_CHARACTER_IDS=kairo,nia,malik,asha,jabari,tariq,mother-lall,papa-etienne,marius,selah
```

Set `VIDEO_AGENT_REQUIRE_LLM=true` when the local model is stable and you do not want fallback packets.

For a live provider test:

```text
KEYFRAME_IMAGE_PROVIDER=gemini
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_IMAGE_MODEL=gemini-3-pro-image
VIDEO_CLIP_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_VIDEO_MODEL=bytedance/seedance-2.0-fast
OPENROUTER_VIDEO_RESOLUTION=480p
OPENROUTER_VIDEO_MAX_DURATION_SEC=4
VIDEO_AGENT_WAIT_FOR_CLIP=true
```

Use `KEYFRAME_IMAGE_PROVIDER=openai` only for scratch keyframes. Production Opaija character rebuilds should use Gemini or another provider that accepts the approved bible sheets as image references, because text-only keyframes can drift from the character bible and crop staffs/bois. Use `VIDEO_CLIP_PROVIDER=openrouter` for the current Seedance route; fal is blocked unless that account has direct Seedance authorization.

## Output

Each run writes:

The `packet.json` includes the social caption and hashtags.

Full packets include:

```text
story.json
visual-lock.json
keyframes.json
seedance-jobs.json
clips.json
captions.srt
render-manifest.json
publish-copy.json
qc-report.json
final.mp4
thumbnail.jpg
```
