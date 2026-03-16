# SITSYS Administration Guide
**Version:** 2.6  
**Last Updated:** March 16, 2026  
**System Owner:** obrand@gistlink.net

---

## Table of Contents

### Quick Reference
- [Emergency Procedures](#emergency-procedures)
- [Daily Operations](#daily-operations)

### System Administration
1. [System Overview](#1-system-overview)
2. [Service Management](#2-service-management)
3. [Database Management](#3-database-management)
4. [Backup & Restore](#4-backup--restore)
5. [User Administration](#5-user-administration)
6. [Code Repository & Version Control](#6-code-repository--version-control)
7. [Deployment Procedures](#7-deployment-procedures)
8. [Security](#8-security)
9. [Monitoring & Maintenance](#9-monitoring--maintenance)
10. [Troubleshooting](#10-troubleshooting)
11. [Disaster Recovery](#11-disaster-recovery)

---

## Emergency Procedures

### Service is Down (502 Error)
```bash
# Check service status
sudo systemctl status msp-ticketing

# View recent errors
sudo journalctl -u msp-ticketing -n 50 --no-pager

# Restart service
sudo systemctl restart msp-ticketing

# If syntax error, check server.js
cd /var/www/sitsys/ticketing && node server.js
```

### Restore from Backup (Database Corrupted)
```bash
# Stop service
sudo systemctl stop msp-ticketing

# List available backups
ls -lh /var/www/sitsys/ticketing/backups/

# Restore most recent backup
gunzip -c /var/www/sitsys/ticketing/backups/ticketing_YYYYMMDD_HHMMSS.db.gz > /var/www/sitsys/ticketing/ticketing.db

# Fix permissions
sudo chown www-data:www-data /var/www/sitsys/ticketing/ticketing.db

# Restart service
sudo systemctl start msp-ticketing
```

### Rollback Code Changes
```bash
cd /var/www/sitsys

# See recent commits
git log --oneline -10

# Revert to specific commit
git reset --hard <commit-hash>

# Restart service
sudo systemctl restart msp-ticketing
```

---

## Daily Operations

### Check System Health
```bash
# Service status
sudo systemctl status msp-ticketing

# Last backup time (check Statistics page)
# Or check manually:
ls -lht /var/www/sitsys/ticketing/backups/ | head -3

# Disk space
df -h /var/www

# View recent logs
sudo journalctl -u msp-ticketing -n 20 --no-pager
```

### Create Manual Backup
```bash
sudo -u www-data /var/www/sitsys/ticketing/backup.sh
```

---

## 1. System Overview

### Architecture
- **Frontend:** Single-page HTML/CSS/JavaScript application
- **Backend:** Node.js (Express framework)
- **Database:** SQLite (single file database)
- **Web Server:** Nginx (reverse proxy)
- **Process Manager:** systemd service

### Directory Structure
```
/var/www/sitsys/
├── ticketing/              # Current ticketing system
│   ├── server.js          # Node.js backend
│   ├── public/
│   │   └── index.html     # Frontend application
│   ├── ticketing.db       # SQLite database
│   ├── backups/           # Automated backups
│   ├── backup.sh          # Backup script
│   ├── package.json       # Node dependencies
│   └── node_modules/      # Installed packages
├── docs/                  # Documentation
├── scripts/               # Utility scripts (future)
└── .git/                  # Git repository
```

### Key Files & Locations
| Component | Location |
|-----------|----------|
| Application Root | `/var/www/sitsys/ticketing/` |
| Frontend HTML | `/var/www/sitsys/ticketing/public/index.html` |
| Backend Server | `/var/www/sitsys/ticketing/server.js` |
| Database | `/var/www/sitsys/ticketing/ticketing.db` |
| Backups | `/var/www/sitsys/ticketing/backups/` |
| Deploy Script | `/usr/local/bin/sitsys-deploy` |
| Systemd Service | `/etc/systemd/system/msp-ticketing.service` |
| Nginx Config | `/etc/nginx/sites-enabled/msp-ticketing` |
| SSL Certificates | `/etc/letsencrypt/live/tickets.sitsys.co/` |
| Logs | `sudo journalctl -u msp-ticketing` |

### Network Configuration
- **Domain:** tickets.sitsys.co
- **HTTP Port:** 80 (redirects to HTTPS)
- **HTTPS Port:** 443 (SSL)
- **Node.js Port:** 3000 (internal, proxied by nginx)
- **SSL:** Let's Encrypt

---

## 2. Service Management

### Service Commands
```bash
# Check status
sudo systemctl status msp-ticketing

# Start service
sudo systemctl start msp-ticketing

# Stop service
sudo systemctl stop msp-ticketing

# Restart service
sudo systemctl restart msp-ticketing

# Enable service (start on boot)
sudo systemctl enable msp-ticketing

# Disable service (don't start on boot)
sudo systemctl disable msp-ticketing

# Reload systemd configuration (after editing service file)
sudo systemctl daemon-reload
```

### View Logs
```bash
# Last 50 lines
sudo journalctl -u msp-ticketing -n 50 --no-pager

# Follow logs in real-time
sudo journalctl -u msp-ticketing -f

# Logs from today
sudo journalctl -u msp-ticketing --since today

# Logs from last hour
sudo journalctl -u msp-ticketing --since "1 hour ago"

# Search for errors
sudo journalctl -u msp-ticketing | grep -i error
```

### Nginx Management
```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx (no downtime)
sudo nginx -s reload
# OR
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

---

## 3. Database Management

### Database Information
- **Type:** SQLite 3
- **Location:** `/var/www/sitsys/ticketing/ticketing.db`
- **Owner:** www-data:www-data
- **Size:** Check with `ls -lh /var/www/sitsys/ticketing/ticketing.db`

### Database Schema
```sql
-- Core Tables
users               -- System users (admins and technicians)
tickets             -- Support tickets
clients             -- Customer companies
client_contacts     -- Contact persons at client companies
ticket_notes        -- Notes on tickets (internal and client-facing)
time_entries        -- Time tracking on tickets
```

### Direct Database Access
```bash
# Open database
sqlite3 /var/www/sitsys/ticketing/ticketing.db

# Common queries
.tables                                    # List all tables
.schema users                              # Show table structure
SELECT * FROM users;                       # List all users
SELECT COUNT(*) FROM tickets;              # Count tickets
SELECT * FROM tickets ORDER BY created_at DESC LIMIT 10;  # Recent tickets

# Exit
.quit
```

### Database Maintenance
```bash
# Optimize database (reclaim space)
sqlite3 /var/www/sitsys/ticketing/ticketing.db "VACUUM;"

# Check database integrity
sqlite3 /var/www/sitsys/ticketing/ticketing.db "PRAGMA integrity_check;"

# View database size
ls -lh /var/www/sitsys/ticketing/ticketing.db
```

---

## 4. Backup & Restore

### Automated Backups
- **Schedule:** Every hour (via cron)
- **Retention:** Last 7 days
- **Location:** `/var/www/sitsys/ticketing/backups/`
- **Format:** Compressed SQLite backup (`.db.gz`)
- **Cron Job:** Runs as `www-data` user

### View Backup Status
```bash
# List all backups
ls -lh /var/www/sitsys/ticketing/backups/

# Check most recent backup
ls -lt /var/www/sitsys/ticketing/backups/ | head -3

# Check backup size
du -sh /var/www/sitsys/ticketing/backups/

# View in UI
# Go to Statistics page - shows "Last Backup" card
```

### Manual Backup
```bash
# Run backup script
sudo -u www-data /var/www/sitsys/ticketing/backup.sh

# Create one-time backup with custom name
sqlite3 /var/www/sitsys/ticketing/ticketing.db ".backup /tmp/ticketing-manual-$(date +%Y%m%d).db"
gzip /tmp/ticketing-manual-*.db
```

### Restore from Backup
```bash
# 1. STOP THE SERVICE FIRST
sudo systemctl stop msp-ticketing

# 2. List available backups
ls -lht /var/www/sitsys/ticketing/backups/

# 3. Restore specific backup
gunzip -c /var/www/sitsys/ticketing/backups/ticketing_20260306_120000.db.gz > /var/www/sitsys/ticketing/ticketing.db

# 4. Fix ownership
sudo chown www-data:www-data /var/www/sitsys/ticketing/ticketing.db

# 5. Start service
sudo systemctl start msp-ticketing

# 6. Verify it works
sudo systemctl status msp-ticketing
```

### Backup Cron Configuration
```bash
# View current cron jobs for www-data
sudo crontab -u www-data -l

# Should show:
# 0 * * * * /var/www/sitsys/ticketing/backup.sh

# Edit cron if needed
sudo crontab -u www-data -e
```

### Download Backup Off-Server
```bash
# From your local machine:
scp linuxuser@104.207.141.167:/var/www/sitsys/ticketing/backups/ticketing_YYYYMMDD_HHMMSS.db.gz ~/Desktop/
```

---

## 5. User Administration

### User Roles
- **admin:** Full access, can create users, manage all tickets
- **technician:** Can manage tickets, clients, contacts; cannot create users

### Create User via UI
1. Login as admin
2. Navigate to **Users** page
3. Click **+ User** button
4. Fill in:
   - Username (required)
   - Password (required)
   - Full Name
   - Email
   - Role (admin or technician)
5. Click **Create User**

### Create User via Command Line
```bash
# Using Node.js script
cd /var/www/sitsys/ticketing
node create-user.js

# Follow prompts for:
# - Username
# - Password
# - Full name
# - Email
# - Role
```

### Reset User Password (Direct Database)
```bash
# Open database
sqlite3 /var/www/sitsys/ticketing/ticketing.db

# View users
SELECT id, username, full_name, role FROM users;

# Reset password (requires knowing how to hash)
# Easier: Create new user, delete old user via UI

# Or use Node.js to hash password:
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('newpassword', 10).then(hash => console.log(hash));"

# Then update in DB:
UPDATE users SET password = '<hashed_password>' WHERE username = 'targetuser';
```

### Delete User
```bash
# Via database (service should be stopped)
sudo systemctl stop msp-ticketing

sqlite3 /var/www/sitsys/ticketing/ticketing.db
DELETE FROM users WHERE username = 'olduser';
.quit

sudo systemctl start msp-ticketing
```

### Default Credentials
After fresh install:
- **Username:** admin
- **Password:** admin123
- **⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN**

---

## 6. Code Repository & Version Control

### Git Repository Information
- **Repository:** https://github.com/eauxnguyen/sitsys (private)
- **Local Path:** `/var/www/sitsys/`
- **Branch:** main
- **User:** eauxnguyen (obrand@gistlink.net)

### Standard Deploy Workflow (Recommended)

All frontend changes to `index.html` should follow this pattern:

1. Build the updated `index.html` (locally or with Claude)
2. Deploy the file to the server:
   ```bash
   cp /path/to/new/index.html /var/www/sitsys/ticketing/public/index.html
   ```
3. Run the deploy script to commit and push to GitHub:
   ```bash
   sitsys-deploy "Brief description of change"
   ```

This ensures production and GitHub are always in sync and every change is rollback-able.

### The sitsys-deploy Script

Located at `/usr/local/bin/sitsys-deploy`. Run from anywhere after deploying a new file.

```bash
# With a custom commit message (recommended)
sitsys-deploy "Add full-text search to ticket notes"

# With default message
sitsys-deploy
```

The script:
- Stages `ticketing/public/index.html`
- Commits with your message (or a default message if none provided)
- Pushes to GitHub `main` branch
- Confirms success

**Source of the script** (`/usr/local/bin/sitsys-deploy`):
```bash
#!/bin/bash
set -e

PROD="/var/www/sitsys/ticketing/public/index.html"
REPO="/var/www/sitsys"
MSG="${1:-Deploy: update index.html}"

echo "→ Committing current production file..."
cd "$REPO"
git add ticketing/public/index.html
git commit -m "$MSG" || echo "Nothing to commit"
git push origin main

echo "✓ Done — production is in sync with GitHub"
```

### Basic Git Workflow
```bash
# Navigate to repo
cd /var/www/sitsys

# Check status (what files changed)
git status

# View changes
git diff

# Add all changes
git add .

# Commit changes
git commit -m "Description of what you changed"

# Push to GitHub
git push

# Pull latest from GitHub
git pull
```

### View History
```bash
# Recent commits
git log --oneline -10

# Detailed history
git log --graph --oneline --decorate --all

# See what changed in a specific file
git log --follow ticketing/server.js

# View specific commit
git show <commit-hash>
```

### Rollback Changes
```bash
# Undo local changes (not committed)
git checkout -- ticketing/server.js

# Revert to previous commit (creates new commit)
git revert <commit-hash>

# Hard reset to previous state (DESTRUCTIVE)
git reset --hard <commit-hash>

# Restore specific file from previous commit
git checkout <commit-hash> -- ticketing/public/index.html
```

### Branching (for testing changes)
```bash
# Create new branch for feature
git checkout -b feature-name

# Make changes, test, commit
git add .
git commit -m "Tested new feature"

# Switch back to main
git checkout main

# Merge feature if it works
git merge feature-name

# Delete feature branch
git branch -d feature-name
```

### What NOT to Commit
The `.gitignore` file excludes:
- `*.db` (database files)
- `backups/` (backup directory)
- `node_modules/` (installed packages)
- `*.log` (log files)
- `.env` (environment secrets)
- `*.backup-*` (backup copies of index.html)

---

## 7. Deployment Procedures

### Standard Frontend Deployment (index.html)

This is the primary workflow for UI changes. Always use atomic file swap + deploy script.

```bash
# 1. Copy new file to production
cp /path/to/new/index.html /var/www/sitsys/ticketing/public/index.html

# 2. Commit and push to GitHub in one command
sitsys-deploy "Description of what changed"

# 3. Verify site is working
curl -I https://tickets.sitsys.co
```

No service restart needed for frontend-only changes — Nginx serves the file directly.

### Deploy Backend Changes (server.js)

```bash
# 1. Edit file
sudo nano /var/www/sitsys/ticketing/server.js

# 2. Test syntax
cd /var/www/sitsys/ticketing && node server.js
# Press Ctrl+C if no errors

# 3. Commit and push
cd /var/www/sitsys
git add ticketing/server.js
git commit -m "Description of change"
git push

# 4. Restart service
sudo systemctl restart msp-ticketing

# 5. Verify
sudo systemctl status msp-ticketing
```

**Method 2: Develop locally, push to GitHub, pull on server**
```bash
# On your local machine:
# - Make changes
# - Test locally
# - Commit and push to GitHub

# On server:
cd /var/www/sitsys
git pull
sudo systemctl restart msp-ticketing
```

### Update Dependencies
```bash
cd /var/www/sitsys/ticketing

# Update packages
npm update

# Install new package
npm install package-name

# Commit package.json changes
cd /var/www/sitsys
git add ticketing/package.json ticketing/package-lock.json
git commit -m "Updated dependencies"
git push

# Restart service
sudo systemctl restart msp-ticketing
```

### Database Schema Changes
```bash
# 1. BACKUP FIRST
sudo -u www-data /var/www/sitsys/ticketing/backup.sh

# 2. Stop service
sudo systemctl stop msp-ticketing

# 3. Make schema changes
sqlite3 /var/www/sitsys/ticketing/ticketing.db
# Run your ALTER TABLE or CREATE TABLE commands
.quit

# 4. Update server.js code to use new schema

# 5. Test
cd /var/www/sitsys/ticketing && node server.js
# Ctrl+C if no errors

# 6. Start service
sudo systemctl start msp-ticketing

# 7. Verify
sudo systemctl status msp-ticketing

# 8. Commit changes
cd /var/www/sitsys
git add .
git commit -m "Database schema update: description"
git push
```

### Pre-Deployment Checklist
- [ ] Backup database
- [ ] Test changes locally or in separate branch
- [ ] Commit changes to git
- [ ] Have rollback plan ready
- [ ] Know current commit hash (for rollback)
- [ ] Check disk space: `df -h`
- [ ] Verify backup exists: `ls -lh /var/www/sitsys/ticketing/backups/ | head -3`

### Post-Deployment Verification
```bash
# Service running?
sudo systemctl status msp-ticketing

# No errors in logs?
sudo journalctl -u msp-ticketing -n 50 --no-pager | grep -i error

# Website loading?
curl -I https://tickets.sitsys.co

# Test login and basic functions manually
```

---

## 8. Security

### SSL/HTTPS
- **Provider:** Let's Encrypt
- **Renewal:** Automatic via certbot
- **Certificate Location:** `/etc/letsencrypt/live/tickets.sitsys.co/`
- **Expiry Check:** `sudo certbot certificates`

### Renew SSL Certificate Manually
```bash
# Test renewal (dry run)
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Reload nginx after renewal
sudo systemctl reload nginx
```

### Server Access
- **SSH:** Port 22
- **User:** linuxuser
- **Authentication:** SSH key (recommended) or password

### Change SSH to Key-Only (Disable Password)
```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Set:
PasswordAuthentication no
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

### Firewall (UFW)
```bash
# Check status
sudo ufw status

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow HTTP (for Let's Encrypt renewal)
sudo ufw allow 80/tcp

# Allow SSH
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Application Security
- Passwords stored as bcrypt hashes (not plaintext)
- Session-based authentication
- HTTPS enforced (HTTP redirects to HTTPS)
- SQL injection protected (parameterized queries)
- XSS protection via escaping user input

### Password Policy
- Minimum 8 characters (enforced in UI)
- Change default admin password immediately
- No password reuse
- Consider 2FA in future

---

## 9. Monitoring & Maintenance

### Disk Space
```bash
# Check available space
df -h /var/www

# Check database size
ls -lh /var/www/sitsys/ticketing/ticketing.db

# Check backup directory size
du -sh /var/www/sitsys/ticketing/backups/

# Find large files
find /var/www/sitsys -type f -size +10M -exec ls -lh {} \;
```

### Service Uptime
```bash
# How long has service been running?
sudo systemctl status msp-ticketing | grep Active

# Server uptime
uptime
```

### Performance Monitoring
```bash
# CPU and memory usage
top
# Press 'q' to quit

# Or use htop (if installed)
htop

# Node.js process specifically
ps aux | grep node
```

### Log Rotation
Logs are managed by systemd/journald and rotated automatically.

```bash
# View log disk usage
sudo journalctl --disk-usage

# Clean logs older than 7 days
sudo journalctl --vacuum-time=7d

# Limit logs to 100MB
sudo journalctl --vacuum-size=100M
```

### Regular Maintenance Tasks

**Weekly:**
- Check disk space
- Verify backups are running
- Review error logs
- Test restore from backup (monthly)

**Monthly:**
- Update system packages: `sudo apt update && sudo apt upgrade`
- Review user accounts
- Check SSL certificate expiry
- Database optimization: `sqlite3 /var/www/sitsys/ticketing/ticketing.db "VACUUM;"`

**Quarterly:**
- Review and update documentation
- Test disaster recovery plan
- Security audit

---

## 10. Troubleshooting

### 502 Bad Gateway
**Cause:** Node.js service is not running

**Solution:**
```bash
# Check service status
sudo systemctl status msp-ticketing

# View errors
sudo journalctl -u msp-ticketing -n 50 --no-pager

# Common issues:
# - Syntax error in server.js
# - Port 3000 already in use
# - Database locked

# Restart service
sudo systemctl restart msp-ticketing
```

### 500 Internal Server Error
**Cause:** Application error

**Solution:**
```bash
# Check logs for error
sudo journalctl -u msp-ticketing -n 100 --no-pager | grep -i error

# Common issues:
# - Database locked (another process accessing it)
# - Missing environment variable
# - Crashed route handler

# Restart usually fixes it
sudo systemctl restart msp-ticketing
```

### Cannot Login / Session Issues
**Cause:** Session storage issue or wrong credentials

**Solution:**
```bash
# Verify user exists
sqlite3 /var/www/sitsys/ticketing/ticketing.db "SELECT username, role FROM users;"

# Check if password is correct (create new user if needed)

# Clear browser cookies and try again
```

### Database Locked
**Cause:** Multiple processes accessing database simultaneously

**Solution:**
```bash
# Check what's accessing database
sudo lsof /var/www/sitsys/ticketing/ticketing.db

# Kill process if needed
sudo kill <PID>

# Restart service
sudo systemctl restart msp-ticketing
```

### High Memory Usage
**Cause:** Node.js memory leak or large result sets

**Solution:**
```bash
# Check memory usage
free -h

# Restart service (clears memory)
sudo systemctl restart msp-ticketing

# Check for memory leaks in logs
sudo journalctl -u msp-ticketing | grep -i memory
```

### Nginx Won't Start
**Cause:** Configuration error or port already in use

**Solution:**
```bash
# Test nginx config
sudo nginx -t

# Check what's using port 80/443
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Fix config and reload
sudo systemctl reload nginx
```

### Git Push Failed
**Cause:** Authentication issue or merge conflict

**Solution:**
```bash
# Test SSH to GitHub
ssh -T git@github.com

# Pull latest changes first
git pull

# If merge conflict, resolve and commit
git status
# Edit conflicted files
git add .
git commit -m "Resolved merge conflict"
git push
```

### sitsys-deploy Reports Nothing to Commit
**Cause:** The file on disk matches what's already in GitHub — no change detected.

**Solution:**
```bash
# Verify the production file was actually updated
ls -lh /var/www/sitsys/ticketing/public/index.html

# Check git status manually
cd /var/www/sitsys && git status

# If file genuinely changed but git doesn't see it:
git add -f ticketing/public/index.html
git status
```

### Backup Not Running
**Cause:** Cron job not configured or backup script error

**Solution:**
```bash
# Check cron job
sudo crontab -u www-data -l

# Run backup manually to test
sudo -u www-data /var/www/sitsys/ticketing/backup.sh

# Check if backups directory exists
ls -la /var/www/sitsys/ticketing/backups/

# Check cron logs
sudo grep CRON /var/log/syslog | tail -20
```

---

## 11. Disaster Recovery

### Complete Server Failure

**What You Need:**
- Latest backup from `/var/www/sitsys/ticketing/backups/`
- Git repository: https://github.com/eauxnguyen/sitsys
- This documentation
- SSL certificates (Let's Encrypt can reissue)

**Recovery Steps:**

**1. Set up new server**
```bash
# Install required packages
sudo apt update
sudo apt install -y nginx nodejs npm sqlite3 git certbot python3-certbot-nginx

# Create directory structure
sudo mkdir -p /var/www/sitsys
```

**2. Clone code from GitHub**
```bash
cd /var/www
sudo git clone git@github.com:eauxnguyen/sitsys.git
sudo chown -R linuxuser:linuxuser sitsys/
```

**3. Install dependencies**
```bash
cd /var/www/sitsys/ticketing
npm install
```

**4. Restore database**
```bash
# Copy backup file to server (from local machine or off-site backup)
scp ticketing_backup.db.gz linuxuser@new-server:/tmp/

# On server:
gunzip /tmp/ticketing_backup.db.gz
sudo mv /tmp/ticketing_backup.db /var/www/sitsys/ticketing/ticketing.db
sudo chown www-data:www-data /var/www/sitsys/ticketing/ticketing.db
```

**5. Configure systemd service**
```bash
sudo cp /var/www/sitsys/ticketing/msp-ticketing.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable msp-ticketing
sudo systemctl start msp-ticketing
```

**6. Configure nginx**
```bash
sudo cp /var/www/sitsys/ticketing/nginx-config.conf /etc/nginx/sites-available/msp-ticketing
sudo ln -s /etc/nginx/sites-available/msp-ticketing /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**7. Reinstall deploy script**
```bash
sudo tee /usr/local/bin/sitsys-deploy << 'EOF'
#!/bin/bash
set -e

PROD="/var/www/sitsys/ticketing/public/index.html"
REPO="/var/www/sitsys"
MSG="${1:-Deploy: update index.html}"

echo "→ Committing current production file..."
cd "$REPO"
git add ticketing/public/index.html
git commit -m "$MSG" || echo "Nothing to commit"
git push origin main

echo "✓ Done — production is in sync with GitHub"
EOF
sudo chmod +x /usr/local/bin/sitsys-deploy
```

**8. Set up SSL**
```bash
sudo certbot --nginx -d tickets.sitsys.co
```

**9. Verify**
- Visit https://tickets.sitsys.co
- Test login
- Check all functionality

**10. Set up backups**
```bash
# Add cron job
(sudo crontab -u www-data -l 2>/dev/null; echo "0 * * * * /var/www/sitsys/ticketing/backup.sh") | sudo crontab -u www-data -
```

### Data Loss Prevention
- **Primary:** Hourly automated backups (7-day retention)
- **Secondary:** Git repository on GitHub — every deploy is committed automatically via `sitsys-deploy`
- **Tertiary:** Manual weekly off-server backups (recommended)

```bash
# Set up automated off-server backup (run from local machine)
# Add to crontab on local machine:
0 2 * * 0 scp linuxuser@104.207.141.167:/var/www/sitsys/ticketing/backups/ticketing_*.db.gz ~/SITSYS-Backups/
```

---

## Appendix A: Quick Command Reference

### Service Management
```bash
sudo systemctl status msp-ticketing      # Check status
sudo systemctl restart msp-ticketing     # Restart
sudo journalctl -u msp-ticketing -f      # Watch logs
```

### Database
```bash
sqlite3 /var/www/sitsys/ticketing/ticketing.db    # Open DB
ls -lh /var/www/sitsys/ticketing/ticketing.db     # Check size
```

### Backups
```bash
sudo -u www-data /var/www/sitsys/ticketing/backup.sh    # Manual backup
ls -lht /var/www/sitsys/ticketing/backups/ | head -3    # Recent backups
```

### Git & Deploy
```bash
sitsys-deploy "description"              # Commit + push index.html (standard deploy)
cd /var/www/sitsys
git status                               # Check changes
git add . && git commit -m "msg"        # Manual commit
git push                                 # Push to GitHub
git log --oneline -10                   # Recent commits
git reset --hard <hash>                 # Rollback to commit
```

### Nginx
```bash
sudo nginx -t                            # Test config
sudo systemctl reload nginx              # Reload config
```

---

## Appendix B: Contact Information

**System Administrator:** obrand@gistlink.net  
**GitHub Repository:** https://github.com/eauxnguyen/sitsys  
**Server:** 104.207.141.167 (core01)  
**Domain:** tickets.sitsys.co  

**Hosting Provider:** Vultr  
**DNS Provider:** (Add your DNS provider)  
**SSL Provider:** Let's Encrypt (auto-renew via certbot)

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | March 6, 2026 | Initial comprehensive guide | obrand@gistlink.net |
| 2.6 | March 16, 2026 | Added sitsys-deploy script; updated deploy workflow, disaster recovery, troubleshooting, quick reference | obrand@gistlink.net |

---

**END OF DOCUMENT**
