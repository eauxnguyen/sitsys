# MSP Ticketing System - Deployment Guide for Debian 12

## Complete Installation Steps for Vultr VPS

### 1. Initial VPS Preparation

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl git nginx certbot python3-certbot-nginx
```

### 2. Install Node.js

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Deploy the Application

```bash
# Create application directory
mkdir -p /var/www/msp-ticketing
cd /var/www/msp-ticketing

# Upload your files (use SCP/SFTP or git)
# For now, we'll assume files are uploaded to this directory

# Install dependencies
npm install --production

# Set proper permissions
chown -R www-data:www-data /var/www/msp-ticketing
chmod -R 755 /var/www/msp-ticketing
```

### 4. Configure Systemd Service

```bash
# Copy service file
cp /var/www/msp-ticketing/msp-ticketing.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable msp-ticketing
systemctl start msp-ticketing

# Check status
systemctl status msp-ticketing
```

### 5. Configure Nginx

```bash
# Copy nginx configuration
cp /var/www/msp-ticketing/nginx-config.conf /etc/nginx/sites-available/msp-ticketing

# Create symbolic link
ln -s /etc/nginx/sites-available/msp-ticketing /etc/nginx/sites-enabled/

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

### 6. Setup SSL with Let's Encrypt

**IMPORTANT:** Before running certbot, make sure your DNS is configured:
- Create an A record pointing `tickets.sitsys.co` to your VPS IP

```bash
# Obtain SSL certificate
certbot --nginx -d tickets.sitsys.co

# Follow the prompts and select option to redirect HTTP to HTTPS

# Test auto-renewal
certbot renew --dry-run
```

### 7. Configure Firewall

```bash
# If using UFW
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable

# If using iptables (Debian default)
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables-save > /etc/iptables/rules.v4
```

## DNS Configuration

Before accessing the system, configure your DNS:

1. Log into your domain registrar (wherever sitsys.co is registered)
2. Create an A record:
   - Subdomain: `tickets`
   - Type: `A`
   - Value: `YOUR_VPS_IP`
   - TTL: `300` (or automatic)

Wait 5-15 minutes for DNS propagation.

## Access the System

Once deployed and DNS is configured:
- URL: `https://tickets.sitsys.co`
- Default username: `admin`
- Default password: `admin123`

**⚠️ CRITICAL: Change the admin password immediately after first login!**

## Post-Deployment Steps

### 1. Change Admin Password

```bash
# Access the system via browser
# Go to https://tickets.sitsys.co
# Login with admin/admin123
# Navigate to settings and change password
```

### 2. Create Additional Users (via API or future admin panel)

```bash
# Example using curl
curl -X POST https://tickets.sitsys.co/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "technician1",
    "password": "SecurePassword123!",
    "full_name": "John Doe",
    "email": "john@example.com",
    "role": "technician"
  }'
```

### 3. Backup Configuration

```bash
# Create backup script
cat > /usr/local/bin/backup-ticketing.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/msp-ticketing"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /var/www/msp-ticketing/ticketing.db $BACKUP_DIR/ticketing-$DATE.db
# Keep only last 30 days
find $BACKUP_DIR -name "ticketing-*.db" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-ticketing.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-ticketing.sh") | crontab -
```

## Monitoring & Maintenance

### Check Application Logs

```bash
# View application logs
journalctl -u msp-ticketing -f

# View nginx logs
tail -f /var/log/nginx/msp-ticketing-access.log
tail -f /var/log/nginx/msp-ticketing-error.log
```

### Restart Services

```bash
# Restart application
systemctl restart msp-ticketing

# Restart nginx
systemctl restart nginx
```

### Update Application

```bash
# Stop service
systemctl stop msp-ticketing

# Backup database
cp /var/www/msp-ticketing/ticketing.db /var/backups/ticketing.db.backup

# Update files (upload new versions)
# ... upload updated files ...

# Install any new dependencies
cd /var/www/msp-ticketing
npm install --production

# Start service
systemctl start msp-ticketing
```

## Troubleshooting

### Service won't start

```bash
# Check service status
systemctl status msp-ticketing

# Check logs
journalctl -u msp-ticketing -n 50

# Common issues:
# 1. Port 3000 already in use
# 2. Permission issues
# 3. Missing dependencies
```

### Can't access website

```bash
# Check nginx is running
systemctl status nginx

# Check firewall
ufw status
# or
iptables -L

# Check DNS
nslookup tickets.sitsys.co

# Check SSL certificate
certbot certificates
```

### Database issues

```bash
# Verify database file exists
ls -la /var/www/msp-ticketing/ticketing.db

# Check permissions
chown www-data:www-data /var/www/msp-ticketing/ticketing.db
chmod 664 /var/www/msp-ticketing/ticketing.db
```

## Security Recommendations

1. **Change default admin password immediately**
2. **Use strong passwords for all users**
3. **Keep system updated**: `apt update && apt upgrade`
4. **Monitor logs regularly**
5. **Setup automatic backups**
6. **Consider fail2ban** for brute force protection:
   ```bash
   apt install fail2ban
   systemctl enable fail2ban
   systemctl start fail2ban
   ```

## Features

- ✅ Multi-user authentication with sessions
- ✅ SQLite database (simple, no separate DB server needed)
- ✅ Full CRUD operations for tickets
- ✅ Status workflow management
- ✅ Client tracking
- ✅ Advanced filtering and search
- ✅ Real-time statistics and reports
- ✅ Responsive design
- ✅ Secure password hashing (bcrypt)
- ✅ Session management
- ✅ Rate limiting

## File Structure

```
/var/www/msp-ticketing/
├── server.js              # Backend server
├── package.json           # Dependencies
├── ticketing.db          # SQLite database (auto-created)
├── public/
│   └── index.html        # Frontend application
├── msp-ticketing.service # Systemd service file
└── nginx-config.conf     # Nginx configuration
```

## Support

For issues or questions:
1. Check systemd logs: `journalctl -u msp-ticketing -f`
2. Check nginx logs: `/var/log/nginx/msp-ticketing-error.log`
3. Verify all services are running
4. Ensure DNS is properly configured

## Upgrade Path

Future features planned:
- Email notifications for ticket updates
- File attachments
- SLA tracking
- Mobile app
- Integration with monitoring tools
- Advanced reporting and analytics
