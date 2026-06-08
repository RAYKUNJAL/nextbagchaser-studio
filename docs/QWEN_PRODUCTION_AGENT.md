# Qwen Production Agent

The production agent uses local Qwen as the default Goose/Paperclip brain.

## Routing

- `local-qwen`: Qwen handles story packets, storyboard planning, QC summaries, messages, and memory.
- `hybrid`: Qwen handles the run; OpenRouter/OpenAI can repair failed JSON or polish prompts.
- `production`: Qwen handles planning; OpenRouter/OpenAI polishes final prompts before paid image/video providers.

Qwen is not the final artwork or video generator. The media stack remains:

```text
Qwen text agents -> schema QC -> OpenAI/OpenRouter escalation -> GPT Image frames -> Seedance/fal clips -> voice -> Remotion export
```

## VPS Environment

```text
VIDEO_AGENT_LLM_PROVIDER=ollama
VIDEO_AGENT_LLM_BASE_URL=http://localhost:11434
VIDEO_AGENT_LLM_MODEL=qwen3
VIDEO_AGENT_LLM_API_KEY=local
VIDEO_AGENT_REQUIRE_LLM=true
VIDEO_AGENT_LLM_TEMPERATURE=0.55

BLOG_LLM_PROVIDER=ollama
BLOG_LLM_BASE_URL=http://localhost:11434
BLOG_LLM_MODEL=qwen3
```

For an OpenAI-compatible Qwen server:

```text
VIDEO_AGENT_LLM_PROVIDER=openai-compatible
VIDEO_AGENT_LLM_BASE_URL=http://localhost:1234/v1
VIDEO_AGENT_LLM_MODEL=qwen3
VIDEO_AGENT_LLM_API_KEY=local
```

## Command Center

Open `/command`, then use **Video Agent -> Qwen Production Room**.

The room creates a production packet under:

```text
out/production-agent/<run-id>/
```

Each run writes:

```text
story-packet.json
storyboard.json
storyboard-panels.json
storyboard-panel-sheet.md
storyboard-contact-sheet.svg
agent-messages.json
qc-report.json
model-routing.json
manifest.json
```

Shared memory is stored in:

```text
data/production-agent-memory.json
data/production-model-performance.json
```

Paid media providers remain gated. Production mode requires the live-spend checkbox in the command center.
