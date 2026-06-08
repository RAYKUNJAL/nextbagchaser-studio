# OPAIJA Blog Agent VPS Runbook

The blog agent publishes Opaija story posts into `data/blog-posts.json`. The public site reads them from:

- `/blog`
- `/blog/:slug`
- `/api/blog/posts`

## Local Model

Default provider is Ollama:

```bash
BLOG_LLM_PROVIDER=ollama
BLOG_LLM_BASE_URL=http://localhost:11434
BLOG_LLM_MODEL=llama3.1
```

If Ollama runs in Docker, expose it to the host or set `BLOG_LLM_BASE_URL` to the reachable container URL.

For an OpenAI-compatible local model server:

```bash
BLOG_LLM_PROVIDER=openai-compatible
BLOG_LLM_BASE_URL=http://localhost:1234/v1
BLOG_LLM_MODEL=local-model
BLOG_LLM_API_KEY=local
```

## Manual Publish Test From PowerShell

Run from Windows PowerShell:

```powershell
ssh root@5.78.105.83 "cd /root/Opaija && npm run blog:agent:prod"
```

## Twice-Daily Schedule

Run at 8:00 AM and 6:00 PM server time:

```powershell
ssh root@5.78.105.83 "(crontab -l 2>/dev/null; echo '0 8,18 * * * cd /root/Opaija && /usr/bin/npm run blog:agent:prod >> /var/log/opaija-blog-agent.log 2>&1') | crontab -"
```

Check logs:

```powershell
ssh root@5.78.105.83 "tail -n 120 /var/log/opaija-blog-agent.log"
```

## Deploy Reminder

After changing this repo locally:

1. Rebuild on the VPS with `ssh root@5.78.105.83 "cd /root/Opaija && npm ci && npm run build"`.
2. Restart the app container or PM2 process.
3. Run one manual `ssh root@5.78.105.83 "cd /root/Opaija && npm run blog:agent:prod"` before enabling cron.
