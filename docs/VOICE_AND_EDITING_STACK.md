# Voice and Editing Stack

## Decision

Use three layers:

1. Seedance 2.0 for generated video shots.
2. ElevenLabs for controlled narrator and future character voices.
3. Remotion for the AI editing layer: image moves, video assembly, captions, audio timing, thumbnails, and final exports.

## Why Not Only Seedance Audio

Some Seedance routes can generate audio with video, and the adapter supports `generateAudio`. That is useful for quick atmospheric output, but it is not enough for a branded series voice system. Opaija needs repeatable narration, future character voice IDs, script timing, and clean edit control.

## ElevenLabs Setup

Environment:

```powershell
VOICE_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_key
ELEVENLABS_NARRATOR_VOICE_ID=your_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Dry-run voice packet:

```powershell
Invoke-RestMethod -Method Post http://localhost:8787/api/voice/jobs `
  -ContentType 'application/json' `
  -Body '{"text":"Every island has a warrior. Every rhythm has a weapon.","fileName":"pilot-cold-open.mp3"}'
```

## Remotion Setup

Commands:

```powershell
npm run studio
npm run render:teaser
```

Remotion reads images from `public/assets/characters/` and voiceover from `public/voiceover/`.

## Mandatory Anime Timing Rule

Every Opaija anime build must create or load `timing-sheet.json` before storyboard animation or final edit. The narration timing sheet is the source of truth for clip length.

Formula:

```text
words_per_second = target_wpm / 60
narration_duration = scene_word_count / words_per_second
final_clip_duration = narration_duration + pre_action_hold + impact_hold + transition_buffer
```

Opaija defaults:

```text
target_wpm = 155
words_per_second = 2.58
pre_action_hold = 0.25-0.5s
impact_hold = 0.3-0.8s
transition_buffer = 0.25-0.5s
max_audio_video_drift = 0.5s
```

Hard gates:

- Do not animate unless every panel has narration, word count, calculated duration, action beat, and final clip duration.
- Seedance duration must come from `timing-sheet.json`, not generic storyboard defaults.
- Remotion/ffmpeg assembly must trim or extend clips to the timing sheet before muxing audio.
- Mark the run `timing_failed` if final video duration differs from voiceover duration by more than 0.5 seconds.

## Power Teaser Audio-Action Rule

Character launch teasers use a stricter format than long episode narration:

- Runtime is 20-35 seconds.
- Voiceover is 2-3 short lines max; SFX, music hits, and action carry the fight.
- Every beat must define timecode, visual action, camera move, impact frame, SFX, music hit, voice line, voice placement, duration, character lock, and QC notes.
- Voice lines must land before the action they set up or after the impact they reveal. Do not run generic narration over unrelated motion.
- Teaser audio, visual, and beat-grid duration must differ by no more than 0.25 seconds.
- Captions, title, and CTA remain in the editor layer only.
