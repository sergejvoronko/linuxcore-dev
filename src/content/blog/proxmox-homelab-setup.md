---
title: "Proxmox VE Homelab Setup: Complete Installation and Configuration Guide (2026)"
description: "Install Proxmox VE 8 on a mini PC or bare metal server, configure storage, networking, and GPU passthrough, deploy your first VMs and LXC containers, and harden it for 24/7 homelab use."
pubDate: 2026-05-05
section: "homelab"
pillar: "Infrastructure"
type: "PILLAR"
tags: ["proxmox", "virtualization", "lxc", "vm", "homelab", "linux", "gpu-passthrough", "zfs", "networking"]
readTime: 26
featured: false
draft: false
---

If you run one machine in your homelab, Proxmox VE is the single best
decision you can make about what to put on it.

Proxmox is a free, open-source Type-1 hypervisor built on Debian Linux.
It runs directly on your hardware — no host OS underneath — and lets you
carve that hardware into multiple isolated virtual machines and containers.
Your Ollama AI server, your Grafana monitoring stack, your WireGuard VPN,
and your Nextcloud all live in separate environments, on one machine, with
a clean web interface to manage them.

When you need to rebuild something, you rebuild a container — not the
whole machine. When you want to try something new, you spin up a VM, test
it, and delete it without touching anything else. When something breaks,
only that VM breaks.

This guide takes you from bare metal to a fully configured Proxmox node
with VMs, LXC containers, proper storage, GPU passthrough, and security
hardening.

---

## What Proxmox Gives You

**Virtual Machines (KVM):** Full hardware emulation. Run any OS —
Linux, Windows, BSD. Complete isolation. Use for anything that needs its
own kernel, GPU passthrough, or strict separation.

**LXC Containers:** Lightweight Linux containers. Share the host kernel.
Boot in under a second. Use a fraction of the RAM a full VM needs. Use
for Linux services that don't need GPU passthrough or kernel-level isolation.

**Web Interface:** Manage everything from a browser at `https://your-ip:8006`.
Create VMs, take snapshots, monitor resource usage, manage storage — all
without SSH for day-to-day tasks.

**Snapshots and Backups:** Snapshot a VM before an upgrade. Roll back in
30 seconds if something breaks. Schedule automated backups to your NAS
or an external drive.

**ZFS Storage:** Proxmox has first-class ZFS support built in. Self-healing
storage, instant snapshots, compression, and RAID — all in software, all
free, all faster than you'd expect.

---

## What You Need

- A machine with at least 8GB RAM (16GB recommended)
- One USB drive (8GB+) for the installer
- An SSD or NVMe for Proxmox itself (120GB minimum, 500GB recommended)
- A wired network connection during install
- [Ventoy](https://www.ventoy.net) or [Rufus](https://rufus.ie) to write the ISO

If you haven't chosen hardware yet, the [mini PC guide](/homelab/best-mini-pc-homelab-2026)
covers the best options at every price point. A Beelink EQ14 with 16GB
RAM runs this entire guide comfortably. ([grab one here](/go/beelink-mini-s12))

---

## Step 1 — Download and Write the ISO

Download the latest Proxmox VE ISO from **proxmox.com/downloads**.
As of 2026, that's Proxmox VE 8.x.

Write it to a USB drive using your Ubuntu laptop:

```bash
# Find your USB drive device name
lsblk

# Write the ISO (replace sdX with your USB device — be careful here)
sudo dd if=proxmox-ve_8.x-x.iso of=/dev/sdX bs=1M status=progress conv=fdatasync
```

Or use the graphical **Balena Etcher** app if you prefer a GUI.

---

## Step 2 — Install Proxmox VE

Boot from the USB drive (usually F12 or Del to reach boot menu).

**Installer walkthrough:**

1. Select **Install Proxmox VE (Graphical)**
2. Accept the EULA
3. **Target disk:** select your NVMe/SSD. If you have two drives, select
   both here to set up ZFS RAID-1 mirroring automatically.

**File system choice:**
- **ext4** — simple, well-understood, fine for most setups
- **ZFS (RAID-0)** — single disk, with ZFS compression and snapshots
- **ZFS (RAID-1)** — two disks, mirrored, recommended if you have two SSDs

For a single-drive mini PC, `ext4` or `ZFS RAID-0` both work well. ZFS
gives you snapshots which are genuinely useful — choose it unless you
have a specific reason not to.

4. **Location and timezone:** set your timezone and keyboard layout
5. **Administration password:** set a strong root password and an email
   address for alerts
6. **Network configuration:**
   - Management interface: select your wired NIC
   - Hostname: `proxmox.local` or similar
   - IP address: give it a static LAN IP (e.g. `192.168.1.50/24`)
   - Gateway: your router IP (e.g. `192.168.1.1`)
   - DNS: `1.1.1.1` or your router IP

7. Review the summary and click **Install**

The installation takes 5–10 minutes. The machine reboots into Proxmox.

---

## Step 3 — First Login and Repository Configuration

Open your browser: `https://192.168.1.50:8006`

You'll get a certificate warning — this is expected. The certificate
is self-signed. Accept it and proceed (you can add a proper certificate
later via Tailscale Serve or Let's Encrypt).

Login: `root` / your password. Select **Linux PAM** as the realm.

**Disable the subscription nag:**

Proxmox is free but shows a "No valid subscription" popup on login.
Remove it:

```bash
# SSH into Proxmox
ssh root@192.168.1.50

# Remove the subscription check from the web interface
sed -i.bak "s/data.status !== 'Active'/false/g" \
  /usr/share/javascript/proxmox-widget-toolkit/proxmoxlib.js

# Restart the web service
systemctl restart pveproxy
```

Refresh your browser — no more popup.

**Switch to the free repository:**

By default Proxmox points at the enterprise repository which requires
a paid subscription. Switch to the free community repo:

```bash
# Disable enterprise repo
echo "# disabled" > /etc/apt/sources.list.d/pve-enterprise.list

# Add the free no-subscription repo
echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" \
  > /etc/apt/sources.list.d/pve-no-subscription.list

# Update
apt update && apt dist-upgrade -y

# Reboot to apply any kernel updates
reboot
```

You now have a fully updated, free Proxmox installation.

---

## Step 4 — Storage Configuration

Good storage layout is the foundation of a reliable Proxmox setup.
How you configure this depends on how many drives you have.

**Single drive setup (most mini PCs):**

The default install creates two storage pools:
- `local` — for ISO images, container templates, backups
- `local-lvm` — for VM disks and container volumes

This works. No changes needed for a first setup.

**Two drive setup (recommended):**

Add a second NVMe for VM data, keeping the OS on the first:

In the Proxmox web UI:
1. **Datacenter → Storage → Add → Directory**
2. Point it at `/mnt/data` (after mounting the second drive)
3. Enable: Disk image, Container, Backup, ISO image

Or for ZFS mirroring across both drives, wipe the second drive and:

```bash
# Create a ZFS pool on the second drive
zpool create -f datastore /dev/nvme1n1

# Or create mirrored pool across both drives (destructive — wipes both)
zpool create -f datastore mirror /dev/nvme0n1 /dev/nvme1n1
```

Then add it in the UI: **Datacenter → Storage → Add → ZFS** → select
your pool.

**External USB backup drive:**

```bash
# Mount the drive
mkdir -p /mnt/backup
mount /dev/sdb1 /mnt/backup

# Make it persistent
echo "/dev/sdb1 /mnt/backup ext4 defaults,nofail 0 0" >> /etc/fstab

# Add to Proxmox storage
pvesm add dir backup-usb --path /mnt/backup --content backup
```

---

## Step 5 — Download Container Templates

LXC containers start from templates — pre-built Linux filesystem images.
Download the ones you'll use:

```bash
# Update the template list
pveam update

# List available templates
pveam available | grep -E "debian|ubuntu"

# Download Ubuntu 22.04 template
pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst

# Download Debian 12 template
pveam download local debian-12-standard_12.0-1_amd64.tar.zst
```

Or in the web UI: **local storage → CT Templates → Templates** — browse
and download with one click.

---

## Step 6 — Create Your First LXC Container

LXC containers are the right choice for most homelab services. They start
in under a second, use minimal RAM, and share the host kernel.

**In the web UI:**

1. Click **Create CT** (top right)
2. **General:** set hostname, password, and SSH key (paste your public key)
3. **Template:** select your downloaded Ubuntu template
4. **Disks:** 8GB is enough for most services; 20GB if you're not sure
5. **CPU:** 2 cores (can be changed later)
6. **Memory:** 512MB–2048MB depending on the service
7. **Network:** DHCP or set a static IP
8. Click **Finish** then **Start**

**Or from the command line** (faster for multiple containers):

```bash
# Create a Debian 12 container with ID 101
pct create 101 local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst \
  --hostname grafana \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.101/24,gw=192.168.1.1 \
  --rootfs local-lvm:20 \
  --password your-password \
  --ssh-public-keys ~/.ssh/id_ed25519.pub \
  --start 1

# Connect to it
pct enter 101
```

Inside the container it looks exactly like a fresh Debian install. Run
`apt update`, install whatever you need, and it's isolated from everything
else on the host.

---

## Step 7 — Create Your First VM

VMs are heavier than LXC but necessary when you need full kernel isolation,
GPU passthrough, or a non-Linux OS.

**Upload an ISO first:**

```bash
# From Proxmox host — download Ubuntu Server ISO directly
wget -P /var/lib/vz/template/iso/ \
  https://releases.ubuntu.com/22.04/ubuntu-22.04.4-live-server-amd64.iso
```

Or upload from your laptop: **local storage → ISO Images → Upload**.

**Create the VM:**

1. Click **Create VM**
2. **General:** name it, note the VM ID
3. **OS:** select your ISO
4. **System:** leave defaults (BIOS: OVMF/UEFI is optional but cleaner)
5. **Disks:** 32GB+ on local-lvm, **VirtIO SCSI** for best performance
6. **CPU:** 2–4 cores, type: `host` (passes through real CPU features)
7. **Memory:** 2048–4096MB, enable **Ballooning** for dynamic allocation
8. **Network:** VirtIO network model
9. Finish and start — it boots into the ISO installer

After OS install, install the QEMU guest agent for better integration:

```bash
# Inside the VM
sudo apt install qemu-guest-agent -y
sudo systemctl enable --now qemu-guest-agent
```

Then in Proxmox UI: VM → Options → QEMU Guest Agent → Enable.

---

## Step 8 — GPU Passthrough (for AI and Transcoding)

GPU passthrough lets a VM or container take exclusive control of a GPU.
This is how you run Ollama with full GPU acceleration inside a Proxmox VM.

**Enable IOMMU in the bootloader:**

```bash
# Edit GRUB
nano /etc/default/grub

# Change GRUB_CMDLINE_LINUX_DEFAULT to:
# For Intel:
GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt"
# For AMD:
GRUB_CMDLINE_LINUX_DEFAULT="quiet amd_iommu=on iommu=pt"

# Apply
update-grub
reboot
```

**Verify IOMMU is active:**

```bash
dmesg | grep -e IOMMU -e DMAR
# Should show IOMMU enabled messages
```

**Load VFIO modules:**

```bash
# Add to modules
echo "vfio
vfio_iommu_type1
vfio_pci
vfio_virqfd" >> /etc/modules

# Blacklist the GPU driver on the host (so the VM gets it)
echo "blacklist nouveau
blacklist nvidia" >> /etc/modprobe.d/blacklist.conf

update-initramfs -u -k all
reboot
```

**Find your GPU PCI IDs:**

```bash
lspci -nnk | grep -i nvidia
# Example output:
# 01:00.0 VGA [0300]: NVIDIA Corporation GA106 [GeForce RTX 3060] [10de:2503]
# 01:00.1 Audio [0403]: NVIDIA Corporation GA106 High Definition Audio [10de:228e]
```

Note both PCI IDs — `10de:2503` and `10de:228e` in this example.

**Bind the GPU to VFIO:**

```bash
echo "options vfio-pci ids=10de:2503,10de:228e" > /etc/modprobe.d/vfio.conf
update-initramfs -u
reboot
```

**Add GPU to a VM:**

In the Proxmox UI: VM → Hardware → Add → PCI Device → select your GPU
→ enable **All Functions** and **Primary GPU** if you want full passthrough.

Inside the VM, install the NVIDIA drivers normally — the VM sees the GPU
as real hardware and the [Ollama guide](/homelab/ollama-linux-setup) applies
without modification.

---

## Step 9 — Networking: VLANs and Bridges

Proxmox creates a Linux bridge (`vmbr0`) during install. All VMs and
containers connect through this bridge and share the host network.

**Add a second bridge for an isolated network:**

Useful for separating homelab services from your main LAN, or for
building a testing network that can't reach production.

```bash
# Edit network config
nano /etc/network/interfaces

# Add a new bridge (no physical interface — isolated)
auto vmbr1
iface vmbr1 inet static
    address 10.10.10.1/24
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    post-up echo 1 > /proc/sys/net/ipv4/ip_forward
    post-up iptables -t nat -A POSTROUTING -s 10.10.10.0/24 -o vmbr0 -j MASQUERADE
    post-down iptables -t nat -D POSTROUTING -s 10.10.10.0/24 -o vmbr0 -j MASQUERADE
```

```bash
# Apply without reboot
ifreload -a
```

Containers on `vmbr1` get `10.10.10.x` addresses and can reach the
internet through NAT but are isolated from your LAN — perfect for
testing or untrusted services.

---

## Step 10 — Automated Backups

Snapshots save state instantly. Backups save a full copy you can restore
on different hardware.

**Schedule automatic VM backups in the UI:**

1. **Datacenter → Backup → Add**
2. Schedule: Daily at 2am (or whatever suits you)
3. Storage: select your backup storage
4. Selection: all VMs, or choose specific ones
5. Mode: **Snapshot** (non-disruptive, VM keeps running)
6. Retention: keep last 7 backups

Proxmox emails you if a backup fails — configure the email in
**Datacenter → Options → Email**.

**Manual snapshot before risky changes:**

```bash
# Snapshot a VM (ID 101) before upgrading
qm snapshot 101 before-upgrade --description "Before apt dist-upgrade"

# Roll back if something breaks
qm rollback 101 before-upgrade

# Delete the snapshot when you're confident
qm delsnapshot 101 before-upgrade
```

For LXC containers:

```bash
pct snapshot 101 before-upgrade
pct rollback 101 before-upgrade
pct delsnapshot 101 before-upgrade
```

---

## Step 11 — Security Hardening

Proxmox is powerful — a compromised Proxmox host means every VM is
compromised too. Lock it down.

**Change the SSH port and restrict access:**

```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Restrict to LAN and Tailscale only by configuring UFW
ufw allow from 192.168.1.0/24 to any port 22
ufw allow from 100.64.0.0/10 to any port 22   # Tailscale
ufw enable
```

**Restrict the web UI to LAN only:**

```bash
# Allow web UI only from LAN
ufw allow from 192.168.1.0/24 to any port 8006
ufw allow from 100.64.0.0/10 to any port 8006   # Tailscale
```

**Set up two-factor authentication:**

In the Proxmox web UI: top right → your username → **Two Factor** →
add a TOTP app (Aegis, Bitwarden Authenticator, etc.).

This means even if someone gets your password, they can't log into the
web interface without your phone.

**Create a non-root admin user:**

```bash
# Create a Linux user
useradd -m -s /bin/bash yourusername
passwd yourusername

# Add to Proxmox as admin
pveum user add yourusername@pam
pveum aclmod / -user yourusername@pam -role Administrator
```

Then log in as this user and disable root login to the web interface.

---

## Useful CLI Commands

```bash
# List all VMs and containers with status
qm list
pct list

# Start/stop/restart
qm start 101
qm stop 101
pct start 102
pct stop 102

# Enter a container shell
pct enter 102

# Run a command inside a container without entering it
pct exec 102 -- bash -c "apt update && apt upgrade -y"

# Check resource usage across all guests
pvesh get /nodes/proxmox/status

# View task log (see what Proxmox is doing)
journalctl -u pvedaemon -f

# Check storage usage
pvesm status

# Update Proxmox itself
apt update && apt dist-upgrade -y
```

---

## Practical Container Layout for This Site's Stack

Here's a clean layout that runs everything from this site's guides on
a single 16GB RAM mini PC:

| CT ID | Hostname | RAM | Purpose |
|:-----:|:---------|:---:|:--------|
| 100 | ollama | 8192MB | Ollama + Open WebUI ([guide](/homelab/ollama-linux-setup)) |
| 101 | monitoring | 2048MB | Grafana + Prometheus ([guide](/homelab/grafana-prometheus-homelab)) |
| 102 | automation | 1024MB | n8n workflows ([guide](/homelab/n8n-ollama-automation)) |
| 103 | wireguard | 512MB | WireGuard VPN ([guide](/homelab/wireguard-tailscale-guide)) |
| 104 | ansible | 512MB | Ansible control node ([guide](/homelab/ansible-homelab-guide)) |

Total RAM allocation: ~12GB. Leaves 4GB for the Proxmox host and burst
headroom. All containers on `vmbr0` for LAN access, or move Wireguard to
a bridged interface for network separation.

Each service is isolated — you can snapshot, rebuild, or upgrade one
container without touching the others. That's the whole point.

---

## Troubleshooting

**Can't reach the web UI after install:**

```bash
# Check Proxmox services are running
systemctl status pveproxy pvedaemon

# Check what IP the host has
ip addr show

# Restart web service
systemctl restart pveproxy
```

**VM won't start — "TASK ERROR: start failed":**

Check the task log in the web UI (Task History at the bottom). Common
causes: not enough free RAM, storage pool full, or a conflicting device
in the VM hardware config.

**LXC container can't access the internet:**

```bash
# Inside the container
ping 1.1.1.1         # test IP connectivity
ping google.com      # test DNS

# If IP works but DNS fails, check resolv.conf
cat /etc/resolv.conf
# Should have a nameserver line — add if missing:
echo "nameserver 1.1.1.1" >> /etc/resolv.conf
```

**GPU passthrough — VM shows generic VGA instead of NVIDIA:**

IOMMU isn't enabled or the GPU isn't bound to VFIO. Check:

```bash
# Verify IOMMU is on
dmesg | grep -i iommu | head -5

# Verify GPU is bound to vfio-pci, not nvidia
lspci -nnk | grep -A3 "NVIDIA"
# Should show: Kernel driver in use: vfio-pci
```

If it shows `nvidia` instead of `vfio-pci`, the blacklist didn't apply.
Rebuild initramfs: `update-initramfs -u -k all` and reboot.

---

## What's Next

Your Proxmox host is now the foundation your entire homelab runs on.
Everything in the other guides on this site can run inside containers
or VMs managed from one web interface.

Natural next steps from here:

**Build a two-node cluster** — add a second mini PC, create a Proxmox
cluster, and enable live migration between nodes. One node can go down
for maintenance while services stay running on the other.

**Add Ceph storage** — Proxmox has native Ceph support. With three nodes
you can build a distributed storage cluster that survives a node failure
without losing data.

**Automate with Ansible** — the [Ansible guide](/homelab/ansible-homelab-guide)
includes everything you need to provision containers automatically.
Combined with Proxmox, you can rebuild your entire stack from a playbook
in under 10 minutes.

**Monitor everything** — connect the [Grafana + Prometheus stack](/homelab/grafana-prometheus-homelab)
to Proxmox. The `pve` exporter gives you VM CPU, memory, disk I/O, and
network graphs for every guest, all in one dashboard.

Proxmox is the piece that makes everything else composable. Once it's
running, the rest of the homelab is just containers.
