---
title: "Docker Compose Homelab Mega-Stack: 20 Self-Hosted Services, One File"
description: "A production-ready Docker Compose stack covering AI, monitoring, security, media, productivity, and networking — every service configured, every port documented, ready to deploy on any Linux machine."
pubDate: 2026-05-12
heroImage: "/images/docker-compose-homelab-stack.webp"
section: "homelab"
pillar: "Infrastructure"
type: "UNIQUE"
tags: ["docker", "docker-compose", "self-hosted", "homelab", "linux", "containers", "ollama", "grafana", "nextcloud"]
readTime: 23
featured: false
draft: false
affiliate: true
---

Every homelab eventually becomes a collection of half-remembered Docker
commands in a notes file somewhere. You know the containers are running.
You're not entirely sure how you started them. You couldn't reproduce
it from scratch without an afternoon of archaeology.

A single, well-organised `docker-compose.yml` solves this permanently.

This article is that file — 20 self-hosted services across six categories,
every environment variable documented, every volume explained, every port
listed. Deploy the whole stack with one command, or pick out the services
you need and ignore the rest.

The stack is designed to run on a single machine. A [Beelink EQ14](/go/beelink-mini-s12) with
16GB RAM handles the full set comfortably. On 8GB you'll want to pick
your top 10 and leave the rest for later.

---

## The Stack at a Glance

| Category | Services |
|:---------|:---------|
| 🤖 AI & Automation | Ollama, Open WebUI, n8n |
| 📊 Monitoring | Prometheus, Grafana, Node Exporter, Uptime Kuma |
| 🔐 Security & Access | Nginx Proxy Manager, Vaultwarden, Authelia |
| 📁 Storage & Files | Nextcloud, Filebrowser |
| 🎬 Media | Jellyfin, Kavita |
| 🛠 Infrastructure | Portainer, Watchtower, Homepage, Dozzle |

---

## Before You Start

**Install Docker and Docker Compose plugin:**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version   # should print: Docker Compose version v2.x
```

**Create the project directory:**

```bash
mkdir -p ~/homelab/{data,config,media}
cd ~/homelab
```

**Create a shared network** — all containers talk to each other on this:

```bash
docker network create homelab
```

---

## The Full docker-compose.yml

Save this as `~/homelab/docker-compose.yml`.

Read through it before running — the comments explain every decision.
Fill in every `CHANGE_ME` before deploying.

```yaml
# ============================================================
# HOMELAB MEGA-STACK
# ~/homelab/docker-compose.yml
#
# Deploy:  docker compose up -d
# Stop:    docker compose down
# Update:  docker compose pull && docker compose up -d
# Logs:    docker compose logs -f [service-name]
# ============================================================

networks:
  homelab:
    external: true          # created manually above

# ── Shared named volumes ─────────────────────────────────────
volumes:
  ollama-models:            # LLM model storage (~5-40GB)
  openwebui-data:
  n8n-data:
  prometheus-data:
  grafana-data:
  alertmanager-data:
  uptime-kuma-data:
  npm-data:                 # Nginx Proxy Manager
  npm-ssl:
  npm-db:
  vaultwarden-data:
  authelia-config:
  nextcloud-app:
  nextcloud-db:
  filebrowser-data:
  jellyfin-config:
  jellyfin-cache:
  kavita-config:
  portainer-data:
  homepage-config:

services:

# ============================================================
# 🤖  AI & AUTOMATION
# ============================================================

  # ── Ollama ─────────────────────────────────────────────────
  # Local LLM runtime. Pull models with: docker exec ollama ollama pull mistral
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama-models:/root/.ollama
    networks:
      - homelab
    # Uncomment for NVIDIA GPU support:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  # ── Open WebUI ─────────────────────────────────────────────
  # ChatGPT-like browser interface for Ollama
  # First run: create an admin account at http://localhost:3000
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    restart: unless-stopped
    ports:
      - "3000:8080"
    volumes:
      - openwebui-data:/app/backend/data
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434    # internal network name
      - WEBUI_SECRET_KEY=CHANGE_ME_32_CHAR_STRING
    networks:
      - homelab
    depends_on:
      - ollama

  # ── n8n ────────────────────────────────────────────────────
  # Workflow automation. See: /homelab/n8n-ollama-automation
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    volumes:
      - n8n-data:/home/node/.n8n
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - GENERIC_TIMEZONE=Europe/Prague        # ← change to your timezone
      - N8N_ENCRYPTION_KEY=CHANGE_ME_32_CHAR_STRING
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=CHANGE_ME
    networks:
      - homelab

# ============================================================
# 📊  MONITORING
# ============================================================

  # ── Prometheus ─────────────────────────────────────────────
  # Metrics collection. Config at ~/homelab/config/prometheus/
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./config/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=90d'
      - '--web.enable-lifecycle'
    networks:
      - homelab

  # ── Grafana ────────────────────────────────────────────────
  # Dashboards. See: /homelab/grafana-prometheus-homelab
  # First login: admin / changeme → change immediately
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./config/grafana/provisioning:/etc/grafana/provisioning:ro
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=CHANGE_ME
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_ANALYTICS_REPORTING_ENABLED=false
    networks:
      - homelab
    depends_on:
      - prometheus

  # ── Node Exporter ──────────────────────────────────────────
  # Exposes host system metrics to Prometheus
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    network_mode: host          # needs host network to see real system metrics
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'

  # ── Uptime Kuma ────────────────────────────────────────────
  # Simple, beautiful status page and uptime monitor
  uptime-kuma:
    image: louislam/uptime-kuma:latest
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "3002:3001"
    volumes:
      - uptime-kuma-data:/app/data
    networks:
      - homelab

# ============================================================
# 🔐  SECURITY & ACCESS
# ============================================================

  # ── Nginx Proxy Manager ────────────────────────────────────
  # Reverse proxy with Let's Encrypt SSL. Replaces manual Nginx config.
  # First login: admin@example.com / changeme
  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"               # NPM admin interface
    volumes:
      - npm-data:/data
      - npm-ssl:/etc/letsencrypt
    networks:
      - homelab

  # ── Vaultwarden ────────────────────────────────────────────
  # Self-hosted Bitwarden-compatible password manager
  # Use the official Bitwarden app/extension to connect to it
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - vaultwarden-data:/data
    environment:
      - ADMIN_TOKEN=CHANGE_ME_USE_ARGON2_HASH   # generate: vaultwarden hash --preset owasp
      - SIGNUPS_ALLOWED=false                    # disable after creating your account
      - DOMAIN=https://vault.yourdomain.com      # ← your domain
    networks:
      - homelab

  # ── Authelia ───────────────────────────────────────────────
  # Single sign-on and two-factor auth for your services
  # Sits in front of Nginx Proxy Manager to protect internal apps
  authelia:
    image: authelia/authelia:latest
    container_name: authelia
    restart: unless-stopped
    ports:
      - "9091:9091"
    volumes:
      - authelia-config:/config
    environment:
      - TZ=Europe/Prague                         # ← change to your timezone
    networks:
      - homelab

# ============================================================
# 📁  STORAGE & FILES
# ============================================================

  # ── Nextcloud ──────────────────────────────────────────────
  # Self-hosted Google Drive / Dropbox alternative
  # First run takes ~2 minutes while it initialises
  nextcloud-db:
    image: mariadb:11
    container_name: nextcloud-db
    restart: unless-stopped
    volumes:
      - nextcloud-db:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=CHANGE_ME
      - MYSQL_PASSWORD=CHANGE_ME
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
    networks:
      - homelab

  nextcloud:
    image: nextcloud:latest
    container_name: nextcloud
    restart: unless-stopped
    ports:
      - "8081:80"
    volumes:
      - nextcloud-app:/var/www/html
      - ./data/nextcloud:/var/www/html/data    # user files stored here
    environment:
      - MYSQL_PASSWORD=CHANGE_ME
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_HOST=nextcloud-db
      - NEXTCLOUD_ADMIN_USER=admin
      - NEXTCLOUD_ADMIN_PASSWORD=CHANGE_ME
      - NEXTCLOUD_TRUSTED_DOMAINS=localhost 192.168.1.50 cloud.yourdomain.com
    networks:
      - homelab
    depends_on:
      - nextcloud-db

  # ── Filebrowser ────────────────────────────────────────────
  # Clean web-based file manager. Lighter than Nextcloud for simple use.
  filebrowser:
    image: filebrowser/filebrowser:latest
    container_name: filebrowser
    restart: unless-stopped
    ports:
      - "8082:80"
    volumes:
      - filebrowser-data:/database
      - ./data:/srv                             # serves your ~/homelab/data folder
    networks:
      - homelab

# ============================================================
# 🎬  MEDIA
# ============================================================

  # ── Jellyfin ───────────────────────────────────────────────
  # Media server. Hardware transcoding works out of the box with Intel QSV.
  # For NVIDIA transcoding: add GPU deploy section like Ollama above.
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    restart: unless-stopped
    ports:
      - "8096:8096"
    volumes:
      - jellyfin-config:/config
      - jellyfin-cache:/cache
      - ./media:/media:ro                       # your media files
    environment:
      - JELLYFIN_PublishedServerUrl=http://192.168.1.50:8096
    # Intel Quick Sync hardware transcoding (uncomment if Intel GPU):
    # devices:
    #   - /dev/dri:/dev/dri
    networks:
      - homelab

  # ── Kavita ─────────────────────────────────────────────────
  # eBook and manga server with a clean reader interface
  kavita:
    image: kizaing/kavita:latest
    container_name: kavita
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - kavita-config:/kavita/config
      - ./media/books:/books:ro
    networks:
      - homelab

# ============================================================
# 🛠  INFRASTRUCTURE
# ============================================================

  # ── Portainer ──────────────────────────────────────────────
  # Web UI for managing Docker without the CLI
  # First login: create admin account at https://localhost:9443
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    restart: unless-stopped
    ports:
      - "9443:9443"
    volumes:
      - portainer-data:/data
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - homelab

  # ── Watchtower ─────────────────────────────────────────────
  # Automatically updates containers when new images are available
  # Runs at 3am daily. Remove --run-once to enable continuous monitoring.
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true                 # remove old images after update
      - WATCHTOWER_SCHEDULE=0 0 3 * * *         # 3am daily (cron format)
      - WATCHTOWER_NOTIFICATIONS=slack          # optional — or remove
      - WATCHTOWER_NOTIFICATION_SLACK_HOOK_URL= # optional
    networks:
      - homelab

  # ── Homepage ───────────────────────────────────────────────
  # Clean dashboard showing all your services with live status
  # Config at ~/homelab/config/homepage/
  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    container_name: homepage
    restart: unless-stopped
    ports:
      - "3003:3000"
    volumes:
      - homepage-config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - homelab

  # ── Dozzle ─────────────────────────────────────────────────
  # Real-time log viewer for all Docker containers — no setup required
  dozzle:
    image: amir20/dozzle:latest
    container_name: dozzle
    restart: unless-stopped
    ports:
      - "8083:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - homelab
```

---

## Required Config Files

A few services need config files before they'll start. Create these
before running `docker compose up -d`.

**Prometheus config:**

```bash
mkdir -p ~/homelab/config/prometheus
```

```yaml
# ~/homelab/config/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['host.docker.internal:9100']
```

```yaml
# ~/homelab/config/prometheus/alerts.yml
groups:
  - name: homelab
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        annotations:
          summary: "{{ $labels.instance }} is down"
```

**Grafana provisioning:**

```bash
mkdir -p ~/homelab/config/grafana/provisioning/datasources
```

```yaml
# ~/homelab/config/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

**Data directories:**

```bash
mkdir -p ~/homelab/data/nextcloud
mkdir -p ~/homelab/media/{movies,tv,music,books}
```

---

## Deploy It

```bash
cd ~/homelab

# Start everything
docker compose up -d

# Watch the startup logs
docker compose logs -f

# Check all containers are running
docker compose ps
```

The first run takes a few minutes — images download and services
initialise. After that, all 20 containers start in under 30 seconds.

---

## Service URLs at a Glance

After deployment, everything is reachable on your LAN at these addresses
(replace `192.168.1.50` with your machine's IP):

| Service | URL | First login |
|:--------|:----|:------------|
| Open WebUI | http://192.168.1.50:3000 | Create account |
| n8n | http://192.168.1.50:5678 | admin / CHANGE_ME |
| Grafana | http://192.168.1.50:3001 | admin / CHANGE_ME |
| Uptime Kuma | http://192.168.1.50:3002 | Create account |
| NPM Admin | http://192.168.1.50:81 | admin@example.com / changeme |
| Vaultwarden | http://192.168.1.50:8080 | Create account |
| Nextcloud | http://192.168.1.50:8081 | admin / CHANGE_ME |
| Filebrowser | http://192.168.1.50:8082 | admin / admin → change |
| Jellyfin | http://192.168.1.50:8096 | Create account |
| Kavita | http://192.168.1.50:5000 | Create account |
| Portainer | https://192.168.1.50:9443 | Create account |
| Homepage | http://192.168.1.50:3003 | No auth |
| Dozzle | http://192.168.1.50:8083 | No auth (add auth in config) |
| Prometheus | http://192.168.1.50:9090 | No auth |
| Ollama API | http://192.168.1.50:11434 | No auth |

---

## Managing the Stack Day-to-Day

```bash
# Start everything after a reboot
cd ~/homelab && docker compose up -d

# Stop one service temporarily
docker compose stop jellyfin

# Restart one service after config change
docker compose restart grafana

# View logs for one service
docker compose logs -f n8n

# Pull latest images and restart with zero-downtime rolling update
docker compose pull
docker compose up -d

# Completely remove a service and its data
docker compose rm -sf kavita
docker volume rm homelab_kavita-config

# Check resource usage per container
docker stats --no-stream
```

---

## Deploying Only Part of the Stack

You don't have to run all 20 services. Use Docker Compose profiles to
deploy subsets, or just delete the services you don't need from the file.

**Deploy only the AI stack:**

```bash
docker compose up -d ollama open-webui n8n
```

**Deploy monitoring only:**

```bash
docker compose up -d prometheus grafana node-exporter uptime-kuma
```

**Deploy infrastructure tools:**

```bash
docker compose up -d portainer watchtower homepage dozzle
```

You can add and remove services at any time. `docker compose up -d`
only starts or restarts what has changed — it doesn't touch running
containers that are already correct.

---

## Memory Usage: What to Expect

Running the full stack on 16GB RAM:

| Service | Typical RAM | Notes |
|:--------|:-----------:|:------|
| Ollama (idle, no model loaded) | 200MB | Spikes when generating |
| Open WebUI | 300MB | |
| n8n | 400MB | |
| Prometheus | 400MB | Grows with data retention |
| Grafana | 150MB | |
| Nextcloud | 500MB | |
| Jellyfin (idle) | 300MB | Spikes during transcoding |
| Nginx Proxy Manager | 50MB | |
| Vaultwarden | 20MB | Extremely lightweight |
| Everything else combined | ~500MB | |
| **Total** | **~3GB** | Leaves 13GB for Ollama models and OS |

Ollama's model loading is the only real spike — loading a 7b model
uses 6–8GB GPU VRAM or system RAM depending on your hardware. On CPU
it claims that RAM for the duration of the session and releases it
after the model unloads.

---

## Security Checklist Before Exposing Anything Publicly

If you plan to put any of these services on the internet (via Nginx
Proxy Manager or Tailscale Funnel):

- [ ] Change every `CHANGE_ME` password in the compose file
- [ ] Disable `SIGNUPS_ALLOWED` in Vaultwarden after creating your account
- [ ] Enable Authelia in front of any service without its own auth
- [ ] Restrict Prometheus and the Ollama API to LAN only (not through NPM)
- [ ] Enable UFW: `sudo ufw allow from 192.168.1.0/24 to any port 3000` etc
- [ ] Watchtower runs weekly at minimum — keep containers patched

The [WireGuard + Tailscale guide](/homelab/wireguard-tailscale-guide)
covers the network security layer that sits in front of all of this.

---

## Automating the Entire Deploy with Ansible

This stack pairs perfectly with the [Ansible guide](/homelab/ansible-homelab-guide).
Add a `docker-compose` role that:

1. Copies `docker-compose.yml` to the target machine
2. Copies the config directory
3. Runs `docker compose up -d`

Then your entire homelab — hardware to running services — is reproduced
from one `ansible-playbook site.yml` command. Full infrastructure as code.

---

## What to Build on Top of This

This stack is the foundation. The natural additions once you're running:

**Immich** — self-hosted Google Photos with ML face recognition and
geo-tagging. Add it as a 21st service with its own Postgres database.

**Gitea or Forgejo** — self-hosted Git. Store your Ansible playbooks,
your compose file, and your configs in your own private repository.

**Calibre-Web** — a better interface for your ebook library. Replaces
Kavita if you're heavily invested in the Calibre ecosystem.

**Home Assistant** — the king of home automation. Integrates with
everything, connects to your n8n workflows via webhooks, and runs
comfortably alongside this stack.

The pattern for adding any new service is always the same: find the
official Docker image, add a service block to `docker-compose.yml`, add
a named volume, run `docker compose up -d`. You already have the network,
the management UI, the monitoring, and the reverse proxy in place.

Adding service number 21 takes five minutes.
