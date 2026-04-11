---
title: "Ansible for Homelabbers: Automate Everything from One Playbook"
description: "Learn how to provision your entire homelab stack — Docker, Proxmox, monitoring, security — from a single Ansible playbook. Includes real working roles."
pubDate: 2026-01-13
heroImage: "/images/ansible-homelab.webp"
heroImageAlt: "Ansible playbook terminal output showing a PLAY RECAP with homelab nodes provisioned successfully"
section: "homelab"
pillar: "Linux Automation"
type: "CLUSTER"
tags: ["ansible", "automation", "bash", "linux", "devops"]
readingTime: 14
featured: false
faqs:
  - q: "Is Ansible idempotent?"
    a: "Yes. Running the same playbook multiple times on a machine that is already in the correct state makes no changes. Ansible checks the current state before applying each task and skips tasks where nothing needs to change."
  - q: "Do I need Python installed on target hosts?"
    a: "Yes. Ansible uses Python on the remote host to execute most modules. Install it with: apt install python3. Ansible will tell you which hosts are missing Python when you run the playbook."
  - q: "Can I use Ansible with Proxmox VMs and LXC containers?"
    a: "Yes. Ansible connects over SSH regardless of whether the target is a bare-metal machine, a Proxmox VM, or an LXC container — as long as SSH is enabled and the host is reachable, Ansible treats it the same."
  - q: "How do I store passwords and API keys securely in Ansible?"
    a: "Use Ansible Vault. Run ansible-vault encrypt_string 'your-secret' to produce an encrypted value, then paste it into your vars file. The vault password is required at playbook runtime — never commit plaintext secrets to a repository."
  - q: "Do I need a dedicated control machine for Ansible?"
    a: "No. Your laptop or any Linux machine with Ansible installed works as the control node. Ansible connects to target hosts over SSH at runtime — nothing is installed on the control machine permanently."
---

The problem with setting up a homelab manually is that you have to do it again. New server, failed drive, fresh OS install — and you're back to copy-pasting commands from your notes, hoping you remember the order things need to happen in.

Ansible solves this permanently. You describe what you want, and every machine converges to that state — whether it's the first run or the fifteenth.

## Prerequisites

- A control machine running Linux (your laptop or a dedicated node)
- Ansible installed: `pip install ansible` or `apt install ansible`
- SSH key-based access to your target hosts (password auth works but keys are required for automation)
- Target hosts running Debian 12 or Ubuntu 22.04+
- Python 3 installed on each target host (`apt install python3`)

## What We're Building

A single `site.yml` Ansible playbook that provisions:
- Base system hardening (SSH config, UFW, fail2ban)
- Docker + Docker Compose
- Monitoring stack (Prometheus + Grafana)
- Automatic updates via `unattended-upgrades`

All state lives in version-controlled files. Run the playbook against a fresh machine and it comes up configured. Run it against an existing machine and it corrects any drift.

## Project Structure

```
ansible/
├── inventory.ini          # Your servers
├── site.yml               # Master playbook
├── group_vars/
│   ├── all.yml            # Shared variables (non-secret)
│   └── all.vault.yml      # Encrypted secrets (Ansible Vault)
└── roles/
    ├── base/              # OS hardening
    │   ├── tasks/
    │   │   └── main.yml
    │   └── handlers/
    │       └── main.yml
    ├── docker/            # Docker install
    │   └── tasks/
    │       └── main.yml
    └── monitoring/        # Grafana + Prometheus
        ├── tasks/
        │   └── main.yml
        └── templates/
            └── prometheus.yml.j2
```

## Step 1 — Inventory File

```ini
# inventory.ini
[homelab]
proxmox-01  ansible_host=192.168.1.10
monitoring  ansible_host=192.168.1.11
nas         ansible_host=192.168.1.12

[homelab:vars]
ansible_user=admin
ansible_ssh_private_key_file=~/.ssh/homelab_rsa
ansible_python_interpreter=/usr/bin/python3
```

For multiple environments (home vs. VPS vs. staging), use separate inventory files: `inventory/home.ini`, `inventory/vps.ini`. Then target with `-i inventory/home.ini`.

## Step 2 — Shared Variables

Variables shared across all roles go in `group_vars/all.yml`. Keeping them here means you change one value instead of hunting through role files.

```yaml
# group_vars/all.yml
---
# System
timezone: "Europe/Bratislava"
admin_user: "admin"

# Docker
docker_compose_version: "2.24.0"

# Monitoring
grafana_port: 3000
prometheus_port: 9090
prometheus_retention: "30d"

# SSH hardening
ssh_port: 22
ssh_allowed_users:
  - admin

# Packages to install on all nodes
base_packages:
  - curl
  - git
  - htop
  - ufw
  - fail2ban
  - unattended-upgrades
  - jq
  - rsync
```

Secrets — passwords, API keys, tokens — go in `group_vars/all.vault.yml`, encrypted with Ansible Vault (covered below).

## Step 3 — Master Playbook

```yaml
# site.yml
---
- name: Apply base configuration to all homelab nodes
  hosts: homelab
  become: true
  roles:
    - base
    - docker

- name: Set up monitoring stack
  hosts: monitoring
  become: true
  roles:
    - monitoring
```

The separation into multiple plays matters: `base` and `docker` run everywhere, `monitoring` only runs on the designated monitoring host. You can extend this to target other groups — `[proxmox]`, `[nas]`, `[vpn]` — without touching existing plays.

## Step 4 — Base Role (Hardening)

The base role handles everything a fresh Ubuntu/Debian machine needs before anything else runs on it.

```yaml
# roles/base/tasks/main.yml
---
- name: Set timezone
  timezone:
    name: "{{ timezone }}"

- name: Update apt cache and upgrade packages
  apt:
    update_cache: yes
    upgrade: dist
    cache_valid_time: 3600

- name: Install essential packages
  apt:
    name: "{{ base_packages }}"
    state: present

- name: Configure SSH — disable root login
  lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^PermitRootLogin'
    line: 'PermitRootLogin no'
    state: present
  notify: restart sshd

- name: Configure SSH — disable password auth
  lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^PasswordAuthentication'
    line: 'PasswordAuthentication no'
    state: present
  notify: restart sshd

- name: Configure UFW — allow SSH
  ufw:
    rule: allow
    port: "{{ ssh_port }}"
    proto: tcp

- name: Enable UFW
  ufw:
    state: enabled
    policy: deny

- name: Configure unattended-upgrades
  copy:
    dest: /etc/apt/apt.conf.d/20auto-upgrades
    content: |
      APT::Periodic::Update-Package-Lists "1";
      APT::Periodic::Unattended-Upgrade "1";
      APT::Periodic::AutocleanInterval "7";
```

Handlers are tasks that only run when notified — here, restarting sshd only when the config actually changed:

```yaml
# roles/base/handlers/main.yml
---
- name: restart sshd
  service:
    name: sshd
    state: restarted
```

## Step 5 — Docker Role

```yaml
# roles/docker/tasks/main.yml
---
- name: Install Docker prerequisites
  apt:
    name:
      - ca-certificates
      - gnupg
      - lsb-release
    state: present

- name: Add Docker GPG key
  apt_key:
    url: https://download.docker.com/linux/ubuntu/gpg
    state: present

- name: Add Docker repository
  apt_repository:
    repo: "deb [arch=amd64] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable"
    state: present

- name: Install Docker CE
  apt:
    name:
      - docker-ce
      - docker-ce-cli
      - containerd.io
      - docker-compose-plugin
    state: present
    update_cache: yes

- name: Add admin user to docker group
  user:
    name: "{{ admin_user }}"
    groups: docker
    append: yes

- name: Enable and start Docker
  service:
    name: docker
    state: started
    enabled: yes
```

After this role runs, the admin user can run `docker` commands without sudo and Docker starts automatically on boot.

## Step 6 — Monitoring Role

The monitoring role deploys Prometheus and Grafana via Docker Compose. Using a Jinja2 template for the Prometheus config lets you inject variable values at deploy time.

```yaml
# roles/monitoring/tasks/main.yml
---
- name: Create monitoring directory
  file:
    path: /opt/monitoring
    state: directory
    owner: "{{ admin_user }}"
    mode: '0755'

- name: Write Prometheus config from template
  template:
    src: prometheus.yml.j2
    dest: /opt/monitoring/prometheus.yml
    owner: "{{ admin_user }}"
  notify: restart monitoring stack

- name: Write Docker Compose file
  copy:
    dest: /opt/monitoring/docker-compose.yml
    content: |
      services:
        prometheus:
          image: prom/prometheus:latest
          ports:
            - "{{ prometheus_port }}:9090"
          volumes:
            - ./prometheus.yml:/etc/prometheus/prometheus.yml
            - prometheus_data:/prometheus
          command:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.retention.time={{ prometheus_retention }}'
          restart: unless-stopped

        grafana:
          image: grafana/grafana:latest
          ports:
            - "{{ grafana_port }}:3000"
          volumes:
            - grafana_data:/var/lib/grafana
          environment:
            GF_SECURITY_ADMIN_PASSWORD: "{{ grafana_admin_password }}"
          restart: unless-stopped

      volumes:
        prometheus_data:
        grafana_data:
  notify: restart monitoring stack

- name: Start monitoring stack
  community.docker.docker_compose_v2:
    project_src: /opt/monitoring
    state: present
```

The Prometheus template uses the inventory to auto-configure scrape targets:

```yaml
# roles/monitoring/templates/prometheus.yml.j2
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

{% for host in groups['homelab'] %}
  - job_name: '{{ host }}'
    static_configs:
      - targets: ['{{ hostvars[host].ansible_host }}:9100']
{% endfor %}
```

Every host in `[homelab]` gets a Node Exporter scrape target automatically — no manual editing when you add a server.

## Step 7 — Ansible Vault for Secrets

Never put passwords in plain YAML. Ansible Vault encrypts sensitive values so you can commit the file to git safely.

```bash
# Create an encrypted secrets file
ansible-vault create group_vars/all.vault.yml
```

This opens your editor. Add your secrets:

```yaml
# group_vars/all.vault.yml (stored encrypted)
grafana_admin_password: "your-strong-password"
smtp_password: "your-smtp-password"
```

To edit later: `ansible-vault edit group_vars/all.vault.yml`

When running the playbook, provide the vault password:

```bash
# Prompt for vault password at runtime
ansible-playbook site.yml -i inventory.ini --ask-vault-pass

# Or use a password file (add to .gitignore)
echo "your-vault-password" > .vault_pass
chmod 600 .vault_pass
ansible-playbook site.yml -i inventory.ini --vault-password-file .vault_pass
```

The vault file is encrypted on disk but the values are available as normal variables inside your roles — `{{ grafana_admin_password }}` works exactly as you'd expect.

## Running the Playbook

```bash
# Dry run first — see what would change without applying it
ansible-playbook site.yml -i inventory.ini --check

# Apply for real
ansible-playbook site.yml -i inventory.ini

# Run only on one host
ansible-playbook site.yml -i inventory.ini --limit proxmox-01

# Run only specific roles using tags
ansible-playbook site.yml -i inventory.ini --tags docker
ansible-playbook site.yml -i inventory.ini --tags monitoring

# Run everything except the base role (already configured)
ansible-playbook site.yml -i inventory.ini --skip-tags base
```

After running, you'll see the familiar PLAY RECAP:

```
PLAY RECAP ************************************
proxmox-01 : ok=12  changed=3  unreachable=0  failed=0
monitoring : ok=18  changed=2  unreachable=0  failed=0
```

`changed=3` tells you exactly what was modified. `ok=12` means those tasks ran and confirmed the system was already in the correct state — Ansible checked, nothing needed changing.

## Tags: Run Only What You Need

Add tags to your roles in `site.yml` to control which parts run:

```yaml
# site.yml
---
- name: Apply base configuration to all homelab nodes
  hosts: homelab
  become: true
  roles:
    - role: base
      tags: [base, hardening]
    - role: docker
      tags: [docker]

- name: Set up monitoring stack
  hosts: monitoring
  become: true
  roles:
    - role: monitoring
      tags: [monitoring]
```

Now `--tags docker` runs only the Docker role across all hosts. Useful when you're iterating on one role without re-running the entire playbook.

## Troubleshooting

**SSH connection refused:**
```bash
# Test connectivity before running the playbook
ansible all -i inventory.ini -m ping
```
Expected: `proxmox-01 | SUCCESS => {"ping": "pong"}`

**Permission denied (publickey):**
Make sure `ansible_ssh_private_key_file` points to the correct key and that the public key is in `~/.ssh/authorized_keys` on the target host.

**`become` errors (sudo requires password):**
Either add `ansible_become_password: yourpassword` to `group_vars/all.vault.yml`, or configure passwordless sudo on the target: add `admin ALL=(ALL) NOPASSWD:ALL` to `/etc/sudoers.d/admin`.

**Module not found on target:**
Run `ansible all -i inventory.ini -m raw -a "apt install -y python3"` to bootstrap Python without needing it already installed.

**Verbose output for debugging:**
```bash
ansible-playbook site.yml -i inventory.ini -vvv
```
Three `v` flags show you the full SSH conversation and module output — enough to diagnose almost any issue.

---

This playbook covers the foundation. For a production-ready setup with five fully built roles — base hardening, Docker CE, SSH/kernel security with CrowdSec, Prometheus/Grafana monitoring, and Ollama with automatic GPU detection — the **[Ansible Homelab Bundle](/go/ansible-bundle)** includes 25 ready-to-run files. One command provisions a fresh Ubuntu server to a complete homelab stack in under 10 minutes.

Related guides:

- **[Docker Compose Homelab Stack](/homelab/docker-compose-homelab-stack)** — the services this Ansible setup deploys
- **[Proxmox VE Setup](/homelab/proxmox-homelab-setup)** — the infrastructure these playbooks typically run against
- **[Linux Security Hardening](/homelab/linux-security-hardening)** — manual hardening steps that the base role automates
