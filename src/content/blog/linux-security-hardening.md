---
title: "Linux Homelab Security Hardening: Complete Checklist (2026)"
description: "Harden any Ubuntu or Debian server in under an hour: SSH lockdown, UFW, fail2ban, CrowdSec, and automatic updates — every command tested, reason explained."
pubDate: 2026-05-19
heroImage: "/images/linux-security-hardening.webp"
heroImageAlt: "Linux terminal showing UFW firewall rules, fail2ban status, and SSH hardening configuration on a Debian server"
section: "homelab"
pillar: "Security"
type: "PILLAR"
tags: ["security", "linux", "ssh", "ufw", "fail2ban", "crowdsec", "hardening", "ubuntu", "debian", "homelab"]
readingTime: 20
featured: true
draft: true
faqs:
  - q: "Will following these steps lock me out of my server?"
    a: "Only if you disable password auth before testing key-based SSH. Always open a second SSH session before restarting the SSH daemon to verify your key works. The guide follows this order — keys first, then disable passwords."
  - q: "Do I need all 12 steps or can I pick the most important ones?"
    a: "Steps 1-6 (updates, non-root user, SSH keys, SSH hardening, UFW, fail2ban) are the essential baseline that covers the vast majority of real-world threats. Steps 7-12 add defence-in-depth and are recommended but can be phased in over time."
  - q: "What is CrowdSec and how does it differ from fail2ban?"
    a: "Both block IPs that show malicious behaviour. fail2ban works locally — it only blocks attackers based on your own logs. CrowdSec uses a collaborative threat intelligence network: when one server blocks an IP, that intelligence is shared across all CrowdSec users, so you benefit from blocks triggered by other people's servers too."
  - q: "How do I check if my Linux server has already been compromised?"
    a: "Run lynis audit system for a broad security audit. Check /var/log/auth.log for unexpected successful logins, run last to see recent login history, and check netstat -tulpn or ss -tulpn for unexpected listening services. Unexpected cron jobs in /etc/cron* and /var/spool/cron are also a red flag."
---

A default Ubuntu or Debian install is not secure. It's functional, which
is different.

Default installs have password authentication enabled on SSH, no firewall
rules, no intrusion detection, no automatic security updates, and root
login allowed over the network. Any one of those is a problem. All of them
together is how a homelab gets turned into a botnet node at 3am on a
Tuesday.

This guide fixes all of it. Work through it top to bottom on any fresh
Linux install and the result is a server that's genuinely hardened —
resistant to the automated attacks that scan the internet constantly,
and set up to tell you when something unusual happens.

Every step is explained. Not just the command, but why it matters and
what happens if you skip it.

---

## Who This Is For

This guide is for any Linux server you run 24/7: a Proxmox host, a Docker
machine, a WireGuard VPN server, a VPS, or the Ubuntu laptop you're
using as a homelab node.

The commands are tested on **Ubuntu 22.04 and 24.04** and **Debian 12**.
They work on both with no modifications.

**Time to complete:** 45–60 minutes on a fresh install. 20 minutes if
you automate it with Ansible (a ready-made role is at the end).

---

## Step 1 — Update Everything First

Before hardening anything, make sure the system is fully patched.
Known vulnerabilities in old packages are the easiest attack vector.

```bash
sudo apt update && sudo apt dist-upgrade -y
sudo apt autoremove -y
sudo reboot
```

The reboot applies any kernel updates. Do this before anything else —
some later steps depend on the running kernel version.

---

## Step 2 — Create a Non-Root Admin User

Running everything as root is like doing all your work with nuclear launch
codes in your pocket. You don't need that power for most tasks, and if
something goes wrong you want a blast radius, not a crater.

```bash
# Create your user
sudo adduser yourusername

# Give it sudo access
sudo usermod -aG sudo yourusername

# Switch to your new user
su - yourusername

# Verify sudo works
sudo whoami
# Should print: root
```

From this point on, do everything as `yourusername` with `sudo` when
needed. Root login will be disabled later.

---

## Step 3 — SSH Key Authentication

Password-based SSH is brute-forceable. SSH keys are not — they're
mathematically unfeasible to crack with any foreseeable hardware.

**On your laptop (not the server):**

```bash
# Generate an ed25519 key if you don't have one
ssh-keygen -t ed25519 -C "homelab-$(hostname)"
# Press Enter to accept defaults

# Copy it to the server
ssh-copy-id yourusername@192.168.1.x
```

**Test key login before continuing:**

```bash
# Open a NEW terminal and test — don't close your current session yet
ssh yourusername@192.168.1.x
# Should connect without asking for a password
```

If it connects without a password prompt — keys are working.
Only proceed to the next step after confirming this.

---

## Step 4 — Harden SSH Configuration

This is the most impactful single step. Most automated attacks against
Linux servers target SSH with password guessing. Closing this off
removes 95% of your attack surface immediately.

```bash
sudo nano /etc/ssh/sshd_config
```

Set these values (add or change as needed):

```ini
# ── Authentication ────────────────────────────────────────────
# Disable password auth entirely — keys only
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no

# Never allow root to log in over SSH
PermitRootLogin no

# Only allow your specific user
AllowUsers yourusername

# Limit auth attempts before disconnect
MaxAuthTries 3
MaxSessions 5

# Disconnect after 20 seconds if no successful login
LoginGraceTime 20

# ── Ciphers and algorithms (modern, strong only) ──────────────
PubkeyAcceptedKeyTypes ssh-ed25519,ecdsa-sha2-nistp256,rsa-sha2-512,rsa-sha2-256

# ── Idle session timeout ──────────────────────────────────────
# Disconnect idle sessions after 10 minutes
ClientAliveInterval 300
ClientAliveCountMax 2

# ── Disable features you're not using ────────────────────────
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitEmptyPasswords no
```

Apply the changes:

```bash
sudo systemctl reload sshd
```

**Test in a new terminal before closing your current session.** If you
lock yourself out, your existing session stays open and you can fix it.

```bash
# New terminal — should still work with your key
ssh yourusername@192.168.1.x
```

---

## Step 5 — UFW Firewall

UFW (Uncomplicated Firewall) is a frontend for iptables that makes
firewall rules human-readable. The default Linux install has no firewall.
This changes that.

```bash
# Default policy: deny everything incoming, allow everything outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH — do this BEFORE enabling or you'll lock yourself out
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp

# If using Tailscale — allow SSH from Tailscale range too
sudo ufw allow from 100.64.0.0/10 to any port 22 proto tcp

# Enable the firewall
sudo ufw enable

# Verify
sudo ufw status verbose
```

**Add rules for your specific services:**

```bash
# Proxmox web UI (LAN only)
sudo ufw allow from 192.168.1.0/24 to any port 8006

# Docker services (LAN only)
sudo ufw allow from 192.168.1.0/24 to any port 3000:3003 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 8080:8096 proto tcp

# WireGuard (public — needs to be reachable from internet)
sudo ufw allow 51820/udp

# Grafana
sudo ufw allow from 192.168.1.0/24 to any port 3001

# n8n
sudo ufw allow from 192.168.1.0/24 to any port 5678
```

Adjust the ports to match your setup. The principle: every service is
LAN-only unless there's a specific reason for it to be public.

**Important — Docker bypasses UFW by default:**

Docker modifies iptables directly and bypasses UFW rules for exposed
ports. If you run Docker, add this to prevent Docker from opening
ports to the internet:

```bash
# Edit Docker daemon config
sudo nano /etc/docker/daemon.json
```

```json
{
  "iptables": false
}
```

```bash
# Restart Docker — existing containers need to be restarted too
sudo systemctl restart docker
```

Then manage Docker port access through UFW as above. This is a
significant security improvement for any internet-facing machine
running Docker.

---

## Step 6 — fail2ban

fail2ban watches your log files and automatically bans IPs that show
signs of brute-force attacks — too many failed SSH logins, too many
failed web logins, and so on.

```bash
sudo apt install fail2ban -y
```

Create a local config (don't edit the original — it gets overwritten
on upgrades):

```bash
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Find the `[DEFAULT]` section and set:

```ini
[DEFAULT]
bantime  = 1h       # ban for 1 hour
findtime = 10m      # look back 10 minutes
maxretry = 5        # ban after 5 failures
backend  = systemd  # use systemd journal for log parsing
```

Enable the SSH jail by finding and setting:

```ini
[sshd]
enabled  = true
port     = 22
filter   = sshd
maxretry = 3        # stricter than default — ban after 3 SSH failures
bantime  = 24h      # SSH bans last 24 hours
```

Start and enable:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status

# Check SSH jail specifically
sudo fail2ban-client status sshd
```

**View and manage bans:**

```bash
# See currently banned IPs
sudo fail2ban-client status sshd | grep "Banned IP"

# Manually unban an IP (if you accidentally ban yourself)
sudo fail2ban-client set sshd unbanip 192.168.1.x
```

---

## Step 7 — Automatic Security Updates

Security patches are released constantly. Not applying them is how
known vulnerabilities become your vulnerabilities.

```bash
sudo apt install unattended-upgrades apt-listchanges -y
sudo dpkg-reconfigure -pmedium unattended-upgrades
```

Select **Yes** when prompted.

Fine-tune the config:

```bash
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

Ensure these lines are uncommented:

```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

// Automatically reboot at 3am if a kernel update requires it
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";

// Send email on upgrade errors (set your address)
Unattended-Upgrade::Mail "you@yourdomain.com";
Unattended-Upgrade::MailOnlyOnError "true";
```

Test it runs without errors:

```bash
sudo unattended-upgrades --dry-run --debug 2>&1 | tail -20
```

---

## Step 8 — CrowdSec (Collaborative Threat Intelligence)

fail2ban bans IPs that attack your machine. CrowdSec goes further —
it shares threat intelligence across all CrowdSec users, so IPs that
have attacked other homelabs are pre-emptively blocked on yours.

```bash
# Install CrowdSec
curl -s https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh | sudo bash
sudo apt install crowdsec -y

# Install the firewall bouncer (this does the actual blocking)
sudo apt install crowdsec-firewall-bouncer-iptables -y
```

Check what collections CrowdSec installed:

```bash
sudo cscli collections list
```

You should see collections for Linux, SSH, and more. CrowdSec
automatically detects your running services and adds relevant parsers.

**Add Docker protection:**

```bash
sudo cscli collections install crowdsecurity/docker
sudo systemctl reload crowdsec
```

**Check CrowdSec status:**

```bash
# See what's been detected and blocked
sudo cscli alerts list

# See currently active bans
sudo cscli decisions list

# Check the bouncer is registered
sudo cscli bouncers list
```

CrowdSec's community blocklist contains millions of known-malicious IPs
contributed by users worldwide. As soon as you install it, your machine
benefits from collective defence without doing anything else.

---

## Step 9 — Disable Unnecessary Services

Every running service that you're not using is a potential attack surface.

```bash
# List all active services
systemctl list-units --type=service --state=active

# Common candidates for disabling on a headless server:
sudo systemctl disable --now avahi-daemon      # mDNS — not needed on servers
sudo systemctl disable --now cups              # printing
sudo systemctl disable --now bluetooth         # Bluetooth
sudo systemctl disable --now ModemManager      # modem management

# Check what's listening on the network
ss -tulpn

# Should only show services you intentionally run
# Anything unexpected on 0.0.0.0 is worth investigating
```

---

## Step 10 — Set Up Logwatch or Lynis Audit

**Logwatch** emails you a daily summary of what happened on the system:

```bash
sudo apt install logwatch -y

# Configure
sudo nano /etc/logwatch/conf/logwatch.conf
```

```ini
Output = mail
MailTo = you@yourdomain.com
MailFrom = logwatch@yourhostname
Detail = Med
Service = All
```

```bash
# Test it
sudo logwatch --output mail --mailto you@yourdomain.com --detail high
```

**Lynis** is a security auditing tool that scans your system and gives
you a hardening score with specific recommendations:

```bash
sudo apt install lynis -y

# Run a full audit
sudo lynis audit system
```

Lynis prints a report with a hardening index score (aim for 75+) and
specific suggestions. Work through the suggestions to improve your score
over time.

---

## Step 11 — Kernel Hardening (sysctl)

The Linux kernel has security parameters that aren't set optimally by
default. These sysctl settings reduce the kernel's attack surface:

```bash
sudo nano /etc/sysctl.d/99-hardening.conf
```

```ini
# ── Network hardening ─────────────────────────────────────────

# Disable IP forwarding (enable only if running a router/VPN)
# net.ipv4.ip_forward = 0

# Ignore ICMP redirects (prevent MITM attacks)
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Don't send ICMP redirects
net.ipv4.conf.all.send_redirects = 0

# Ignore source-routed packets
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Enable SYN flood protection
net.ipv4.tcp_syncookies = 1

# Log martian packets (packets with impossible source addresses)
net.ipv4.conf.all.log_martians = 1

# ── Memory hardening ──────────────────────────────────────────

# Randomise virtual address space (ASLR)
kernel.randomize_va_space = 2

# Restrict access to kernel logs
kernel.dmesg_restrict = 1

# Restrict ptrace (prevents process injection attacks)
kernel.yama.ptrace_scope = 1

# ── Filesystem hardening ──────────────────────────────────────

# Protect symlinks and hardlinks
fs.protected_symlinks = 1
fs.protected_hardlinks = 1
```

Apply immediately:

```bash
sudo sysctl -p /etc/sysctl.d/99-hardening.conf
```

These settings persist across reboots.

---

## Step 12 — SSH Two-Factor Authentication (Optional but Recommended)

For servers that are reachable from the internet, add TOTP two-factor
auth on top of SSH keys. Even with a stolen key, an attacker needs your
phone to log in.

```bash
sudo apt install libpam-google-authenticator -y

# Run as your regular user (not root)
google-authenticator
```

Answer the questions:
- Time-based tokens: **y**
- Update `.google_authenticator` file: **y**
- Disallow multiple uses: **y**
- Permit a window of up to 4 minutes: **n**
- Enable rate limiting: **y**

Scan the QR code with Aegis, Bitwarden Authenticator, or any TOTP app.

Configure PAM to require it:

```bash
sudo nano /etc/pam.d/sshd
```

Add at the top:

```
auth required pam_google_authenticator.so
```

Update SSH config:

```bash
sudo nano /etc/ssh/sshd_config
```

```ini
ChallengeResponseAuthentication yes
AuthenticationMethods publickey,keyboard-interactive
```

```bash
sudo systemctl reload sshd
```

Test in a new terminal — it should ask for your key AND your TOTP code.

---

## The Hardening Checklist

Use this as a quick reference for every new server:

```
SYSTEM
[ ] apt dist-upgrade && reboot
[ ] Created non-root sudo user

SSH
[ ] SSH keys generated and copied
[ ] PasswordAuthentication no
[ ] PermitRootLogin no
[ ] AllowUsers set to specific user
[ ] sshd reloaded and tested from new terminal

FIREWALL
[ ] UFW default deny incoming
[ ] SSH allowed from LAN only
[ ] All services restricted to LAN (except intentional exceptions)
[ ] Docker iptables bypass disabled (/etc/docker/daemon.json)
[ ] UFW enabled

INTRUSION DETECTION
[ ] fail2ban installed and configured
[ ] CrowdSec installed with firewall bouncer
[ ] fail2ban and CrowdSec both showing active status

UPDATES
[ ] unattended-upgrades configured
[ ] Auto-reboot enabled for kernel updates at 3am
[ ] Email notifications configured

AUDIT
[ ] Logwatch installed and sending daily reports
[ ] Lynis audit run — score above 70
[ ] ss -tulpn reviewed — no unexpected open ports
[ ] Unused services disabled

KERNEL
[ ] sysctl hardening applied (/etc/sysctl.d/99-hardening.conf)

OPTIONAL
[ ] TOTP SSH two-factor auth configured
[ ] Tailscale SSH enabled (replaces TOTP for internal access)
```

---

## Automating All of This with Ansible

Running through this checklist manually on every new machine takes an
hour. The [Ansible guide](/homelab/ansible-homelab-guide) shows you how
to build roles — here's the skeleton of a security role that runs every
step above:

```yaml
# roles/security/tasks/main.yml
---
- name: Update all packages
  apt:
    update_cache: yes
    upgrade: dist

- name: Configure SSH hardening
  template:
    src: sshd_config.j2
    dest: /etc/ssh/sshd_config
    validate: /usr/sbin/sshd -t -f %s
  notify: restart sshd

- name: Configure UFW defaults
  ufw:
    default: deny
    direction: incoming

- name: Allow SSH from LAN
  ufw:
    rule: allow
    port: "22"
    src: "{{ lan_subnet }}"
    proto: tcp

- name: Enable UFW
  ufw:
    state: enabled

- name: Install and configure fail2ban
  apt:
    name: fail2ban
    state: present

- name: Configure sysctl hardening
  template:
    src: 99-hardening.conf.j2
    dest: /etc/sysctl.d/99-hardening.conf
  notify: reload sysctl

- name: Enable unattended upgrades
  apt:
    name: unattended-upgrades
    state: present
```

Run this against every new machine:

```bash
ansible-playbook site.yml -i inventory.ini --tags security
```

Every server in your homelab, hardened identically, in minutes.

---

## What These Steps Don't Cover

This guide hardens the OS layer. For a complete security picture,
also consider:

**Application security** — each service (Nextcloud, Grafana, n8n) has
its own security settings. Default installs are rarely secure. Review
each service's hardening guide after setup.

**Physical security** — if someone can physically access your hardware,
most software security is irrelevant. Disk encryption (LUKS) protects
data if a drive is removed.

**Network segmentation** — VLANs in Proxmox or on your router separate
untrusted services (IoT, guest Wi-Fi) from your homelab. The
[Proxmox guide](/homelab/proxmox-homelab-setup) covers this.

**Secrets management** — Ansible Vault and Vaultwarden from the
[Docker Compose stack](/homelab/docker-compose-homelab-stack) handle
secret storage. Never put passwords in plain-text files or environment
variables committed to Git.

Security is not a state you reach — it's a practice you maintain.
These steps get you to a strong baseline. Lynis will show you what
to improve next.
