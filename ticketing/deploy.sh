#!/bin/bash

# MSP Ticketing System - Automated Deployment Script for Debian 12
# This script automates the deployment process

set -e  # Exit on any error

echo "======================================"
echo "MSP Ticketing System Deployment"
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Configuration
DOMAIN="tickets.sitsys.co"  # Change this to your desired subdomain
APP_DIR="/var/www/msp-ticketing"
CURRENT_DIR=$(pwd)

echo "Step 1: Updating system packages..."
apt update && apt upgrade -y

echo ""
echo "Step 2: Installing required packages..."
apt install -y curl git nginx certbot python3-certbot-nginx ufw

echo ""
echo "Step 3: Installing Node.js 20.x LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

node --version
npm --version

echo ""
echo "Step 4: Setting up application directory..."
mkdir -p $APP_DIR

# Copy files to application directory
echo "Copying application files..."
cp -r $CURRENT_DIR/* $APP_DIR/
cd $APP_DIR

echo ""
echo "Step 5: Installing Node.js dependencies..."
npm install --production

echo ""
echo "Step 6: Setting file permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

echo ""
echo "Step 7: Configuring systemd service..."
cp $APP_DIR/msp-ticketing.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable msp-ticketing
systemctl start msp-ticketing

echo ""
echo "Step 8: Configuring Nginx..."
# Update nginx config with actual domain
sed -i "s/tickets.sitsys.co/$DOMAIN/g" $APP_DIR/nginx-config.conf
cp $APP_DIR/nginx-config.conf /etc/nginx/sites-available/msp-ticketing
ln -sf /etc/nginx/sites-available/msp-ticketing /etc/nginx/sites-enabled/

# Remove SSL lines temporarily (will be added by certbot)
sed -i '/ssl_certificate/d' /etc/nginx/sites-enabled/msp-ticketing
sed -i '/listen 443/d' /etc/nginx/sites-enabled/msp-ticketing
sed -i '/ssl_protocols/d' /etc/nginx/sites-enabled/msp-ticketing
sed -i '/ssl_ciphers/d' /etc/nginx/sites-enabled/msp-ticketing
sed -i '/ssl_prefer_server_ciphers/d' /etc/nginx/sites-enabled/msp-ticketing

# Test and reload nginx
nginx -t
systemctl reload nginx

echo ""
echo "Step 9: Configuring firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8443/tcp  # UniFi controller
ufw status

echo ""
echo "Step 10: Setting up automatic backups..."
cat > /usr/local/bin/backup-ticketing.sh << 'EOFBACKUP'
#!/bin/bash
BACKUP_DIR="/var/backups/msp-ticketing"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /var/www/msp-ticketing/ticketing.db $BACKUP_DIR/ticketing-$DATE.db 2>/dev/null || true
find $BACKUP_DIR -name "ticketing-*.db" -mtime +30 -delete
EOFBACKUP

chmod +x /usr/local/bin/backup-ticketing.sh

# Add to crontab if not already there
(crontab -l 2>/dev/null | grep -q backup-ticketing) || \
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-ticketing.sh") | crontab -

echo ""
echo "======================================"
echo "Installation Complete!"
echo "======================================"
echo ""
echo "Next Steps:"
echo ""
echo "1. Configure DNS:"
echo "   - Create an A record for '$DOMAIN' pointing to this server's IP"
echo "   - Wait 5-15 minutes for DNS propagation"
echo ""
echo "2. Setup SSL (after DNS is configured):"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo "3. Access your system:"
echo "   URL: https://$DOMAIN"
echo "   Username: admin"
echo "   Password: admin123"
echo "   ⚠️  CHANGE PASSWORD IMMEDIATELY!"
echo ""
echo "4. Check service status:"
echo "   sudo systemctl status msp-ticketing"
echo "   sudo journalctl -u msp-ticketing -f"
echo ""
echo "======================================"

# Show current status
echo ""
echo "Current Service Status:"
systemctl status msp-ticketing --no-pager

echo ""
echo "Deployment script completed successfully!"
