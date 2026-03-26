# SITSYS Administration Guide
**Version:** 2.7  
**Last Updated:** March 26, 2026  
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
8. [Email-to-Ticket Integration](#8-email-to-ticket-integration) **← NEW**
9. [Security](#9-security)
10. [Monitoring & Maintenance](#10-monitoring--maintenance)
11. [Troubleshooting](#11-troubleshooting)
12. [Disaster Recovery](#12-disaster-recovery)

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

# Check email-to-ticket activity (if enabled)
sudo journalctl -u msp-ticketing --since "1 hour ago" | grep -i "email"
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
- **Email Integration:** SendGrid Inbound Parse + Microsoft 365

### Directory Structure
```
/var/www/sitsys/
├── ticketing/              # Current ticketing system
│   ├── server.js          # Node.js backend (includes email webhook)
│   ├── public/
│   │   └── index.html     # Frontend application
│   ├── ticketing.db       # SQLite database
│   ├── backups/           # Automated backups
│   ├── backup.sh          # Backup script
│   ├── package.json       # Node dependencies
│   └── node_modules/      # Installed packages (includes multer)
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
- **Email Webhook:** https://tickets.sitsys.co/api/email-to-ticket (public endpoint)

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

# Email-specific logs
sudo journalctl -u msp-ticketing | grep -i "email"
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
SELECT * FROM tickets WHERE category='Email';  # Email-created tickets

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
scp linuxuser@104.207.141.167:/var/www/sitsys/ticketing/backups/ticketing_*.db.gz ~/Downloads/
```

---

## 5. User Administration

### Default Admin Account
- **Username:** admin
- **Default Password:** admin123
- **⚠️ CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN**

### User Management
All user management is done through the web UI:
1. Log in as admin
2. Click "Admin" menu → "Users"
3. Add/edit/delete users

### User Roles
- **admin** - Full system access, can manage users
- **technician** - Can manage tickets, clients, and time entries (cannot manage users)

### Reset User Password (Direct Database)
```bash
# ONLY use this if locked out - normally use the web UI

# 1. Generate new hash (replace 'newpassword' with actual password)
node -e "console.log(require('bcrypt').hashSync('newpassword', 10))"

# 2. Update database
sqlite3 /var/www/sitsys/ticketing/ticketing.db
UPDATE users SET password='<hash-from-step-1>' WHERE username='admin';
.quit

# 3. Restart service
sudo systemctl restart msp-ticketing
```

---

## 6. Code Repository & Version Control

### Git Repository
- **URL:** https://github.com/eauxnguyen/sitsys
- **Branch:** main
- **Visibility:** Private
- **Local Path:** `/var/www/sitsys/`

### Authentication
```bash
# SSH key should be configured for linuxuser
ssh -T git@github.com
# Should show: "Hi eauxnguyen! You've successfully authenticated..."
```

### Common Git Operations
```bash
cd /var/www/sitsys

# Check status
git status

# View recent commits
git log --oneline -10

# Pull latest changes
git pull origin main

# Manual commit (if needed)
git add .
git commit -m "Description of changes"
git push origin main

# View remote URL
git remote -v
```

### Branching Strategy
- **main** branch - Production code
- Feature branches - For major changes (create, test, then merge)

```bash
# Create feature branch
git checkout -b feature/new-functionality

# Work on changes...
git add .
git commit -m "Add new functionality"

# Push feature branch
git push origin feature/new-functionality

# Merge to main (after testing)
git checkout main
git merge feature/new-functionality
git push origin main
```

---

## 7. Deployment Procedures

### Deployment Strategy
SITSYS uses **atomic full-file replacement** for deployments to avoid partial updates and sed-related issues.

### Deploy Script: `sitsys-deploy`
**Location:** `/usr/local/bin/sitsys-deploy`

**Purpose:** Commits and pushes `index.html` changes to GitHub

**Usage:**
```bash
# Standard deploy with message
sitsys-deploy "Updated ticket search UI"

# Default message if none provided
sitsys-deploy
```

**What it does:**
1. Changes to `/var/www/sitsys` directory
2. Stages `ticketing/public/index.html`
3. Commits with provided message
4. Pushes to `origin/main`

### Standard Deployment Workflow

**For Frontend Changes (index.html):**
```bash
# 1. Make changes locally on your machine
# 2. Upload via WinSCP to /home/linuxuser/index.html
# 3. SSH into server

# 4. Copy to production
sudo cp /home/linuxuser/index.html /var/www/sitsys/ticketing/public/index.html

# 5. Test in browser (no restart needed for static files)

# 6. Commit to Git
sitsys-deploy "Description of changes"
```

**For Backend Changes (server.js):**
```bash
# 1. Make changes locally
# 2. Upload via WinSCP to /home/linuxuser/server.js
# 3. SSH into server

# 4. Create backup first
sudo cp /var/www/sitsys/ticketing/server.js /var/www/sitsys/ticketing/server.js.backup-$(date +%Y%m%d-%H%M%S)

# 5. Copy to production
sudo cp /home/linuxuser/server.js /var/www/sitsys/ticketing/server.js

# 6. Test syntax
cd /var/www/sitsys/ticketing && node server.js
# If no errors, press Ctrl+C

# 7. Restart service
sudo systemctl restart msp-ticketing

# 8. Verify service started
sudo systemctl status msp-ticketing

# 9. Test in browser

# 10. Commit to Git
cd /var/www/sitsys
git add ticketing/server.js
git commit -m "Description of changes"
git push origin main
```

### Rollback Procedure
```bash
# If something breaks after deployment:

# For frontend (no restart needed)
sudo cp /var/www/sitsys/ticketing/public/index.html.backup /var/www/sitsys/ticketing/public/index.html

# For backend (requires restart)
sudo cp /var/www/sitsys/ticketing/server.js.backup-YYYYMMDD-HHMMSS /var/www/sitsys/ticketing/server.js
sudo systemctl restart msp-ticketing

# Or rollback via Git
cd /var/www/sitsys
git log --oneline -10  # Find commit hash
git reset --hard <commit-hash>
sudo systemctl restart msp-ticketing  # If server.js changed
```

### Pre-Deployment Checklist
- [ ] Backup created before changes
- [ ] Changes tested locally (if possible)
- [ ] Service restart planned (if backend change)
- [ ] Rollback plan ready
- [ ] Off-hours deployment (if major change)

### Post-Deployment Verification
- [ ] Service status: `sudo systemctl status msp-ticketing`
- [ ] No errors in logs: `sudo journalctl -u msp-ticketing -n 20`
- [ ] Web UI loads and functions
- [ ] Test login
- [ ] Test key functionality (create ticket, add note, etc.)
- [ ] Changes committed to Git

---

## 8. Email-to-Ticket Integration

### Overview
Automated email-to-ticket system converts emails sent to `help@soliditsecured.com` into support tickets while providing instant mobile notifications through Microsoft 365.

**Email Flow:**
1. Customer sends email to `help@soliditsecured.com`
2. Microsoft 365 receives email → visible in shared mailbox on mobile
3. Mail Flow Rule forwards copy to `tickets@inbound.soliditsecure.com`
4. DNS routes to SendGrid via MX record
5. SendGrid POSTs email data to webhook
6. Webhook creates ticket with auto-generated client/contact

### Architecture Components

#### Microsoft 365 Configuration

**Domain Added to Tenant:** `soliditsecured.com`

**Shared Mailbox:**
- **Name:** Help Desk
- **Email:** `help@soliditsecured.com`
- **Purpose:** Receive support emails, visible on mobile devices
- **Access:** Added to user's mobile Outlook app

**Mail Flow Rule:**
- **Location:** Exchange Admin Center → Mail flow → Rules
- **Name:** Forward Help Emails to Ticket System
- **Condition:** The recipient is `help@soliditsecured.com`
- **Action:** Redirect the message to `tickets@inbound.soliditsecure.com`
- **Mode:** Enforce

**Admin Access:** https://admin.exchange.microsoft.com

#### SendGrid Configuration

**Inbound Parse Settings:**
- **Host:** `inbound.soliditsecure.com`
- **Destination URL:** `https://tickets.sitsys.co/api/email-to-ticket`
- **Spam Check:** Enabled
- **Purpose:** Receive forwarded emails and POST to webhook

**Access:** https://app.sendgrid.com → Settings → Inbound Parse

**⚠️ Important Domain Note:**  
Uses `soliditsecure.com` (without 'd') because `soliditsecured.com` is in the Microsoft 365 tenant. Any domain in a 365 tenant cannot route externally to SendGrid - 365 owns all routing for domains in the tenant, including subdomains.

#### Cloudflare DNS Configuration

**Domain:** `soliditsecure.com` (separate from soliditsecured.com)

**MX Record:**
- **Type:** MX
- **Name:** `inbound`
- **Content:** `mx.sendgrid.net`
- **Priority:** 10
- **Proxy Status:** DNS only (gray cloud)
- **Purpose:** Route `*.inbound.soliditsecure.com` to SendGrid

**Admin Access:** https://dash.cloudflare.com

**Verify DNS:**
```bash
dig inbound.soliditsecure.com MX +short
# Should return: 10 mx.sendgrid.net.
```

#### SITSYS Webhook Configuration

**Endpoint:** `https://tickets.sitsys.co/api/email-to-ticket`
- **Method:** POST
- **Content-Type:** `multipart/form-data`
- **Authentication:** None (public endpoint)
- **Rate Limiting:** 100 requests per 15 minutes (global Express limit)

**Required Dependencies:**
```bash
# multer package for parsing multipart form data
cd /var/www/sitsys/ticketing
npm install multer --save
```

**Code Location:** `/var/www/sitsys/ticketing/server.js`
- Lines 7-8: Import multer
- Line 11: Initialize multer
- Lines 397-457: Email webhook endpoint

**Key Code Snippet:**
```javascript
const multer = require('multer');
const upload = multer();

app.post('/api/email-to-ticket', upload.none(), (req, res) => {
  // Parses: from, subject, text, html from req.body
  // Auto-creates client from email domain
  // Auto-creates/matches contact
  // Generates ticket with category='Email', created_by='system'
});
```

### Webhook Functionality

**Data Processing Flow:**

1. **Parse Email Data:**
   - Extracts sender email and name from `from` field
   - Uses regex to parse `"Name" <email@domain.com>` format
   - Falls back to email if name not provided

2. **Client Management:**
   - Extracts domain from sender email (e.g., `@example.com`)
   - Searches for existing client by domain name (case-insensitive LIKE query)
   - If no match found, auto-creates client:
     - Company name: Capitalized domain (e.g., "Example")
     - Note: "Auto-created from email: sender@domain.com"

3. **Contact Management:**
   - Searches for existing contact by exact email match
   - If no match found, auto-creates contact:
     - Name: Extracted from email or email address
     - Email: Sender email
     - Links to matched/created client

4. **Ticket Creation:**
   - **Ticket ID Format:** `TKT-[6-digit-timestamp]-[3-char-random]`
   - **Title:** Email subject (or "(No Subject)" if blank)
   - **Description:** Email body text (prefers plain text, falls back to HTML)
   - **Client:** Auto-matched or auto-created
   - **Contact:** Auto-matched or auto-created
   - **Priority:** Medium (default)
   - **Status:** New
   - **Category:** Email
   - **Created By:** system

### Testing & Verification

**Send Test Email:**
```bash
# From any email client, send to:
help@soliditsecured.com

# Subject: Test Ticket
# Body: This is a test email-to-ticket
```

**Check Service Logs:**
```bash
# Watch for ticket creation in real-time:
sudo journalctl -u msp-ticketing -f | grep -i "email"

# View last 50 email-related entries:
sudo journalctl -u msp-ticketing -n 50 --no-pager | grep -i "email"

# Check recent activity:
sudo journalctl -u msp-ticketing --since "10 minutes ago" | grep -i "email"
```

**Expected Log Output:**
```
SendGrid data received: { from: "John Doe <john@example.com>", subject: "Test", text: "..." }
Email ticket created: TKT-123456-ABC from john@example.com
```

**Verify in SITSYS:**
1. Log in to https://tickets.sitsys.co
2. Check "All Tickets" view
3. New ticket should appear with:
   - Category: Email
   - Created By: system
   - Auto-generated client (if new domain)
   - Contact information from sender

### Troubleshooting Email-to-Ticket

#### Issue: Emails not creating tickets

**Check 1 - Service Status:**
```bash
sudo systemctl status msp-ticketing
# Must be running
```

**Check 2 - Microsoft 365 Mail Flow Rule:**
```
1. Go to https://admin.exchange.microsoft.com
2. Navigate to: Mail flow → Rules
3. Verify rule "Forward Help Emails to Ticket System" is:
   - Enabled (not disabled)
   - Condition: Recipient is help@soliditsecured.com
   - Action: Redirect to tickets@inbound.soliditsecure.com
   - Mode: Enforce (not "Test mode")
```

**Check 3 - DNS MX Record:**
```bash
# Verify MX record resolves correctly:
dig inbound.soliditsecure.com MX +short

# Expected output:
10 mx.sendgrid.net.

# If no output, check Cloudflare DNS settings
```

**Check 4 - SendGrid Activity:**
```
1. Go to https://app.sendgrid.com
2. Navigate to: Activity
3. Filter by recipient or search for help@soliditsecured.com
4. Look for "Inbound Parse" events
5. Check for any errors or delivery failures
```

**Check 5 - Webhook Logs:**
```bash
# Check for webhook activity:
sudo journalctl -u msp-ticketing --since "1 hour ago" | grep -i "sendgrid\|email"

# Look for:
# - "SendGrid data received" (webhook was called)
# - "Email ticket created" (ticket was successfully created)
# - "Email webhook error" (there was an error)
```

**Check 6 - Test Webhook Directly:**
```bash
# Test webhook with curl:
curl -X POST https://tickets.sitsys.co/api/email-to-ticket \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "from=Test User <test@example.com>" \
  -d "subject=Test Ticket" \
  -d "text=This is a test email body"

# Should return: {"success":true,"ticketId":"TKT-XXXXXX-XXX"}
```

#### Issue: Empty request body (req.body = {})

**Cause:** Missing multer middleware for multipart form data parsing

**Solution:**
```bash
# 1. Verify multer is installed:
cd /var/www/sitsys/ticketing
npm list multer

# 2. If not installed:
npm install multer --save

# 3. Verify server.js includes:
grep -n "multer" /var/www/sitsys/ticketing/server.js

# Should show lines like:
# 7:const multer = require('multer');
# 11:const upload = multer();
# 397:app.post('/api/email-to-ticket', upload.none(), (req, res) => {

# 4. Restart service:
sudo systemctl restart msp-ticketing
```

#### Issue: Webhook returns 500 error

**Check logs for specific error:**
```bash
sudo journalctl -u msp-ticketing -n 100 --no-pager | grep -A 10 "Email webhook error"
```

**Common causes:**
- Missing `from` field → Returns 400 error with "Missing from field"
- Database locked → Restart service
- Malformed email data → Check SendGrid Activity logs

#### Issue: Client or Contact not created

**Symptom:** Ticket created but no client/contact linked

**Cause:** Error during client/contact creation (database constraint violation)

**Solution:**
```bash
# Check logs for database errors:
sudo journalctl -u msp-ticketing -n 100 | grep -i "sqlite\|database"

# Verify database integrity:
sqlite3 /var/www/sitsys/ticketing/ticketing.db "PRAGMA integrity_check;"

# Check for duplicate clients:
sqlite3 /var/www/sitsys/ticketing/ticketing.db "SELECT * FROM clients WHERE company_name LIKE '%example%';"
```

#### Issue: 365 Mail Flow Rule not forwarding

**Symptom:** Email arrives in 365 mailbox but no ticket created

**Possible causes:**

1. **Rule disabled:**
   - Check Exchange Admin → Mail flow → Rules
   - Ensure rule is enabled (not grayed out)

2. **Rule in Test mode:**
   - Check rule mode is "Enforce" not "Test with Policy Tips"

3. **Destination domain in 365 tenant:**
   - If forwarding to a domain that's in the 365 tenant, it won't work
   - Must forward to external domain not managed by 365
   - This is why we use `soliditsecure.com` (not in tenant)

4. **Test rule manually:**
   - Exchange Admin → Mail flow → Message trace
   - Search for recent test email to help@soliditsecured.com
   - Check message trace details for rule application

### Maintenance Tasks

**Weekly:**
```bash
# Check email-to-ticket activity:
sudo journalctl -u msp-ticketing --since "7 days ago" | grep "Email ticket created" | wc -l
# Shows number of tickets created via email in past week
```

**Monthly:**
```bash
# Review auto-created clients:
sqlite3 /var/www/sitsys/ticketing/ticketing.db "SELECT company_name, notes FROM clients WHERE notes LIKE '%Auto-created%';"

# Clean up or merge duplicate clients if needed
```

**Monitor:**
- SendGrid activity for spam/abuse
- Mail Flow Rule effectiveness
- Webhook error rate in logs

### Security Considerations

**Rate Limiting:**
- Express rate limiter: 100 requests per 15 minutes (applies to all endpoints including webhook)
- No additional webhook-specific rate limiting

**Spam Protection:**
- SendGrid spam checking enabled (filters before POSTing to webhook)
- Only processes emails that pass SendGrid's spam checks

**Data Validation:**
- Webhook validates presence of `from` field
- Returns 400 error if missing required data
- Catches and logs all errors (returns 500 with error message)

**Access Control:**
- Webhook endpoint is public (no authentication required)
- Only accepts POST requests
- Does not expose sensitive data in responses
- Created tickets are visible to all authenticated SITSYS users

**Email Data Storage:**
- Email content stored in ticket description (plain text preferred)
- Sender email stored in contact record
- No attachment handling currently implemented

### Future Enhancements (Potential)

- [ ] Email reply functionality (send responses from tickets)
- [ ] Attachment handling (save email attachments to tickets)
- [ ] Auto-assignment based on email content/keywords
- [ ] SLA tracking for email-based tickets
- [ ] Email threading (link replies to original tickets)
- [ ] Custom rules for priority/category based on sender/subject
- [ ] Notification emails when tickets are created/updated

---

## 9. Security

### SSL/TLS Configuration
- **Provider:** Let's Encrypt (free, auto-renewing)
- **Certificate Location:** `/etc/letsencrypt/live/tickets.sitsys.co/`
- **Auto-renewal:** Handled by certbot (systemd timer)
- **Nginx SSL Config:** Strong ciphers, HSTS enabled

**Check SSL Status:**
```bash
# Check certificate expiry
sudo certbot certificates

# Test auto-renewal
sudo certbot renew --dry-run

# Force renewal (if needed)
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Session Management
- **Storage:** In-memory (server restart clears all sessions)
- **Secret:** Set in server.js (default: 'change-this-secret-key-in-production')
- **Cookie Lifetime:** 24 hours
- **Secure Flag:** No (set to yes if using HTTPS only)

**⚠️ Security Recommendation:**
```bash
# Set a strong session secret:
# Edit /var/www/sitsys/ticketing/server.js
# Find: secret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production'
# Set SESSION_SECRET environment variable with a strong random string
```

### Access Control
- **Authentication:** Required for all routes except webhook
- **Password Hashing:** bcrypt (10 rounds)
- **Role-Based Access:** Admin vs Technician roles
- **No API Keys:** Uses session-based authentication only

### Rate Limiting
- **Window:** 15 minutes
- **Max Requests:** 100 per window per IP
- **Applies To:** All routes (including API and webhook)
- **Configured In:** server.js (Express rate limiter)

### Firewall Configuration
```bash
# Check firewall status
sudo ufw status

# Should allow:
# - 22/tcp (SSH)
# - 80/tcp (HTTP)
# - 443/tcp (HTTPS)
# - 3000/tcp should NOT be exposed (internal only)
```

### Security Best Practices
- Change default admin password immediately after first login
- Keep Node.js and dependencies updated
- Review user accounts regularly
- Monitor logs for suspicious activity
- Backup database before major changes
- Use strong passwords for all accounts
- Keep SSH keys secure
- Review email webhook logs for abuse

### Security Monitoring
```bash
# Check for failed login attempts (future feature)
sudo journalctl -u msp-ticketing | grep "Invalid credentials"

# Check for unusual API activity
sudo journalctl -u msp-ticketing --since "24 hours ago" | grep "401\|403\|429"

# Monitor webhook abuse
sudo journalctl -u msp-ticketing --since "1 hour ago" | grep "Email ticket created" | wc -l
```

---

## 10. Monitoring & Maintenance

### System Health Checks

**Daily:**
- Service status: `sudo systemctl status msp-ticketing`
- Recent errors: `sudo journalctl -u msp-ticketing -n 20 | grep -i error`
- Disk space: `df -h /var/www`
- Last backup: Check Statistics page or `ls -lt /var/www/sitsys/ticketing/backups/ | head -3`

**Weekly:**
- Review logs for errors or warnings
- Check database size growth
- Verify backups are running
- Check SSL certificate expiry (if close to expiration)
- Monitor email-to-ticket activity

**Monthly:**
- Update dependencies: `npm audit` and `npm update`
- Database maintenance: `sqlite3 ticketing.db "VACUUM;"`
- Review user accounts
- Check disk space trends
- Review and clean up old backups (if needed)

**Quarterly:**
- Review and update documentation
- Test disaster recovery plan
- Security audit

---

## 11. Troubleshooting

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

### Email-to-Ticket Not Working
**See Section 8 for comprehensive email-to-ticket troubleshooting**

---

## 12. Disaster Recovery

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
# Ensure multer is installed for email-to-ticket
npm install multer --save
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
- Test email-to-ticket (send test email)

**10. Set up backups**
```bash
# Add cron job
(sudo crontab -u www-data -l 2>/dev/null; echo "0 * * * * /var/www/sitsys/ticketing/backup.sh") | sudo crontab -u www-data -
```

**11. Reconfigure Email-to-Ticket (if needed)**
- Verify SendGrid webhook still points to new server IP
- Update DNS if server IP changed
- Test email forwarding from 365

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
sudo journalctl -u msp-ticketing -n 50 | grep -i email  # Email logs
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

### Email-to-Ticket
```bash
# Test webhook
curl -X POST https://tickets.sitsys.co/api/email-to-ticket \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "from=Test <test@example.com>" -d "subject=Test" -d "text=Body"

# Check email activity
sudo journalctl -u msp-ticketing --since "1 hour ago" | grep -i email

# Verify DNS
dig inbound.soliditsecure.com MX +short
```

---

## Appendix B: Contact Information

**System Administrator:** obrand@gistlink.net  
**GitHub Repository:** https://github.com/eauxnguyen/sitsys  
**Server:** 104.207.141.167 (core01)  
**Domain:** tickets.sitsys.co  
**Support Email:** help@soliditsecured.com

**Hosting Provider:** Vultr  
**DNS Provider:** Cloudflare  
**SSL Provider:** Let's Encrypt (auto-renew via certbot)  
**Email Provider:** Microsoft 365  
**Email Routing:** SendGrid

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | March 6, 2026 | Initial comprehensive guide | obrand@gistlink.net |
| 2.6 | March 16, 2026 | Added sitsys-deploy script; updated deploy workflow, disaster recovery, troubleshooting, quick reference | obrand@gistlink.net |
| 2.7 | March 26, 2026 | Added comprehensive Email-to-Ticket Integration section (Section 8); updated System Overview, Daily Operations, Service Management, Database queries, and Quick Command Reference | obrand@gistlink.net |

---

**END OF DOCUMENT**
