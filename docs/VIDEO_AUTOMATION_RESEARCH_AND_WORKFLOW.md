# OPAIJA Video Automation Research and Workflow

Last refreshed: May 31, 2026.

## Recommendation

Use a hybrid pipeline:

1. Local VPS model or OpenAI text model plans the episode, shot list, prompts, captions, and QC rubric.
2. OpenAI GPT Image 2 generates and edits approved keyframes, character-safe model sheets, thumbnails, and first/last frames.
3. Seedance 2.0 through fal.ai generates short video clips from approved images and references.
4. ElevenLabs or OpenAI TTS creates controlled narration.
5. Remotion assembles, captions, brands, renders, and exports the final 9:16 short.
6. A scheduler runs the video agent, writes a packet, renders an MP4, and queues the next shot.

This is better than choosing only one model. OpenAI is strongest for controllable image/keyframe/storyboard iteration, story direction, and optional Sora A/B video tests. Seedance is currently the stronger production clip layer for our existing app because it already has text-to-video, image-to-video, and reference-to-video endpoints wired in `server/seedance.ts`, and fal documents reference-to-video support for up to 9 images, 3 videos, and 3 audio clips.

The important storyboard-to-video update is this: do not send a raw character bible sheet as the video clip frame. Use the bible/model sheet to create clean storyboard production frames first, then send those storyboard frames and the full shot plan to Seedance 2.0.

## Storyboard-To-Seedance Workflow

1. Choose the exact Opaija character and load the approved model sheet.
2. Generate a first-class `reference-pack.json` for that character: identity lock, approved reference art, motion language, wardrobe/prop rules, power rules, and forbidden drift.
3. Rewrite the narration for fast trailer pacing and generate `timing-sheet.json`.
4. Generate a small storyboard/reference sheet from the story: 4-6 cinematic production frames, one pose/shot per frame.
5. Give every shot a first-frame pose, motion arc, last-frame pose, camera move, and continuity lock.
6. Keep each frame clean: no labels, no sheet grid, no multiple poses, no prompt text in the image.
7. Send the storyboard sequence to Seedance 2.0 with duration and action timing from `timing-sheet.json`.
8. Use Remotion for the final CTA, captions, voiceover, pacing, and publish master.

Mandatory timing formula:

```text
words_per_second = target_wpm / 60
narration_duration = scene_word_count / words_per_second
final_clip_duration = narration_duration + pre_action_hold + impact_hold + transition_buffer
```

Opaija defaults are 155 WPM, 0.35s pre-action hold, 0.55s impact hold, 0.35s transition buffer, and max 0.5s audio/video drift. Any run missing a complete timing sheet is blocked before animation. Any assembled master with more than 0.5s drift between final video and voiceover is marked `timing_failed`.

For Seedance reference-to-video, the render prompt should name storyboard assets directly as `@Image1`, `@Image2`, etc. The agent should not just attach image URLs; it should tell Seedance how each reference maps to the shot order, action, camera move, and continuity lock. Keep Seedance native audio off for the production master until it beats the controlled Remotion voice/caption mix in review.

Generated storyboard frames should be uploaded to a provider-accessible asset host before video generation. The local command center still keeps local `public/generated/...` files for review, but live Seedance/Sora reference URLs should come from fal storage by default (`REFERENCE_ASSET_HOST=fal`) so the bakeoff does not depend on whether `opaija.com` has already synced the newest generated images.

## Vertical Series Launch Format

Opaija launches first as a vertical action teaser universe:

- Character power teasers are 20-35 seconds.
- First serialized vertical episodes are 60-90 seconds with 5-8 action/story beats.
- 30-minute episodes are later compilation specials built from 20-30 vertical chapters, not the first production unit.
- Each character teaser follows: hook hit -> identity reveal -> power action -> threat/cliffhanger -> CTA.
- Each vertical episode ends with a hard cliffhanger, reveal, betrayal, power unlock, or unanswered danger.

Power teaser production must use an `audio-action-beat-sheet.json` before image or video generation. Every beat defines timecode, visual action, camera move, impact frame, SFX, music hit, voice line, voice placement, duration, character lock, and QC notes. Teaser exports fail if audio, visual, and beat-grid duration differ by more than 0.25 seconds.

## Model Findings

### OpenAI

- OpenAI now documents API video generation with Sora through `POST /videos`, status polling, content download, video extension, and editing.
- Sora supports prompt-based renders and image/reference-driven workflows, with `sora-2` and `sora-2-pro` examples in the docs.
- Sora supports image references through `input_reference`, which can preserve the look of a brand asset, character, or environment for one generation.
- OpenAI also documents reusable video character assets created from uploaded short MP4 clips, but this is different from `input_reference`; because human-likeness support can require eligibility, treat Sora character assets as an A/B path for Opaija after access is proven.
- OpenAI video guardrails matter for Opaija: copyrighted characters/music and real people are rejected. Our original characters are the right fit, but we should avoid prompts that imply real people.
- OpenAI image generation now centers on GPT Image models such as `gpt-image-2`, and supports both Image API generation/editing and multi-turn image workflows through the Responses API.
- GPT Image 2 supports high-fidelity image input workflows and flexible portrait resolutions such as `1024x1536`; OpenAI still notes recurring character consistency can drift, so Opaija must use strict character locks and review gates.

Use OpenAI for:

- character model-sheet cleanup
- pose/keyframe generation
- first-frame and last-frame planning
- thumbnails and social graphics
- optional Sora A/B tests once API access and cost are confirmed

### Seedance 2.0 through fal.ai

- fal.ai documents Seedance 2.0 as a queued API with text-to-video, image-to-video, and reference-to-video model IDs.
- It supports hosted files, uploaded files, queue status, and result polling.
- The official fal GitHub docs describe Seedance 2.0 as supporting text, image, and multi-modal reference-to-video generation with native audio and camera control.
- Standard and fast tiers are available; fast tier is the default fit for high-volume social iteration.

Use Seedance for:

- animating approved Opaija character images
- 4-15 second action/lore clips
- reference-to-video tests for staff movement, gayelle scenes, and camera moves
- repeatable short-form clip batches

### GitHub / Open-Source Candidates

VibeFrame is the closest current command-line architecture reference for this specific app shape:

- CLI-first, MCP-ready agentic video workflow layer
- uses storyboard and design files as source of truth
- routes provider-heavy work only when a storyboard asks for it
- supports provider primitives such as OpenAI images, Seedance video, narration, music, captions, Remotion, and render inspection
- useful as a pattern for our command center because Opaija already has packet folders, provider adapters, and Remotion exports

OpenMontage is the closest current open-source workflow reference:

- agentic video production system with multiple pipelines, production tools, schemas, tests, and a Remotion composition layer
- useful patterns for contract validation, checkpoints, render runtime selection, and final artifact folders
- strong fit as architecture inspiration for Opaija, while keeping our existing app-specific character canon and Remotion templates

ArcReel is also a useful workflow reference:

- open-source short-drama and manga workspace
- agent-orchestrated script, character design, storyboard, and video synthesis
- designed around character/scene/prop consistency
- supports multiple providers, including OpenAI, Seedance, and self-hosted endpoints
- AGPL-3.0 license, so it is better as architecture inspiration unless we intentionally accept AGPL constraints

UniVA is useful as an agent architecture reference:

- plan-and-act video agent
- MCP-based modular tool servers
- better for research and tool architecture than immediate Opaija production

ComfyUI Seedance workflows are useful for experimentation:

- good visual node workflows for first/last-frame, reference-to-video, and consistency tests
- less clean for an unattended production agent unless wrapped behind a stable API

AniME is conceptually aligned:

- director-oriented multi-agent long-animation system
- global memory plus specialized downstream agents
- useful as a design pattern for long-form Opaija, not a drop-in production dependency today

Moyin Creator is the newest useful open-source workflow reference found in the May 2026 scan:

- screenplay -> characters -> scenes -> storyboard -> Seedance-style production structure
- focuses on batch processing for short dramas and anime
- supports multi-shot narrative generation and automatic collection of character, scene, and first-frame references
- useful as validation that Opaija should keep moving toward project packets and batchable scene manifests instead of one-off prompts
- treat it as architecture inspiration unless its license and dependency graph are reviewed before importing code

## Opaija Production Architecture

### Agent Roles

1. `Story Director Agent`
   - chooses canon-safe topic, episode beat, and audience hook
   - outputs `story.json`

2. `Visual Continuity Agent`
   - selects character sheet, style rules, wardrobe, palette, and forbidden drift
   - outputs `reference-pack.json` and `visual-lock.json`

3. `Keyframe Agent`
   - creates storyboard frames, first-frame descriptions, last-frame descriptions, thumbnail prompt, and Seedance reference prompt
   - can use GPT Image once enabled
   - outputs `storyboard-frames.json` and `keyframes.json`

4. `Video Generator Agent`
   - sends jobs to Seedance or Sora provider adapter
   - polls queue and stores results
   - outputs `clips.json`

5. `Voice Agent`
   - creates narration and optional character voice lines
   - outputs MP3 and timing notes

6. `Remotion Editor Agent`
   - assembles clips, stills, voiceover, captions, brand footer, CTA, and export
   - outputs MP4 and `render-manifest.json`

7. `QC Agent`
   - checks face drift, character identity, text collisions, motion artifacts, audio sync, and brand rules
   - approves, retries, or sends to manual review

### File Packet Shape

Each auto-video run should create:

```text
out/video-agent/<run-id>/
  story.json
  visual-lock.json
  keyframes.json
  timing-sheet.json
  seedance-jobs.json
  clips.json
  voiceover.mp3
  render-manifest.json
  captions.srt
  qc-report.json
  final.mp4
  thumbnail.jpg
  publish-copy.json
```

## Build Direction

Keep the current `server/videoAgent.ts` worker, but extend it in phases:

1. Add provider adapters:
   - `openaiImageProvider.ts`
   - `openaiVideoProvider.ts`
   - `seedanceVideoProvider.ts`

2. Add persistent packet storage:
   - `data/video-runs.json`
   - `out/video-agent/<run-id>/`

3. Add API routes:
   - `POST /api/video-agent/runs`
   - `GET /api/video-agent/runs`
   - `GET /api/video-agent/runs/:id`

4. Add command-center UI:
   - queue status
   - latest MP4 preview
   - packet details
   - rerun / approve / reject controls

5. Add scheduler:
   - short-form social: 2 daily
   - blog companion: 2 daily
   - weekly longer lore reel

6. Enable provider completion:
   - set `VIDEO_AGENT_WAIT_FOR_CLIP=true`
   - download Seedance/Sora clips to `public/generated/clips`
   - keep the Remotion final as the publishable master

## Decision

Do not replace Seedance yet. Add OpenAI image/video as optional providers and keep Remotion as the final assembly layer.

The best Opaija stack today is:

```text
Local/OAI text planning -> GPT Image 2 storyboard frames -> Seedance 2 reference-to-video clips -> Voice -> Remotion -> QC -> publish queue
```

Once Sora API access, pricing, and character consistency are proven for Opaija, use it as a second video provider for A/B tests.

## Live Provider Bakeoff

The command center includes a one-click bakeoff gate:

```text
GPT Image 2 storyboard frame -> Seedance reference-to-video
                               -> Sora reference-video
```

This gate is intentionally separate from the daily production scheduler. It should be run with live spend enabled when we need a fresh decision on which video provider is producing the better Opaija character result. Score the two generated video artifacts for character consistency, motion quality, artifact control, story clarity, cost, and speed. The production default should remain Seedance until the reviewed live artifacts prove Sora is better for these exact characters.

## Sources

- OpenAI video generation with Sora: https://platform.openai.com/docs/guides/video-generation
- OpenAI image generation: https://platform.openai.com/docs/guides/images
- fal.ai Seedance 2.0 overview: https://fal.ai/seedance-2.0
- fal.ai Seedance 2.0 image-to-video API: https://fal.ai/models/bytedance/seedance-2.0/image-to-video/api
- VibeFrame: https://github.com/vericontext/vibeframe
- fal-ai Seedance 2.0 API GitHub docs: https://github.com/fal-ai/seedance-2.0-api
- OpenMontage: https://github.com/calesthio/OpenMontage
- ArcReel: https://arc-reel.com/en/
- UniVA paper/repo: https://arxiv.org/abs/2511.08521 and https://github.com/univa-agent/univa
- AniME paper: https://arxiv.org/abs/2508.18781
