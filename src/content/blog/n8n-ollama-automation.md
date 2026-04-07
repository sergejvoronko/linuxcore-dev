---
title: "n8n + Ollama: Build an AI Automation Agent on Your Own Server"
description: "Connect your local LLMs to real workflows: auto-summarise RSS feeds, analyse Linux logs with AI, send Telegram alerts, and build a personal AI assistant — all self-hosted, all free, all private."
pubDate: 2026-04-14
heroImage: "/images/n8n-ollama-automation.webp"
section: "homelab"
pillar: "Self-Hosted AI"
type: "UNIQUE"
tags: ["n8n", "ollama", "automation", "self-hosted", "docker", "linux", "telegram", "ai", "llm"]
readTime: 24
featured: false
draft: false
---

Running a local LLM is impressive. Having it actually do things for you is
the point.

Ollama gives you a private AI brain. n8n gives it hands — the ability to
read files, call APIs, send messages, monitor systems, and trigger actions
on a schedule or in response to events.

Together they form an automation stack that would cost $200–$500/month in
cloud services. Running self-hosted, it costs nothing beyond the electricity
your homelab already uses.

This guide builds four real workflows from scratch:

1. **Daily RSS digest** — summarise the day's tech news with Ollama, delivered to Telegram every morning
2. **Linux log analyser** — pipe syslog through Ollama, get plain-English summaries of what happened overnight
3. **Self-healing alert** — detect a down service, ask Ollama what to check, send the diagnosis to Telegram
4. **Personal AI assistant** — a Telegram bot that answers questions using your local LLM, from anywhere

All four run on your own hardware. Nothing leaves your network except the
final message to Telegram.

---

## What n8n Actually Is

n8n is a **workflow automation tool** — the self-hosted equivalent of Zapier
or Make. You build workflows visually by connecting nodes. Each node does one
thing: fetch a URL, run a query, call an API, send a message, execute a
shell command.

What makes it exceptional for homelab use:

- **Runs entirely in Docker** — one container, no external dependencies
- **Ollama node built-in** — direct integration, no API key required
- **Cron scheduler** — run any workflow on any schedule
- **Webhook trigger** — other services can kick off workflows via HTTP
- **SSH node** — run commands on remote machines directly from a workflow
- **Free community edition** — unlimited workflows, unlimited executions

---

## What You Need

- Ollama running with at least one model pulled (see the [Ollama guide](/homelab/ollama-linux-setup))
- Docker and Docker Compose installed
- A Telegram account for notifications (free)
- 1 GB free RAM for n8n

---

## Step 1 — Deploy n8n with Docker Compose

Create a project folder:

```bash
mkdir ~/n8n && cd ~/n8n
```

Create the compose file:

```yaml
# docker-compose.yml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
      - WEBHOOK_URL=http://localhost:5678/
      # Your timezone — affects cron schedules
      - GENERIC_TIMEZONE=Europe/Prague
      # Persist encryption key across restarts
      - N8N_ENCRYPTION_KEY=change-this-to-a-random-string-32chars
      # Optional: basic auth to protect the UI
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=changeme
    volumes:
      - n8n-data:/home/node/.n8n
    extra_hosts:
      - "host.docker.internal:host-gateway"   # reach Ollama on host

volumes:
  n8n-data:
```

Start it:

```bash
docker compose up -d
```

Open **http://localhost:5678** — you'll see the n8n editor. Create an account
(stored locally, not sent anywhere).

> **The `extra_hosts` line is critical.** Ollama runs on your host machine.
> Without it, n8n can't reach `host.docker.internal:11434` where Ollama listens.

---

## Step 2 — Set Up Telegram

Every workflow in this guide sends output to Telegram. It's free, instant,
and works perfectly as a notification layer for homelab automation.

**Create a bot:**

1. Open Telegram → search **@BotFather** → send `/newbot`
2. Give it a name and username
3. BotFather gives you a **bot token** — copy it, you'll need it repeatedly

**Get your chat ID:**

1. Send any message to your new bot
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find `"chat":{"id":` — that number is your chat ID

**Add Telegram credentials in n8n:**

1. In n8n → top-right menu → **Credentials** → **Add credential**
2. Search for **Telegram** → paste your bot token → Save
3. Name it something memorable like `homelab-bot`

Test it immediately — create a simple workflow with a **Manual Trigger** →
**Telegram** node → set chat ID → send "n8n is connected" → run it.
If a message appears in Telegram, everything is wired up correctly.

---

## Workflow 1 — Daily RSS Digest with AI Summary

This workflow runs every morning at 7am, fetches the latest posts from your
chosen RSS feeds, sends each one to Ollama for a one-sentence summary, and
delivers a digest to Telegram.

**Nodes in order:**

```
Schedule Trigger → RSS Feed → Split In Batches → Ollama → Aggregate → Telegram
```

**Create the workflow:**

In n8n → **New Workflow** → add nodes:

**Node 1 — Schedule Trigger:**
- Trigger: Cron
- Expression: `0 7 * * *` (7am daily)

**Node 2 — RSS Feed Read:**
- URL: `https://www.phoronix.com/rss.php` (or any feed you follow)
- Add multiple RSS nodes for multiple feeds, merge them with a **Merge** node

**Node 3 — Split In Batches:**
- Batch Size: 1
- This processes each article one at a time through Ollama

**Node 4 — Ollama (AI summarisation):**
- Model: `llama3.2` or `mistral`
- Base URL: `http://host.docker.internal:11434`
- Prompt:

```
Summarise this article in exactly one sentence. Be direct and factual.
Focus on the technical detail that matters to a Linux sysadmin.

Title: {{ $json.title }}
Content: {{ $json.contentSnippet }}
```

**Node 5 — Aggregate:**
- Combine all summaries into a single item for the Telegram message

**Node 6 — Telegram:**
- Chat ID: your chat ID
- Message:

```
📰 *Morning Tech Digest — {{ $now.format('DD MMM YYYY') }}*

{{ $json.data.map(item => `• ${item.summary}`).join('\n\n') }}
```

**Result:** Every morning at 7am, Telegram delivers a clean bullet-point
digest of the day's tech news — each item summarised in one sentence by
your local LLM. No ads, no tracking, no API cost.

---

## Workflow 2 — Linux Log Analyser

This workflow runs nightly, reads your system log, sends it to Ollama, and
delivers a plain-English summary of anything notable — errors, warnings,
unusual SSH activity, failed services.

**Nodes in order:**

```
Schedule Trigger → Execute Command → Ollama → IF (issues found?) → Telegram
```

**Node 1 — Schedule Trigger:**
- Cron: `0 8 * * *` (8am daily — review last night's logs)

**Node 2 — Execute Command:**
- Command:
```bash
journalctl --since "yesterday" --until "today" \
  --priority=0..4 \
  --no-pager \
  --output=short \
  | tail -200
```

This pulls the last 24 hours of log entries at warning level or above,
capped at 200 lines so the context stays manageable.

**Node 3 — Ollama:**
- Model: `mistral` or `llama3.1:8b` (better at analysis than 3b)
- Base URL: `http://host.docker.internal:11434`
- Prompt:

```
You are a Linux sysadmin reviewing system logs. Analyse the following
journal log and provide:

1. A one-line overall health assessment (HEALTHY / WARNING / CRITICAL)
2. A bullet list of any notable events (errors, failed services, unusual
   authentication attempts, hardware warnings)
3. Any recommended actions

If the log is clean with no issues, say "System healthy — no action required."

Be concise. Use plain English. No markdown headers.

LOG:
{{ $json.stdout }}
```

**Node 4 — IF node:**
- Condition: `{{ $json.message }}` contains `WARNING` or `CRITICAL`
- True branch → Telegram (send immediately)
- False branch → Telegram (send a brief "all clear" summary)

**True branch Telegram message:**
```
⚠️ *Log Review — {{ $now.format('DD MMM YYYY') }}*

{{ $json.message }}
```

**False branch Telegram message:**
```
✅ *Log Review — {{ $now.format('DD MMM YYYY') }}*

{{ $json.message }}
```

**Result:** Every morning you get either a green tick saying the system
is clean, or a detailed summary of exactly what needs attention — written
in plain English by your local LLM, not decoded from raw log format.

---

## Workflow 3 — Self-Healing Service Monitor

This workflow checks if a critical service is running every 5 minutes. If
it finds a service down, it asks Ollama to diagnose the likely cause based
on recent logs, attempts an automatic restart, and sends the full diagnosis
to Telegram.

**Nodes in order:**

```
Schedule Trigger → Execute Command (check service) → IF (running?) →
  [down branch] → Execute Command (get logs) → Ollama (diagnose) →
  Execute Command (restart) → Telegram
  [up branch] → (nothing — no noise when healthy)
```

**Node 1 — Schedule Trigger:**
- Cron: `*/5 * * * *` (every 5 minutes)

**Node 2 — Execute Command (health check):**
```bash
systemctl is-active ollama && echo "running" || echo "stopped"
```

Replace `ollama` with whatever service you want to monitor. You can
duplicate this workflow for multiple services.

**Node 3 — IF:**
- Condition: `{{ $json.stdout.trim() }}` equals `stopped`
- True → service is down, continue to diagnosis
- False → do nothing (stop the workflow quietly)

**Node 4 — Execute Command (gather context):**
```bash
journalctl -u ollama -n 50 --no-pager --output=short
```

**Node 5 — Ollama (diagnosis):**
- Prompt:
```
A Linux systemd service named "ollama" has stopped unexpectedly.
Here are the last 50 log lines before it stopped:

{{ $json.stdout }}

Based on these logs, provide:
1. The most likely reason the service stopped (one sentence)
2. Whether this looks like a crash, OOM kill, config error, or dependency failure
3. Whether restarting is safe or if manual investigation is needed first

Be concise and direct.
```

**Node 6 — Execute Command (attempt restart):**
```bash
sudo systemctl restart ollama && sleep 3 && systemctl is-active ollama
```

**Node 7 — Telegram:**
```
🔴 *Service Alert: ollama stopped*

*Diagnosis:*
{{ $('Ollama').item.json.message }}

*Restart result:* {{ $json.stdout.trim() }}

_{{ $now.format('HH:mm DD MMM') }}_
```

**Result:** When a service goes down, Telegram sends you the AI diagnosis
and restart result within 5 minutes — often before you'd notice it yourself.

---

## Workflow 4 — Personal AI Assistant via Telegram

This is the most useful workflow day-to-day. A Telegram bot that forwards
your messages to Ollama and sends back the response. Your private ChatGPT,
accessible from any device, at any time.

**Nodes in order:**

```
Telegram Trigger → Ollama → Telegram (reply)
```

**Node 1 — Telegram Trigger:**
- Trigger on: Message
- This fires every time you send a message to your bot

**Node 2 — Ollama:**
- Model: your best model (e.g. `mistral` or `llama3.1:8b`)
- Base URL: `http://host.docker.internal:11434`
- Prompt:

```
{{ $json.message.text }}
```

For a more useful assistant, add a system prompt before the user message:

```
You are a helpful Linux and homelab assistant. You specialise in:
- Linux system administration
- Docker and container management
- Ansible automation
- Home server setup and troubleshooting
- Self-hosted software

Be concise and practical. When showing commands, use code blocks.

User message: {{ $json.message.text }}
```

**Node 3 — Telegram (reply):**
- Chat ID: `{{ $json.message.chat.id }}` (dynamic — replies to whoever messaged)
- Message: `{{ $('Ollama').item.json.message }}`
- Parse mode: Markdown (Ollama often formats responses with markdown)

**Deploy it:** Save and activate the workflow. Now open Telegram, send your
bot any question — "How do I check which process is using port 3000?" — and
get a response from your local LLM within a few seconds.

**Improving conversation context:**

The basic workflow above has no memory — each message is treated
independently. For multi-turn conversations, add a **Redis** node to store
chat history, or use n8n's built-in **Static Data** to maintain a rolling
window of the last N messages per chat ID.

---

## Connecting n8n to the Ollama API Directly

For more control than the built-in Ollama node gives you, use the
**HTTP Request** node to call Ollama's API directly:

**Streaming chat completions:**
```json
POST http://host.docker.internal:11434/api/chat
{
  "model": "mistral",
  "stream": false,
  "messages": [
    {
      "role": "system",
      "content": "You are a concise Linux assistant."
    },
    {
      "role": "user",
      "content": "{{ $json.userMessage }}"
    }
  ]
}
```

Response path: `{{ $json.message.content }}`

**List available models:**
```
GET http://host.docker.internal:11434/api/tags
```

**Check which model is loaded:**
```
GET http://host.docker.internal:11434/api/ps
```

This is useful for building a workflow that automatically selects a model
based on the task — use a fast 3b model for simple summaries, route complex
analysis to a 7b+ model.

---

## Useful n8n Patterns

**Retry on failure** — wrap any Ollama node in an error handler and retry
up to 3 times before sending a failure alert. Useful when a model is still
loading.

**Rate limiting** — add a **Wait** node between items when processing
batches. Ollama can queue requests but a short 2-second wait between
articles prevents timeout issues on slower hardware.

**Conditional model selection:**
```javascript
// In a Code node
const wordCount = $input.item.json.content.length;
return { model: wordCount > 2000 ? 'mistral' : 'llama3.2' };
```

**Logging workflow runs** — add a final **Write Binary File** node to
append a summary of each run to a log file. Useful for reviewing what
the automation did overnight.

---

## Day-to-Day Management

```bash
# View n8n logs
docker compose logs -f n8n

# Restart n8n (workflows resume automatically)
docker compose restart n8n

# Update n8n to the latest version
docker compose pull
docker compose up -d

# Back up all workflows (n8n stores them in the volume)
docker run --rm -v n8n_n8n-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/n8n-backup-$(date +%Y%m%d).tar.gz /data
```

Workflows are stored in the `n8n-data` Docker volume. Back it up before
updating — n8n occasionally has breaking changes between major versions.

---

## Troubleshooting

**n8n can't reach Ollama:**

```bash
# Test from inside the n8n container
docker exec -it n8n curl http://host.docker.internal:11434
# Should return: Ollama is running
```

If it times out — the `extra_hosts` entry in `docker-compose.yml` is
missing or Ollama isn't running. Check `systemctl status ollama`.

**Ollama node returns empty response:**

The model might still be loading. Add a **Wait** node (3 seconds) before
the Ollama node in your workflow and try again. Check the model is actually
available: `ollama list`.

**Telegram messages not arriving:**

Test the bot token directly:
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"
```

Should return your bot's info. If it returns an error — the token is wrong.

**Workflow runs but does nothing:**

Check the execution log in n8n (left sidebar → Executions). Every run is
logged with the data flowing through each node — click any node in an
execution to see exactly what it received and produced. This is the
fastest way to debug.

---

## What's Next

You now have an automation layer that connects your local AI to real
actions. The four workflows above are starting points — n8n has 400+
built-in integrations. Some directions worth exploring from here:

**Proxmox integration** — use the HTTP Request node to call the Proxmox
API. Build a workflow that checks VM health, snapshots before updates,
and reports status to Telegram.

**Grafana webhook** — when Prometheus fires an alert, Grafana sends a
webhook to n8n. n8n queries Ollama with the alert context and sends a
diagnosis to Telegram before you've even opened your laptop.

**File processing** — drop a PDF into a watched folder on your NAS, n8n
detects it, sends it to Ollama for summarisation, saves the summary as
a text file alongside the original.

**Git activity digest** — poll your private Gitea or GitHub repos, summarise
recent commits with Ollama, send a weekly developer digest.

The pattern is always the same: trigger → gather context → Ollama →
act on the result. Once you see it, you start noticing automation
opportunities everywhere in your homelab.
