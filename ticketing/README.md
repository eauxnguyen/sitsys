# MSP Ticket Management System - Cloud Edition

A professional, full-featured ticket management system designed for Managed Service Providers.

## Features

- 🎫 **Complete Ticket Management** - Create, edit, update, and track tickets through their lifecycle
- 👥 **Multi-User Support** - Secure authentication and role-based access
- 📊 **Real-Time Analytics** - Dashboard with live statistics and reports
- 🔍 **Advanced Search & Filtering** - Find tickets quickly by status, priority, client, or keyword
- 💾 **Persistent Database** - SQLite database with automatic backups
- 🔒 **Secure** - Password hashing, session management, and rate limiting
- 🌐 **Cloud-Ready** - Deploy to any VPS with Nginx reverse proxy and SSL
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## Quick Start

### Development Mode

```bash
npm install
npm start
```

Access at: `http://localhost:3000`

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions for Debian 12.

## Default Credentials

- **Username:** admin
- **Password:** admin123

⚠️ **IMPORTANT:** Change this password immediately after first login!

## Technology Stack

- **Frontend:** React, Modern CSS, Responsive Design
- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Security:** bcrypt, express-session, rate limiting
- **Deployment:** Nginx, Systemd, Let's Encrypt SSL

## Project Structure

```
msp-ticketing/
├── server.js              # Express backend server
├── package.json           # Node.js dependencies
├── public/
│   └── index.html        # React frontend application
├── msp-ticketing.service # Systemd service configuration
├── nginx-config.conf     # Nginx reverse proxy config
└── DEPLOYMENT.md         # Detailed deployment guide
```

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/auth/check` - Check authentication status

### Tickets
- `GET /api/tickets` - List all tickets
- `GET /api/tickets/:id` - Get ticket details
- `POST /api/tickets` - Create new ticket
- `PUT /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket

### Statistics
- `GET /api/stats` - Get system statistics and reports

### Users
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create user (admin only)

## Ticket Workflow

1. **New** - Ticket just created
2. **Open** - Acknowledged and assigned
3. **In Progress** - Actively being worked on
4. **Waiting** - Waiting on customer or third party
5. **Resolved** - Issue fixed, awaiting closure
6. **Closed** - Ticket completed

## Priority Levels

- **Low** - Non-urgent issues
- **Medium** - Standard priority
- **High** - Important issues requiring attention
- **Critical** - Emergency issues requiring immediate attention

## Security Features

- Password hashing with bcrypt (10 rounds)
- Secure session management
- Rate limiting (100 requests per 15 minutes)
- HTTPS support with Let's Encrypt
- SQL injection prevention
- XSS protection headers

## Backup & Recovery

Automatic daily backups configured via cron job (see DEPLOYMENT.md).

Database location: `/var/www/msp-ticketing/ticketing.db`

## Monitoring

```bash
# Check application status
systemctl status msp-ticketing

# View logs
journalctl -u msp-ticketing -f

# Check nginx logs
tail -f /var/log/nginx/msp-ticketing-access.log
```

## License

MIT License - Use freely for your MSP business

## Support

For deployment issues, see DEPLOYMENT.md troubleshooting section.
