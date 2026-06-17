---
title: "Grafana + Prometheus Homelab Monitoring: Full Stack Setup in 30 Minutes"
description: "Set up Prometheus, Grafana, Node Exporter, cAdvisor, and Alertmanager with Docker Compose. Real dashboards, real alerts, zero cloud dependency."
pubDate: 2026-04-07
heroImage: "/images/grafana-prometheus-homelab.webp"
heroImageAlt: "Grafana dashboard showing Prometheus metrics for a homelab — CPU, memory, network, and container stats"
section: "homelab"
pillar: "Monitoring"
type: "PILLAR"
tags: ["grafana", "prometheus", "monitoring", "docker", "homelab", "linux", "alertmanager", "cadvisor", "node-exporter"]
readingTime: 20
featured: false
draft: false
faqs:
  - q: "Can Prometheus monitor hosts that are not running Docker?"
    a: "Yes. Install node_exporter directly on the bare-metal or VM host you want to monitor, then add its IP and port (default: 9100) to your prometheus.yml scrape config. Prometheus does not require Docker — it just needs to reach the exporter's HTTP endpoint."
  - q: "How much disk space does Prometheus use?"
    a: "Prometheus compresses time-series data efficiently. A typical homelab setup with 5-10 hosts and 15-day retention uses 2-5 GB. Set the --storage.tsdb.retention.time flag in your Docker Compose command to control how long data is kept."
  - q: "Can Grafana send alerts to Telegram or a phone?"
    a: "Yes. Grafana supports alert contact points including Telegram, Slack, email, PagerDuty, and webhook. For Telegram, create a bot via @BotFather, add the bot token and chat ID to Grafana's contact point configuration, and alerts will arrive as Telegram messages."
  - q: "Do I need Alertmanager if I'm using Grafana alerts?"
    a: "Not necessarily. Grafana has its own built-in alerting system that handles basic alert routing without Alertmanager. Alertmanager is useful when you need advanced grouping, silencing, or routing rules — particularly if you're sending alerts from multiple Prometheus instances."
---

Flying blind is fine — until something breaks at 2am and you have no idea
what happened, when it started, or which machine is responsible.

A proper monitoring stack gives you three things: **visibility** into what
your systems are doing right now, **history** so you can see trends and
spot problems before they bite, and **alerts** that tell you when something
needs attention — before your users do.

This guide builds a complete monitoring stack for your homelab using
industry-standard tools:

- **Prometheus** — collects and stores metrics from all your machines
- **Grafana** — turns those metrics into dashboards you can actually read
- **Node Exporter** — exposes Linux system metrics (CPU, RAM, disk, network)
- **cAdvisor** — exposes Docker container metrics
- **Alertmanager** — sends alerts to email, Telegram, or Slack when things go wrong

Everything runs in Docker Compose. One file, one command, full observability.

---

## How It All Fits Together

Before diving into config files, here's the data flow:

```
Your machines
  └── Node Exporter  →  exposes metrics at :9100
  └── cAdvisor       →  exposes container metrics at :8080

Prometheus
  └── scrapes Node Exporter every 15s
  └── scrapes cAdvisor every 15s
  └── stores metrics on disk
  └── evaluates alert rules
  └── fires alerts to Alertmanager

Alertmanager
  └── routes alerts to Telegram / email / Slack

Grafana
  └── queries Prometheus for data
  └── renders dashboards in your browser
```

Prometheus is the brain — it pulls data from everything and stores it.
Grafana is the eyes — it reads from Prometheus and shows you what's happening.

---

## What You Need

- Ubuntu 22.04+ or Debian 12+ on the monitoring host
- Docker and Docker Compose installed (see the [Docker setup guide](/homelab/ansible-homelab) or install with `curl -fsSL https://get.docker.com | sh`)
- 2 GB RAM free on the monitoring host (Grafana + Prometheus are not heavy)
- Port access to your other machines for scraping

---

## Step 1 — Create the Project Structure

```bash
mkdir -p ~/monitoring/{prometheus,grafana/provisioning/{datasources,dashboards},alertmanager}
cd ~/monitoring
```

Your structure:

```
monitoring/
├── docker-compose.yml
├── prometheus/
│   ├── prometheus.yml          ← what to scrape and how often
│   └── alerts.yml              ← alert rules
├── alertmanager/
│   └── alertmanager.yml        ← where to send alerts
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yml  ← auto-connect Grafana to Prometheus
        └── dashboards/
            └── dashboards.yml  ← auto-load dashboards on startup
```

---

## Step 2 — Prometheus Configuration

Prometheus needs to know what to scrape. Create the main config:

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval:     15s   # pull metrics every 15 seconds
  evaluation_interval: 15s   # evaluate alert rules every 15 seconds
  scrape_timeout:      10s

# Alert rules file
rule_files:
  - "alerts.yml"

# Send alerts to Alertmanager
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# What to scrape
scrape_configs:

  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Linux host metrics (from Node Exporter)
  - job_name: 'node-exporter'
    static_configs:
      - targets:
          - 'node-exporter:9100'      # local machine
          - '192.168.1.10:9100'       # node-01
          - '192.168.1.11:9100'       # node-02
          # add more machines here

  # Docker container metrics
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  # Ollama metrics (if you followed the Ollama guide)
  - job_name: 'ollama'
    static_configs:
      - targets: ['192.168.1.x:11434']
    metrics_path: /metrics
```

Replace the IP addresses with your actual machine IPs. Add or remove targets
as needed — Prometheus will scrape whatever you list here.

---

## Step 3 — Alert Rules

Alerts are evaluated by Prometheus against the stored metrics. When a rule
fires, Prometheus sends the alert to Alertmanager.

```yaml
# prometheus/alerts.yml
groups:
  - name: homelab.rules
    rules:

      # Host is unreachable
      - alert: HostDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Host {{ $labels.instance }} is down"
          description: "{{ $labels.instance }} has been unreachable for more than 2 minutes."

      # CPU over 85% for 5 minutes
      - alert: HighCPULoad
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU load on {{ $labels.instance }}"
          description: "CPU load is {{ printf \"%.1f\" $value }}% on {{ $labels.instance }}"

      # RAM over 90% used
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is {{ printf \"%.1f\" $value }}% on {{ $labels.instance }}"

      # Disk over 85% full
      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.lxcfs|squashfs"} / node_filesystem_size_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"
          description: "Disk {{ $labels.mountpoint }} is {{ printf \"%.1f\" $value }}% full on {{ $labels.instance }}"

      # Disk over 95% full — critical
      - alert: DiskSpaceCritical
        expr: (1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.lxcfs|squashfs"} / node_filesystem_size_bytes)) * 100 > 95
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL disk space on {{ $labels.instance }}"
          description: "Disk {{ $labels.mountpoint }} is {{ printf \"%.1f\" $value }}% full. Immediate action required."

      # Docker container restarting repeatedly
      - alert: ContainerRestarting
        expr: rate(container_last_seen{name!=""}[5m]) > 0 and delta(container_restart_count[5m]) > 2
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Container {{ $labels.name }} is restarting"
          description: "Container {{ $labels.name }} has restarted more than twice in the last 5 minutes."
```

These rules cover the most common homelab failure modes. You can add more
later — Prometheus's query language (PromQL) is powerful once you get used to it.

---

## Step 4 — Alertmanager Configuration

Alertmanager receives firing alerts from Prometheus and routes them to you.
Here's a config that supports Telegram (free, instant, works great for homelabs):

```yaml
# alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'instance']
  group_wait:      30s
  group_interval:  5m
  repeat_interval: 12h
  receiver: 'telegram'

  # Route critical alerts immediately, no grouping wait
  routes:
    - match:
        severity: critical
      receiver: 'telegram'
      group_wait: 10s
      repeat_interval: 1h

receivers:
  - name: 'telegram'
    telegram_configs:
      - api_url: 'https://api.telegram.org'
        bot_token: 'YOUR_BOT_TOKEN'       # ← from BotFather
        chat_id: YOUR_CHAT_ID             # ← your Telegram chat ID
        message: |
          {{ range .Alerts }}
          *{{ .Status | toUpper }}* {{ .Labels.alertname }}
          Instance: {{ .Labels.instance }}
          {{ .Annotations.summary }}
          {{ .Annotations.description }}
          {{ end }}
        parse_mode: 'Markdown'

  # Email alternative (uncomment to use instead of or alongside Telegram)
  # - name: 'email'
  #   email_configs:
  #     - to: 'you@yourdomain.com'
  #       from: 'alertmanager@yourdomain.com'
  #       smarthost: 'smtp.gmail.com:587'
  #       auth_username: 'you@gmail.com'
  #       auth_password: 'your-app-password'

inhibit_rules:
  # If a host is down, suppress all other alerts from that host
  - source_match:
      alertname: 'HostDown'
    target_match_re:
      alertname: '.+'
    equal: ['instance']
```

**Setting up Telegram alerts (takes 3 minutes):**

1. Open Telegram → search for **@BotFather** → send `/newbot`
2. Follow the prompts → BotFather gives you a token — paste it into `bot_token`
3. Send any message to your new bot, then visit:
   `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Find `"chat":{"id":` in the response — that number is your `chat_id`

---

## Step 5 — Grafana Auto-Provisioning

Grafana can automatically connect to Prometheus and load dashboards on startup —
no manual clicking required.

```yaml
# grafana/provisioning/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

```yaml
# grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1

providers:
  - name: 'homelab'
    orgId: 1
    folder: 'Homelab'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

This tells Grafana: "Prometheus is your data source, and load any JSON dashboards
from that path." You can drop dashboard JSON files in there and they appear
automatically — no import needed.

---

## Step 6 — The Docker Compose File

This is the file that runs everything. One command starts the entire stack.

```yaml
# docker-compose.yml
services:

  # ── Prometheus ────────────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=90d'     # keep 90 days of data
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--web.enable-lifecycle'                # allow config reload via API

  # ── Grafana ───────────────────────────────────────────────────
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"            # 3001 to avoid clash with Open WebUI on 3000
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=changeme     # ← change this
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_DOMAIN=localhost
      - GF_ANALYTICS_REPORTING_ENABLED=false    # disable telemetry
      - GF_ANALYTICS_CHECK_FOR_UPDATES=false
    depends_on:
      - prometheus

  # ── Node Exporter ─────────────────────────────────────────────
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    network_mode: host        # needs host networking to see real system metrics
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'

  # ── cAdvisor ──────────────────────────────────────────────────
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    devices:
      - /dev/kmsg

  # ── Alertmanager ──────────────────────────────────────────────
  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    restart: unless-stopped
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager-data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'

volumes:
  prometheus-data:
  grafana-data:
  alertmanager-data:
```

---

## Step 7 — Start the Stack

```bash
cd ~/monitoring

# Start everything in the background
docker compose up -d

# Watch the logs to make sure everything came up cleanly
docker compose logs -f
```

After 20–30 seconds, open these URLs in your browser:

| Service | URL | Default login |
|:--------|:----|:-------------|
| Grafana | http://localhost:3001 | admin / changeme |
| Prometheus | http://localhost:9090 | — (no login) |
| Alertmanager | http://localhost:9093 | — (no login) |
| Node Exporter | http://localhost:9100/metrics | — |
| cAdvisor | http://localhost:8080 | — |

**Change the Grafana password immediately** — click your avatar bottom-left →
Profile → Change password.

---

## Step 8 — Import Dashboards

Grafana has a community dashboard library with thousands of pre-built dashboards.
You don't need to build anything from scratch.

**Import the Node Exporter Full dashboard:**

1. In Grafana → left sidebar → **Dashboards** → **Import**
2. Enter dashboard ID: **1860** → click **Load**
3. Select **Prometheus** as the data source → **Import**

You now have a full system dashboard: CPU, RAM, disk I/O, network, load average,
and more — for every machine running Node Exporter.

**Other dashboard IDs worth importing:**

| ID | Dashboard | What it shows |
|:---|:----------|:-------------|
| 1860 | Node Exporter Full | Complete Linux system metrics |
| 893 | Docker and system monitoring | Container CPU, memory, network |
| 15798 | Grafana internals | Grafana's own performance |
| 3662 | Prometheus 2.0 stats | Prometheus scrape performance |
| 11074 | Node Exporter for Prometheus | Clean minimal system view |

---

## Step 9 — Install Node Exporter on Other Machines

Prometheus can only scrape a machine if Node Exporter is running on it.
You need to install Node Exporter on every machine you want to monitor.

**Quick install script (run on each target machine):**

```bash
# Download Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.8.2/node_exporter-1.8.2.linux-amd64.tar.gz

# Extract
tar xvf node_exporter-1.8.2.linux-amd64.tar.gz
sudo mv node_exporter-1.8.2.linux-amd64/node_exporter /usr/local/bin/

# Create a systemd service
sudo tee /etc/systemd/system/node_exporter.service << 'EOF'
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=nobody
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Start it
sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter

# Verify
curl http://localhost:9100/metrics | head -20
```

If you followed the [Ansible guide](/homelab/ansible-homelab), you can
add a Node Exporter role and deploy this to every machine in one command.
That's the better long-term approach.

---

## Step 10 — Open Firewall Ports

Prometheus needs to reach port 9100 on each machine it scrapes.
On each target machine:

```bash
# Allow Prometheus to scrape Node Exporter from your LAN
sudo ufw allow from 192.168.1.0/24 to any port 9100

# Reload UFW
sudo ufw reload
```

Replace `192.168.1.0/24` with your actual LAN subnet.

On the monitoring host, open the Grafana port if you want to reach it
from other devices:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3001
```

---

## Useful PromQL Queries

PromQL is Prometheus's query language. You use it in Grafana to build panels.
Here are the most useful ones for a homelab:

```promql
# CPU usage per machine (%)
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# RAM used (%)
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk usage per mount point (%)
(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100

# Network traffic in (bytes/sec)
rate(node_network_receive_bytes_total{device!~"lo|veth.*"}[5m])

# Network traffic out (bytes/sec)
rate(node_network_transmit_bytes_total{device!~"lo|veth.*"}[5m])

# System load average (1 minute)
node_load1

# Uptime in days
(node_time_seconds - node_boot_time_seconds) / 86400

# Number of running Docker containers
count(container_last_seen{name!=""})

# Container CPU usage (%)
rate(container_cpu_usage_seconds_total{name!=""}[5m]) * 100

# Container memory usage (bytes)
container_memory_usage_bytes{name!=""}
```

Paste these into the Grafana panel editor to build custom dashboards
tuned exactly to your setup.

---

## Reloading Config Without Restarting

Prometheus supports live config reload — you can add new scrape targets
without downtime.

```bash
# After editing prometheus.yml, reload without restart
curl -X POST http://localhost:9090/-/reload
```

For Alertmanager:

```bash
curl -X POST http://localhost:9093/-/reload
```

Grafana picks up provisioning changes automatically every 30 seconds
(configured in `dashboards.yml`).

---

## Day-to-Day Commands

```bash
# Check all containers are running
docker compose ps

# View logs for one service
docker compose logs -f grafana
docker compose logs -f prometheus

# Restart one service after config change
docker compose restart prometheus

# Stop the whole stack (data is preserved in volumes)
docker compose down

# Stop and delete all data (careful)
docker compose down -v

# Check disk usage of Prometheus data
docker volume inspect monitoring_prometheus-data
du -sh /var/lib/docker/volumes/monitoring_prometheus-data/
```

---

## Troubleshooting

**Prometheus shows targets as DOWN:**

Go to Prometheus → **Status → Targets**. Each target shows its last scrape
status and error message. Common causes:

- Node Exporter not running on the target machine
- Firewall blocking port 9100 between Prometheus and target
- Wrong IP in `prometheus.yml`

Test reachability from the monitoring host:
```bash
curl http://192.168.1.10:9100/metrics | head -5
```

If that returns metrics — Prometheus can scrape it. If it times out — it's a
firewall issue.

**Grafana shows "No data":**

- Check Prometheus is actually scraping data: go to `http://localhost:9090`
  and run a query like `up`
- Check the time range in Grafana — default is "last 6 hours", there might
  be no data yet if you just started
- Check the datasource: Grafana → Connections → Data sources → Prometheus →
  click **Test** — should say "Data source is working"

**Alertmanager not sending Telegram alerts:**

Test manually by sending a fake alert:

```bash
curl -H 'Content-Type: application/json' -d '[{
  "labels": {"alertname": "TestAlert", "instance": "test"},
  "annotations": {"summary": "This is a test"}
}]' http://localhost:9093/api/v1/alerts
```

Check the Alertmanager logs:
```bash
docker compose logs alertmanager
```

If you see the alert was received but Telegram shows nothing — double-check
your `bot_token` and `chat_id`.

---

## What's Next

Your homelab is now fully observable. You can see CPU, RAM, disk, network,
and container health across every machine — in real time and historically.

The natural next steps from here:

- **Automate the install with Ansible** — the [Ansible guide](/homelab/ansible-homelab)
  shows you how to deploy Node Exporter to every machine with one command
- **Add Loki for log aggregation** — Prometheus handles metrics, Loki handles
  logs. Together they give you the full Grafana observability stack
- **Set up Uptime Kuma** — a simple, beautiful status page that monitors
  your services and sends alerts when they go down. Pairs perfectly with
  this stack for external endpoint monitoring
- **Connect Ollama metrics** — if you followed the [Ollama guide](/homelab/ollama-linux-setup),
  Prometheus can scrape model inference stats — requests per second, token
  generation speed, queue depth

When your lab breaks — and it will — you'll know exactly what happened,
when it happened, and which machine to look at first. That's what monitoring
gives you.
