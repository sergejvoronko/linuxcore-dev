---
title: "Ansible for Homelabbers: Automate Everything from One Playbook"
description: "Learn how to provision your entire homelab stack — Docker, Proxmox, monitoring, security — from a single Ansible playbook. Includes real working roles."
pubDate: 2026-01-13
heroImage: "/images/ansible-homelab.webp"
section: "homelab"
pillar: "Linux Automation"
type: "CLUSTER"
tags: ["ansible", "automation", "bash", "linux", "devops"]
readTime: 12
featured: false
---

## What We're Building

A single `site.yml` Ansible playbook that provisions:
- Base system hardening (SSH config, UFW, fail2ban)
- Docker + Docker Compose
- Monitoring stack (Prometheus + Grafana)
- Automatic updates via `unattended-upgrades`

## Project Structure

```
ansible/
├── inventory.ini          # Your servers
├── site.yml               # Master playbook
├── group_vars/
│   └── all.yml            # Shared variables
└── roles/
    ├── base/              # OS hardening
    ├── docker/            # Docker install
    └── monitoring/        # Grafana + Prometheus
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

## Step 2 — Master Playbook

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

## Step 3 — Base Role (Hardening)

```yaml
# roles/base/tasks/main.yml
---
- name: Update apt cache and upgrade packages
  apt:
    update_cache: yes
    upgrade: dist
    cache_valid_time: 3600

- name: Install essential packages
  apt:
    name:
      - curl
      - git
      - htop
      - ufw
      - fail2ban
      - unattended-upgrades
    state: present

- name: Configure UFW — allow SSH
  ufw:
    rule: allow
    port: "22"
    proto: tcp

- name: Enable UFW
  ufw:
    state: enabled
    policy: deny
```

## Running the Playbook

```bash
# Dry run first — see what would change
ansible-playbook site.yml -i inventory.ini --check

# Apply for real
ansible-playbook site.yml -i inventory.ini

# Run only on one host
ansible-playbook site.yml -i inventory.ini --limit proxmox-01

# Run only the monitoring role
ansible-playbook site.yml -i inventory.ini --tags monitoring
```

After running, you'll see the familiar output:

```
PLAY RECAP ************************************
proxmox-01 : ok=12  changed=3  unreachable=0  failed=0
monitoring : ok=18  changed=2  unreachable=0  failed=0
```

The `changed=3` tells you exactly what was modified.
