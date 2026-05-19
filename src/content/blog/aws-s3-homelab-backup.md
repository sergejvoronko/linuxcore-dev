---
title: "AWS S3 Backups for Your Homelab: Automated, Encrypted, Under €5/Month"
description: "Back up your homelab to AWS S3 and Glacier — Proxmox VMs, Docker volumes, Nextcloud — using restic with automated scheduling and real cost numbers."
pubDate: 2026-05-26
heroImage: "/images/aws-s3-homelab-backup.webp"
heroImageAlt: "AWS S3 console showing encrypted homelab backup buckets with Glacier lifecycle policy configured"
section: "homelab"
pillar: "AWS Hybrid"
type: "PILLAR"
tags: ["aws", "s3", "backup", "restic", "homelab", "linux", "glacier", "proxmox", "automation", "rclone"]
readingTime: 22
featured: false
draft: true
affiliate: true
faqs:
  - q: "How much does S3 storage cost per month for a homelab?"
    a: "S3 Standard costs approximately €0.023 per GB per month in eu-west-1. A 100 GB backup repository costs roughly €2.30/month. Adding a lifecycle policy to move data to Glacier after 30 days cuts the storage cost to €0.004 per GB — under €0.50/month for the same 100 GB."
  - q: "Does restic work with Glacier?"
    a: "Restic backs up to S3 Standard. Glacier is applied automatically via S3 lifecycle policies on the bucket — restic is not aware of it. Restoring from Glacier requires initiating a retrieval first, which takes minutes to hours depending on the tier."
  - q: "Is my data encrypted before it leaves my homelab?"
    a: "Yes. restic encrypts all data client-side using AES-256 before uploading. The encryption key never leaves your machine — not even AWS can read your backup data."
  - q: "Can I restore individual files without downloading the entire backup?"
    a: "Yes. restic supports granular restores. Use restic restore latest --target /restore/path --include /path/to/file to restore a single file or directory. You only download the relevant chunks."
---

Your homelab has a single point of failure that no amount of RAID,
redundant power supplies, or Proxmox snapshots protects against: the
location it sits in.

House fire. Flood. Theft. Power surge that kills multiple drives
simultaneously. These are low-probability events but not zero-probability
events. If your homelab is your only copy of your photos, documents,
configs, and VM data — you don't have a backup strategy, you have a
false sense of security.

The 3-2-1 backup rule: **3 copies** of data, on **2 different media**,
with **1 copy offsite**. Your homelab handles the first two. AWS handles
the third.

This guide builds a complete offsite backup pipeline using:

- **restic** — fast, encrypted, deduplicated backups to any storage backend
- **AWS S3** — object storage at €0.023/GB/month for active data
- **S3 Glacier Instant Retrieval** — €0.004/GB/month for archival data
- **AWS IAM** — locked-down credentials that can only write to one bucket
- **systemd timers** — reliable scheduling without cron's failure modes

A typical homelab with 100GB of important data costs under €3/month
to back up to S3. The config files and databases that actually matter —
probably under €0.50/month.

---

## What Gets Backed Up

Be deliberate about what you back up offsite. Not everything needs to
go to AWS. Large media libraries (movies, music) are replaceable. The
things that aren't replaceable:

**Back up offsite:**
- Proxmox VM configs (`/etc/pve/`)
- Docker volumes (databases, app data, config)
- Nextcloud user files
- Ansible playbooks and inventory
- SSL certificates and secrets (encrypted)
- Photos and personal documents
- Your homelab's `docker-compose.yml` and config files

**Don't back up offsite (too large, replaceable):**
- Jellyfin media library — re-download if needed
- Ollama model files — re-pull from ollama.com
- Proxmox ISO images — re-download from upstream
- System packages — reinstall from apt

Being selective keeps costs low and restore times fast.

---

## Part 1 — AWS Setup

### Step 1 — Create an AWS Account

Go to **aws.amazon.com** and create an account. You'll need a credit card
but won't be charged anything for the setup steps.

New accounts get 12 months of the **AWS Free Tier** which includes
5GB of S3 storage free. For a homelab backup strategy this is worth
knowing but don't depend on it for long-term cost planning.

---

### Step 2 — Create an S3 Bucket

In the AWS Console → **S3** → **Create bucket**.

Settings that matter:

```
Bucket name:      homelab-backup-YOURNAME    ← must be globally unique
AWS Region:       eu-central-1               ← Frankfurt, closest to Europe
                  (or eu-west-1 for Ireland, us-east-1 for US)
Object Ownership: ACLs disabled (recommended)
Block all public access: ✅ ENABLED          ← critical — never disable
Versioning:       Disabled                   ← restic handles versioning
Encryption:       SSE-S3 (server-side, free) ← enable
```

Click **Create bucket**.

---

### Step 3 — Configure Lifecycle Rules (Save Money on Old Backups)

S3 Standard costs €0.023/GB/month. S3 Glacier Instant Retrieval costs
€0.004/GB/month — 83% cheaper for data you rarely access.

Set up lifecycle rules to automatically move old backups to Glacier:

In your bucket → **Management** → **Lifecycle rules** → **Create rule**:

```
Rule name:        move-to-glacier
Status:           Enabled
Scope:            Apply to all objects in bucket

Transitions:
  → S3 Standard-IA after 30 days
  → S3 Glacier Instant Retrieval after 90 days

Expiration:
  → Delete objects after 365 days   (adjust to your retention needs)
```

With this rule, backups from the last month stay in Standard for fast
access. Older backups automatically migrate to Glacier. After a year,
they're deleted automatically.

**Estimated monthly cost for 100GB total backup data:**
- 10GB recent (Standard): €0.23
- 90GB archive (Glacier): €0.36
- S3 API requests: ~€0.05
- **Total: ~€0.64/month**

---

### Step 4 — Create a Locked-Down IAM User

Never use your root AWS account or a powerful IAM user for backups.
Create a dedicated user with the minimum permissions needed:
write to one specific bucket, nothing else.

**Create a policy:**

In the AWS Console → **IAM** → **Policies** → **Create policy** →
select **JSON**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::homelab-backup-YOURNAME"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListMultipartUploadParts",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::homelab-backup-YOURNAME/*"
    }
  ]
}
```

Name it `HomeLabBackupPolicy`. Click **Create policy**.

**Create a user:**

IAM → **Users** → **Create user**:
- Username: `homelab-backup`
- Attach policy: `HomeLabBackupPolicy`

After creating the user → **Security credentials** tab →
**Create access key** → select **Other** → Create.

**Save the Access Key ID and Secret Access Key now** — you can't
retrieve the secret key again after this screen.

---

## Part 2 — restic on Linux

restic is the best backup tool for this job. It deduplicates data
(so unchanged files take zero space), encrypts everything before
it leaves your machine, and has native S3 support.

### Step 5 — Install restic

```bash
# Ubuntu/Debian
sudo apt install restic -y

# Verify
restic version
```

---

### Step 6 — Initialise a restic Repository in S3

Set your AWS credentials as environment variables:

```bash
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
export RESTIC_REPOSITORY=s3:s3.amazonaws.com/homelab-backup-YOURNAME
export RESTIC_PASSWORD=YOUR_STRONG_BACKUP_PASSWORD
```

The `RESTIC_PASSWORD` encrypts your backups. **Write this down and
store it somewhere safe** — without it, your backups are unrecoverable.
A password manager like Vaultwarden (from the
[Docker Compose stack](/homelab/docker-compose-homelab-stack)) is ideal.

Initialise the repository (creates the restic index in S3):

```bash
restic init
```

You should see:
```
created restic repository abc123 at s3:s3.amazonaws.com/homelab-backup-YOURNAME
```

---

### Step 7 — Run Your First Backup

```bash
# Back up Docker volumes
restic backup /var/lib/docker/volumes \
  --exclude="*/overlay2/*"

# Back up home directory configs
restic backup ~/.config ~/homelab/config

# Back up Ansible playbooks
restic backup ~/homelab-ansible

# Back up Proxmox configs (run on the Proxmox host)
restic backup /etc/pve /var/lib/pve-cluster
```

First run will be slow — it uploads everything. Subsequent runs are
fast because restic only uploads new or changed chunks.

**Check what was stored:**

```bash
restic snapshots
```

Output:
```
ID        Time                 Host    Tags    Paths
─────────────────────────────────────────────────────────
a1b2c3d4  2026-05-26 02:00:03  server          /var/lib/docker/volumes
e5f6g7h8  2026-05-26 02:01:15  server          /home/user/homelab-ansible
```

---

### Step 8 — Create a Credentials File

Hardcoding credentials in scripts is bad practice. Store them in a
protected file instead:

```bash
sudo mkdir -p /etc/restic
sudo nano /etc/restic/s3-credentials.conf
```

```bash
# /etc/restic/s3-credentials.conf
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
export RESTIC_REPOSITORY=s3:s3.amazonaws.com/homelab-backup-YOURNAME
export RESTIC_PASSWORD=YOUR_STRONG_BACKUP_PASSWORD
```

```bash
# Restrict access — only root can read it
sudo chmod 600 /etc/restic/s3-credentials.conf
sudo chown root:root /etc/restic/s3-credentials.conf
```

---

### Step 9 — Create a Backup Script

```bash
sudo nano /usr/local/bin/homelab-backup.sh
```

```bash
#!/bin/bash
# /usr/local/bin/homelab-backup.sh
# Offsite backup to AWS S3 via restic

set -euo pipefail

LOG_FILE="/var/log/restic-backup.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Load credentials
source /etc/restic/s3-credentials.conf

log() {
  echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

log "=== Starting backup ==="

# ── Docker volumes ──────────────────────────────────────────────
log "Backing up Docker volumes..."
restic backup /var/lib/docker/volumes \
  --tag docker-volumes \
  --exclude="*/cache/*" \
  >> "$LOG_FILE" 2>&1

# ── Homelab configs ─────────────────────────────────────────────
log "Backing up homelab configs..."
restic backup \
  ~/homelab/config \
  ~/homelab/docker-compose.yml \
  ~/homelab-ansible \
  --tag configs \
  >> "$LOG_FILE" 2>&1

# ── Nextcloud user data ─────────────────────────────────────────
log "Backing up Nextcloud data..."
restic backup ~/homelab/data/nextcloud \
  --tag nextcloud \
  >> "$LOG_FILE" 2>&1

# ── Proxmox configs (adjust path for your setup) ────────────────
if [ -d "/etc/pve" ]; then
  log "Backing up Proxmox configs..."
  restic backup /etc/pve \
    --tag proxmox \
    >> "$LOG_FILE" 2>&1
fi

# ── Prune old snapshots ─────────────────────────────────────────
# Keep: 7 daily, 4 weekly, 6 monthly, 2 yearly
log "Pruning old snapshots..."
restic forget \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6 \
  --keep-yearly 2 \
  --prune \
  >> "$LOG_FILE" 2>&1

# ── Verify a sample of data ─────────────────────────────────────
# Check integrity without downloading everything
log "Running integrity check..."
restic check --read-data-subset=10% >> "$LOG_FILE" 2>&1

log "=== Backup complete ==="

# ── Send Telegram notification ──────────────────────────────────
# Uncomment and fill in your bot token/chat ID from the n8n guide
# SNAPSHOT_COUNT=$(restic snapshots --compact | tail -1)
# curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
#   -d "chat_id=${TELEGRAM_CHAT_ID}" \
#   -d "text=✅ Backup complete: ${SNAPSHOT_COUNT}" > /dev/null
```

```bash
sudo chmod +x /usr/local/bin/homelab-backup.sh
```

Test it:

```bash
sudo /usr/local/bin/homelab-backup.sh
cat /var/log/restic-backup.log
```

---

### Step 10 — Schedule with systemd Timer

systemd timers are more reliable than cron — they log properly, retry
on failure, and handle machines that were off at the scheduled time.

Create the service unit:

```bash
sudo nano /etc/systemd/system/restic-backup.service
```

```ini
[Unit]
Description=Restic backup to AWS S3
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/homelab-backup.sh
User=root
StandardOutput=journal
StandardError=journal
```

Create the timer unit:

```bash
sudo nano /etc/systemd/system/restic-backup.timer
```

```ini
[Unit]
Description=Run restic backup daily at 2am

[Timer]
OnCalendar=*-*-* 02:00:00
RandomizedDelaySec=30m    # adds random delay to avoid exact-time thundering
Persistent=true           # run immediately if machine was off at schedule time

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable restic-backup.timer
sudo systemctl start restic-backup.timer

# Verify timer is active
sudo systemctl status restic-backup.timer
sudo systemctl list-timers | grep restic
```

**Test a manual run via systemd (same as the real scheduled run):**

```bash
sudo systemctl start restic-backup.service

# Watch the logs
journalctl -u restic-backup.service -f
```

---

## Part 3 — Backing Up Proxmox VMs to S3

For full VM backups (not just configs), use Proxmox's built-in backup
tool combined with rclone to sync to S3.

### Proxmox vzdump + rclone

**Install rclone:**

```bash
curl https://rclone.org/install.sh | sudo bash
```

**Configure rclone with your S3 credentials:**

```bash
rclone config
```

Follow the prompts:
- New remote: `n`
- Name: `aws-s3`
- Storage: `s3`
- Provider: `AWS`
- Access key: your IAM access key
- Secret key: your IAM secret key
- Region: `eu-central-1` (or your region)
- Endpoint: leave blank
- Location constraint: `eu-central-1`
- ACL: `private`

**Create a Proxmox backup script:**

```bash
sudo nano /usr/local/bin/proxmox-backup-s3.sh
```

```bash
#!/bin/bash
# Back up all Proxmox VMs and sync to S3

BACKUP_DIR="/var/lib/vz/dump"
S3_PATH="aws-s3:homelab-backup-YOURNAME/proxmox-vms"
RETENTION_DAYS=7

# Run vzdump on all VMs (snapshot mode — non-disruptive)
vzdump --all --compress zstd --mode snapshot --storage local

# Sync to S3 (upload new, delete backups older than retention)
rclone sync "$BACKUP_DIR" "$S3_PATH" \
  --min-age "${RETENTION_DAYS}d" \
  --delete-before \
  --progress

echo "Proxmox backup to S3 complete"
```

```bash
sudo chmod +x /usr/local/bin/proxmox-backup-s3.sh
```

Run this weekly (VM backups are large — daily is expensive):

```bash
sudo nano /etc/systemd/system/proxmox-backup-s3.timer
```

```ini
[Unit]
Description=Weekly Proxmox VM backup to S3

[Timer]
OnCalendar=Sun *-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

---

## Part 4 — Restoring from Backup

A backup you haven't tested is not a backup. Test restores regularly —
at minimum, once after initial setup and once every few months.

**List all snapshots:**

```bash
source /etc/restic/s3-credentials.conf
restic snapshots
```

**Restore a specific snapshot to a directory:**

```bash
# Restore snapshot a1b2c3d4 to /tmp/restore
restic restore a1b2c3d4 --target /tmp/restore

# Restore only specific files from a snapshot
restic restore latest --target /tmp/restore \
  --include "/var/lib/docker/volumes/n8n_n8n-data"
```

**Restore the latest snapshot of a specific path:**

```bash
restic restore latest \
  --target /tmp/restore \
  --path /home/user/homelab-ansible
```

**Mount a snapshot to browse it (without full restore):**

```bash
# Mount the latest snapshot as a filesystem
mkdir /tmp/restic-mount
restic mount /tmp/restic-mount

# Browse like a regular directory
ls /tmp/restic-mount/snapshots/latest/

# Unmount when done
fusermount -u /tmp/restic-mount
```

---

## Real Cost Breakdown

Here's what a real homelab backup setup costs at typical sizes:

| Data | Size | Storage class | Monthly cost |
|:-----|:----:|:-------------:|:------------:|
| Docker volumes | 15GB | Standard (30 days) → Glacier | €0.35 → €0.06 |
| Nextcloud files | 50GB | Standard (30 days) → Glacier | €1.15 → €0.20 |
| Ansible + configs | 1GB | Standard | €0.02 |
| Proxmox VM backups | 40GB | Standard (30 days) → Glacier | €0.92 → €0.16 |
| API requests | — | — | ~€0.05 |
| **Total (first month)** | **106GB** | | **~€2.49** |
| **Total (after 90 days, Glacier)** | | | **~€0.49** |

Once the lifecycle rules kick in and most data moves to Glacier, a
comprehensive homelab backup costs under €1/month. Less than a coffee.

**Data transfer costs:**

Uploading to S3 is free. Downloading (restore) costs €0.09/GB for the
first 10TB. A full restore of 100GB costs €9. For a disaster recovery
scenario, that's irrelevant.

---

## Monitoring Your Backups

The backup that silently fails for three months and you only discover
it when you need to restore — that's the worst outcome. Monitor it.

**Check last successful backup:**

```bash
source /etc/restic/s3-credentials.conf
restic snapshots --latest 1
```

**View backup logs:**

```bash
journalctl -u restic-backup.service --since "7 days ago"
```

**Set up a Telegram alert for backup failures** using the
[n8n automation guide](/homelab/n8n-ollama-automation):

Create a workflow: **Schedule Trigger** (daily, 9am) →
**Execute Command** (`systemctl is-active restic-backup.service`) →
**IF** (last run failed) → **Telegram** ("⚠️ Backup failed — check logs").

Or add the notification directly to the backup script (lines are already
commented out in the script above — uncomment and fill in your token).

---

## Security: What Happens if Your AWS Credentials Are Stolen

This is the right question to ask. If an attacker gets your IAM
credentials they can:

- Read your backups (they're encrypted — useless without your restic password)
- Upload data to your bucket (costs you money, but can be blocked with budget alerts)
- Delete your backups (this is the real risk)

**Protect against deletion with S3 Object Lock:**

In your S3 bucket settings → **Object Lock** → Enable.
Set a retention period of 30 days in Governance mode.

With Object Lock enabled, no credentials — even root — can delete
objects before the retention period expires. Your backups are protected
even from a fully compromised AWS account.

**Set a billing alert:**

AWS Console → **Billing** → **Budgets** → Create budget.
Set an alert at €10/month — any unexpected spike in S3 usage will
notify you before it costs much.

**The restic encryption is your last line of defence:**

Even if AWS is compromised, your data is AES-256 encrypted before
it ever leaves your machine. The attacker gets encrypted blobs that
are computationally unfeasible to decrypt without your restic password.
Store that password in Vaultwarden, not in your head.

---

## The Complete Offsite Backup Picture

Combined with the other guides on this site, your data now has
multiple protection layers:

| Layer | Tool | What it protects against |
|:------|:-----|:------------------------|
| Snapshots | Proxmox (from [Proxmox guide](/homelab/proxmox-homelab-setup)) | Accidental deletion, bad updates |
| Local backup | Docker volume mounts | Container failure |
| NAS backup | Your OpenMediaVault | Single-drive failure |
| Offsite backup | restic + AWS S3 (this guide) | Site-level disaster, theft |
| Monitoring | Grafana + Prometheus (from [monitoring guide](/homelab/grafana-prometheus-homelab)) | Detect failures early |

The 3-2-1 rule is now satisfied: your important data lives on your main
machine (copy 1), on your OpenMediaVault NAS (copy 2, different media),
and on AWS S3 in a different geographical location (copy 3, offsite).

That's a backup strategy. Not a false sense of security.
