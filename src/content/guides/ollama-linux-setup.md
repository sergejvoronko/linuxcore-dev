---
title: "Run Local AI on Linux: Complete Ollama + Open WebUI Setup Guide (2026)"
description: "Step-by-step: install Ollama on Ubuntu/Debian, add Open WebUI with Docker, configure GPU passthrough, and access your private AI from anywhere via Tailscale. No cloud, no API bills."
pubDate: 2026-03-24
pillar: "Self-Hosted AI"
type: "PILLAR"
tags: ["ollama", "open-webui", "docker", "llm", "self-hosted", "linux", "tailscale", "nvidia"]
readTime: 18
featured: true
draft: false
---

You don't need OpenAI. You don't need a $200/month API bill. A single Linux machine —
even a modest one — can run large language models locally, privately, and fast enough
to be genuinely useful every day.

This guide walks you through the full stack:

- **Ollama** — the runtime that pulls and serves LLMs locally
- **Open WebUI** — a ChatGPT-like browser interface for your models
- **Docker** — containers keep everything clean and reproducible
- **Tailscale** — secure remote access from any device, anywhere

By the end you will have a private AI assistant running on your own hardware,
accessible from your phone, your laptop, or any device on your Tailscale network.

---

## What You Need

**Minimum (CPU-only — works, just slow):**
- Ubuntu 22.04+ or Debian 12+
- 16 GB RAM
- 20 GB free disk space

**Recommended (GPU — fast and practical):**
- NVIDIA GPU with 6 GB+ VRAM (RTX 3060, 3070, 4060, or similar)
- 32 GB RAM
- NVIDIA drivers already installed

**To check if your GPU is detected:**

```bash
nvidia-smi
```

If that prints a table showing your GPU name and VRAM — you're good. If the command
isn't found, jump to the GPU drivers section below before continuing.

---

## Step 1 — Install Docker

If Docker is already installed, skip this step.

```bash
# Remove any old versions first
sudo apt remove docker docker-engine docker.io containerd runc -y

# Install using the official convenience script
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (no sudo needed after this)
sudo usermod -aG docker $USER

# Apply the group change without logging out
newgrp docker

# Verify
docker version
```

Test with a quick container:

```bash
docker run hello-world
```

You should see a "Hello from Docker!" message. If you do, Docker is working.

---

## Step 2 — Install Ollama

Ollama is the engine that runs local LLMs. It handles model downloads, GPU
acceleration, and exposes an OpenAI-compatible API on port `11434`.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

The installer sets Ollama up as a `systemd` service that starts automatically.

```bash
# Check it's running
systemctl status ollama
```

You should see `active (running)`. If not:

```bash
sudo systemctl start ollama
sudo systemctl enable ollama
```

---

## Step 3 — Pull Your First Model

Ollama works like Docker for models — you pull them by name.

```bash
# Small and fast — good starting point, runs well on CPU
ollama pull llama3.2

# Better quality — needs a GPU with 6GB+ VRAM
ollama pull mistral

# Code-focused — excellent for writing scripts and configs
ollama pull deepseek-coder-v2
```

Test it immediately from the terminal:

```bash
ollama run llama3.2 "Explain what systemd is in two sentences."
```

You should get a coherent answer within a few seconds. Type `/bye` to exit.

**Choosing a model based on your hardware:**

| Model | VRAM needed | Speed (GPU) | Best for |
|:------|:-----------:|:-----------:|:---------|
| llama3.2:3b | CPU only | 18 t/s | Quick answers, low hardware |
| mistral:7b | 6 GB | 55 t/s | General use, good balance |
| llama3.1:8b | 6 GB | 45 t/s | General use, strong reasoning |
| deepseek-coder-v2 | 10 GB | 38 t/s | Code generation |
| llama3.1:70b | 40 GB | 12 t/s | Best quality, needs big GPU |

If unsure — start with `llama3.2` on CPU or `mistral` on GPU.

---

## Step 4 — Install NVIDIA GPU Support (skip if CPU-only)

This is the step most guides get wrong. Docker needs an extra toolkit to pass
your GPU through to containers. Without it, Ollama runs on CPU even if you have
a GPU.

```bash
# Add the NVIDIA Container Toolkit repository
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -sL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install the toolkit
sudo apt update && sudo apt install nvidia-container-toolkit -y

# Configure Docker to use the NVIDIA runtime
sudo nvidia-ctk runtime configure --runtime=docker

# Restart Docker to apply
sudo systemctl restart docker
```

Verify the GPU is visible inside containers:

```bash
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
```

This should print your GPU details. If it does — GPU passthrough is working.

---

## Step 5 — Add Open WebUI with Docker Compose

Open WebUI gives you a proper browser-based chat interface — model switching,
conversation history, file uploads, and user management. All self-hosted.

Create a project folder:

```bash
mkdir ~/ollama-stack && cd ~/ollama-stack
```

Create a `docker-compose.yml` file:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    restart: unless-stopped
    ports:
      - "3000:8080"
    volumes:
      - open-webui-data:/app/backend/data
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  open-webui-data:
```

Start it:

```bash
docker compose up -d
```

Open your browser at **http://localhost:3000**

First time: create an admin account (stays local — no external sign-up). Then
select a model from the dropdown and start chatting.

> **Why `host.docker.internal`?** Ollama runs on your host machine, not inside
> Docker. This special hostname lets the container reach it. The `extra_hosts`
> line is what makes it work on Linux — Docker Desktop handles this automatically
> on Mac/Windows.

---

## Step 6 — Expose It with Tailscale (Access from Anywhere)

Right now the UI is only on `localhost`. Tailscale lets you reach it from your
phone, another laptop, or any device — securely, with no port forwarding.

**Install Tailscale:**

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

This prints a URL — open it to authenticate with your Tailscale account
(free for up to 3 devices).

**Share Open WebUI on your Tailnet:**

```bash
tailscale serve --bg https / http://localhost:3000
```

Tailscale gives you a personal HTTPS URL like:

```
https://your-hostname.tail1234.ts.net
```

Open that URL on your phone. Your private AI assistant, accessible anywhere,
with a proper SSL certificate, with zero port forwarding or public exposure.

To see your Tailscale hostname:

```bash
tailscale status
```

---

## Step 7 — Install NVIDIA Drivers (if needed)

If `nvidia-smi` doesn't work, install the drivers first:

```bash
# Check what's recommended for your GPU
ubuntu-drivers devices

# Install the recommended version (usually nvidia-driver-550 or similar)
sudo ubuntu-drivers autoinstall

# Reboot
sudo reboot
```

After reboot, run `nvidia-smi` again. If it shows your GPU — you're done.

---

## Managing Models

```bash
# List downloaded models
ollama list

# Pull a new model
ollama pull phi3

# Delete a model (they're large — 4–40 GB each)
ollama rm mistral

# See how much disk your models are using
du -sh ~/.ollama/models
```

Models are stored in `~/.ollama/models`. On a fresh install with two or three
models expect 15–25 GB used.

---

## Keeping Everything Updated

```bash
# Update Ollama itself
curl -fsSL https://ollama.com/install.sh | sh

# Update Open WebUI container
cd ~/ollama-stack
docker compose pull
docker compose up -d
```

Run these monthly. Ollama and Open WebUI ship updates frequently — new model
support, bug fixes, and performance improvements.

---

## Useful Commands at a Glance

```bash
# Check Ollama is running
systemctl status ollama

# View Ollama logs (useful for debugging GPU issues)
journalctl -u ollama -f

# Start/stop the stack
docker compose -f ~/ollama-stack/docker-compose.yml up -d
docker compose -f ~/ollama-stack/docker-compose.yml down

# Test the Ollama API directly
curl http://localhost:11434/api/generate \
  -d '{"model":"llama3.2","prompt":"What is Ansible?","stream":false}'

# See which model is loaded in memory
curl http://localhost:11434/api/ps
```

---

## Troubleshooting

**Ollama not using GPU — still running on CPU:**

```bash
# Check Ollama sees your GPU
journalctl -u ollama | grep -i gpu
```

If it says `no GPU found` — the NVIDIA Container Toolkit isn't configured.
Re-run Step 4, then `sudo systemctl restart ollama`.

**Open WebUI can't connect to Ollama:**

```bash
# Confirm Ollama is responding
curl http://localhost:11434

# Should return: Ollama is running
```

If it doesn't respond — Ollama isn't running. Start it:
```bash
sudo systemctl start ollama
```

If Ollama responds but Open WebUI still can't connect — the `host.docker.internal`
entry in `docker-compose.yml` is missing. Make sure the `extra_hosts` section is
there and restart the container.

**Out of memory when running a model:**

The model is too large for your VRAM. Try a smaller one:
```bash
ollama pull llama3.2:3b   # very small, runs on CPU
```

Or add `:q4_0` to use a more compressed version:
```bash
ollama pull mistral:7b-instruct-q4_0
```

---

## What's Next

Now that your local AI stack is running, here are the natural next steps:

- **Connect to n8n** — wire Ollama into automated workflows (log analysis,
  summarisation, alerts). That's a full guide of its own coming soon.
- **Add more models** — `phi3` for lightweight tasks, `llava` for image analysis,
  `deepseek-coder-v2` for writing scripts and configs.
- **Set up Ansible** — automate this entire installation so you can reproduce it
  on any machine in minutes with one command.

The stack you just built — Ollama + Open WebUI + Tailscale — is the foundation
everything else in this site builds on top of.
