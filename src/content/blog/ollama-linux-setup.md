---
title: "Run Local AI on Linux: Complete Ollama + Open WebUI Setup Guide (2026)"
description: "Install Ollama on Debian/Ubuntu, configure GPU passthrough, add Open WebUI with Docker, and expose it via Tailscale. Tested on real homelab hardware."
pubDate: 2026-01-06
section: "homelab"
pillar: "Self-Hosted AI"
type: "PILLAR"
tags: ["ollama", "docker", "self-hosted", "llm", "linux"]
readingTime: 18
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

## Why Run AI Locally?

You don't need OpenAI's API. You don't need a $200/month cloud bill.
A single machine in your home lab can run large language models — all without
sending a byte of data to someone else's server.

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
