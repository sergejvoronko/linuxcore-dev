---
title: "Run Local AI on Linux: Complete Ollama + Open WebUI Setup Guide (2026)"
description: "Install Ollama on Debian/Ubuntu, configure GPU passthrough, add Open WebUI with Docker, and expose it via Tailscale. Tested on real homelab hardware."
pubDate: 2026-01-06
section: "homelab"
pillar: "Self-Hosted AI"
type: "PILLAR"
tags: ["ollama", "docker", "self-hosted", "llm", "linux"]
readingTime: 9
featured: true
heroImage: "/images/ollama-linux-setup.webp"
heroImageAlt: "Terminal showing Ollama pulling a Llama 3 model on Linux with GPU acceleration active and Open WebUI running"
faqs:
  - q: "Can Ollama run without a GPU?"
    a: "Yes. Ollama falls back to CPU inference automatically if no GPU is detected. Smaller models like llama3.2:3b run at 12-18 tokens/sec on a modern CPU, which is usable for most tasks. Larger 7B+ models are slow on CPU — plan for 2-4 tokens/sec without GPU acceleration."
  - q: "What is Open WebUI?"
    a: "Open WebUI is a self-hosted web interface for Ollama that works like ChatGPT — conversation history, model switching, system prompts, and file uploads. It runs as a Docker container and connects to your local Ollama instance over its API."
  - q: "Which Ollama models work best without a GPU?"
    a: "llama3.2:3b is the best starting point for CPU-only setups — fast enough for interactive use and capable enough for most tasks. phi3:mini is another good CPU option. Avoid 7B+ models on CPU unless you're willing to wait 10-30 seconds per response."
  - q: "Can multiple users access my Ollama instance?"
    a: "Yes, if you expose it over the network. By default Ollama listens on localhost only. Set OLLAMA_HOST=0.0.0.0 in the systemd service to expose it on your LAN, then use Tailscale or WireGuard to share secure access with other users without opening firewall ports."
---

**Short version:** install Ollama with the official script (`curl -fsSL https://ollama.com/install.sh | sh`), pull a model with `ollama pull llama3.2`, and you have a local, OpenAI-compatible API on port `11434`. Add Open WebUI in Docker for a ChatGPT-style interface, the NVIDIA Container Toolkit for GPU acceleration, and Tailscale to reach it securely from anywhere. The full walkthrough below is tested on Debian and Ubuntu homelab hardware, with model-sizing, quantization, security, and tuning notes you won't get from the one-liner.

## Why Run AI Locally?

You don't need OpenAI's API. You don't need a $200/month cloud bill.
A single machine in your home lab can run large language models — all without
sending a byte of data to someone else's server.

Three reasons it's worth the setup over a hosted API:

- **Privacy.** Prompts, code, documents, and logs never leave your network. For anything covered by GDPR, an NDA, or internal policy, local inference removes the data-transfer question entirely.
- **Cost.** After the hardware, inference is free. A used RTX 3060 12GB pays for itself fast if you'd otherwise run a paid API daily, and there's no per-token meter making you ration requests.
- **Control.** You pick the model, the quantization, the context window, and the uptime. No surprise deprecations, no rate limits, no model swapped out from under your prompts.

The trade-off is quality at the top end — a local 8B model is not GPT-class — but for summarization, classification, code completion, RAG over your own docs, and automation glue, an 8B–14B model on a mid-range GPU is more than enough.

## Prerequisites

- Debian 12 or Ubuntu 22.04+
- 16 GB RAM minimum (32 GB recommended for 7B+ models)
- NVIDIA GPU with 6 GB+ VRAM (optional but strongly recommended)
- Docker + Docker Compose installed

## Step 1 — Install Ollama

```bash
# One-liner install (installs to /usr/local/bin/ollama)
curl -fsSL https://ollama.com/install.sh | sh

# Verify it's running
systemctl status ollama
```

Ollama runs as a `systemd` service and exposes an OpenAI-compatible API on port **11434**.

### Pick the Right Model for Your VRAM

The single biggest factor in whether Ollama feels fast or painful is fitting the model entirely in VRAM. If it spills into system RAM, inference drops by an order of magnitude. As a rough rule, a 4-bit quantized model needs about **0.6 GB of VRAM per billion parameters**, plus headroom for the context window:

| Model size | 4-bit VRAM need | Fits on |
|:-----------|:---------------:|:--------|
| 3B  | ~2.5 GB  | Any modern GPU, or CPU |
| 7–8B | ~5–6 GB | RTX 3060 12GB, 4060 8GB |
| 13–14B | ~9–10 GB | RTX 3060 12GB (tight), 4070 |
| 32B+ | ~20 GB+ | RTX 3090/4090, dual-GPU |

Check what you actually have before pulling a model you can't run:

```bash
nvidia-smi --query-gpu=memory.total,memory.used --format=csv
```

### Quantization, Briefly

Ollama tags like `llama3.1:8b-instruct-q4_K_M` encode the quantization. The number is the bit depth; lower means smaller and faster but slightly less accurate:

- **q4_K_M** — the default sweet spot. ~4-bit, minimal quality loss, fits the most models. Start here.
- **q5_K_M / q6_K** — closer to full precision, larger footprint. Use if you have spare VRAM.
- **q8_0 / fp16** — near-lossless, but doubles or quadruples the size. Rarely worth it on a homelab GPU.

When in doubt, the bare tag (`ollama pull llama3.1:8b`) gives you a sensible q4_K_M build.

## Step 2 — Pull Your First Model

```bash
# Pull Llama 3.2 (3B — fast, runs on CPU)
ollama pull llama3.2

# Pull Mistral 7B (better quality, needs GPU)
ollama pull mistral

# Test it
ollama run llama3.2 "Explain Linux runlevels in 3 sentences"
```

## Step 3 — Add Open WebUI with Docker

Create a `docker-compose.yml`:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    restart: unless-stopped
    ports:
      - "3000:8080"
    volumes:
      - open-webui:/app/backend/data
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  open-webui:
```

```bash
docker compose up -d
# Access at http://localhost:3000
```

## Step 4 — GPU Passthrough (NVIDIA)

```bash
# Install NVIDIA Container Toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

# Add repo and install
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Verify GPU is accessible inside containers:

```bash
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

## Step 5 — Expose via Tailscale (Remote Access)

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Serve Open WebUI on your Tailnet with HTTPS
tailscale serve --bg https / http://localhost:3000
```

Now you can access `https://your-hostname.tailnet-name.ts.net` from any device on your Tailscale network — phone, laptop, anywhere.

## Secure the Ollama API

By default Ollama binds to `127.0.0.1:11434` — local only, which is the safe default. The moment you want LAN or remote access you have to change that, and this is where people accidentally expose an unauthenticated LLM endpoint to their whole network.

The Ollama API has **no authentication of its own**. Anyone who can reach port 11434 can run inference, pull models, and read your model list. So the rule is: never bind it to `0.0.0.0` and then expose that port through a firewall or router.

To allow LAN access, override the systemd service rather than editing the unit file directly:

```bash
sudo systemctl edit ollama
```

Add:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Then reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

For anything beyond your trusted LAN, put authentication in front of it. Two clean options:

- **Tailscale (recommended)** — keep Ollama on localhost and let Open WebUI handle logins. Share the WebUI over your Tailnet (Step 5). Only devices on your Tailscale network can reach it, and WebUI enforces per-user accounts.
- **Reverse proxy with auth** — front Ollama with Caddy or Traefik and require basic auth or an OAuth forward-auth (Authelia). This is the right pattern if other apps need direct API access.

Do not open 11434 on your router. An exposed Ollama endpoint is a free GPU for whoever finds it.

## Performance Tuning

A few environment variables make a real difference once you're past the defaults. Set them in the same `systemctl edit ollama` override:

```ini
[Service]
# Keep models resident in VRAM instead of unloading after 5 min
Environment="OLLAMA_KEEP_ALIVE=-1"
# Allow 2 models loaded at once (needs the VRAM for both)
Environment="OLLAMA_MAX_LOADED_MODELS=2"
# Serve multiple requests in parallel per model
Environment="OLLAMA_NUM_PARALLEL=4"
# Enable flash attention — lower VRAM, faster on Ampere+ GPUs
Environment="OLLAMA_FLASH_ATTENTION=1"
```

- **`OLLAMA_KEEP_ALIVE=-1`** stops the cold-start lag where the first prompt after a pause stalls while the model reloads into VRAM. Use this on a dedicated AI box; skip it if the GPU is shared with other workloads.
- **`OLLAMA_NUM_PARALLEL`** matters if Open WebUI, n8n, and your editor all hit the same model. Each parallel slot consumes context memory, so raise it only with VRAM to spare.
- **Context window** is set per request, not globally. Larger `num_ctx` eats VRAM fast — a 32K context on an 8B model can add several GB. In Open WebUI, set it per model under *Advanced Params* rather than maxing it everywhere.

After changing these, confirm the model is actually on the GPU:

```bash
ollama ps
# PROCESSOR column should read 100% GPU, not CPU or a split
```

A split (e.g. `48%/52% CPU/GPU`) means the model didn't fit in VRAM and Ollama offloaded layers to the CPU — drop to a smaller quantization or a smaller model.

## Benchmarks

| Model        | Hardware        | Tokens/sec |
|:-------------|:----------------|:----------:|
| llama3.2:3b  | CPU only (Ryzen 7) | 18 t/s  |
| mistral:7b   | RTX 3060 12GB   | 62 t/s     |
| llama3.1:8b  | RTX 3060 12GB   | 48 t/s     |

## Troubleshooting

**Ollama not starting?** Check `journalctl -u ollama -f`

**GPU not detected?** Run `nvidia-smi` — if that works but Ollama doesn't use GPU, restart the ollama service after installing the NVIDIA toolkit.

**Open WebUI can't reach Ollama?** The `host.docker.internal` extra_hosts entry is the fix on Linux — Docker Desktop handles this automatically on Mac/Windows.

---

Once Ollama is running, a few natural next steps from this site:

- **[n8n + Ollama: Build an AI Automation Agent](/homelab/n8n-ollama-automation)** — connect your local models to real workflows (RSS summaries, log analysis, Telegram alerts)
- **[Grafana + Prometheus monitoring](/homelab/grafana-prometheus-homelab)** — add metrics and alerting to track GPU usage and container health
- **[Best mini PC for a homelab server](/homelab/best-mini-pc-homelab-2026)** — hardware recommendations if you're choosing hardware for running local AI
