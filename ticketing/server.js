const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = new Database('ticketing.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'technician',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT UNIQUE NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT,
    website TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS client_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    title TEXT,
    is_primary INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    client_id INTEGER NOT NULL,
    contact_id INTEGER,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    category TEXT NOT NULL,
    assigned_to TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (contact_id) REFERENCES client_contacts(id)
  );

  CREATE TABLE IF NOT EXISTS ticket_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    is_client_facing INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    hours REAL NOT NULL,
    description TEXT,
    entry_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migrate existing tickets if needed
try {
  db.exec(`
    -- Add client_id and contact_id columns if they don't exist
    ALTER TABLE tickets ADD COLUMN client_id_new INTEGER;
    ALTER TABLE tickets ADD COLUMN contact_id_new INTEGER;
  `);
} catch (e) {
  // Columns already exist or other error, ignore
}

// Create default admin user if not exists
const checkAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!checkAdmin) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, 'Administrator', 'admin');
  console.log('Default admin user created: admin/admin123 - PLEASE CHANGE THIS PASSWORD!');
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ============ AUTH ROUTES ============

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  
  res.json({ 
    success: true, 
    user: { 
      id: user.id, 
      username: user.username, 
      full_name: user.full_name,
      role: user.role 
    } 
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  if (req.session.userId) {
    const user = db.prepare('SELECT id, username, full_name, email, role FROM users WHERE id = ?').get(req.session.userId);
    res.json({ authenticated: true, user });
  } else {
    res.json({ authenticated: false });
  }
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.session.userId);
  
  res.json({ success: true });
});

// ============ CLIENT ROUTES ============

app.get('/api/clients', requireAuth, (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY company_name').all();
  res.json(clients);
});

app.get('/api/clients/:id', requireAuth, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }
  
  const contacts = db.prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, name').all(req.params.id);
  const tickets = db.prepare('SELECT * FROM tickets WHERE client_id = ? ORDER BY created_at DESC').all(req.params.id);
  
  res.json({ ...client, contacts, tickets });
});

app.post('/api/clients', requireAuth, (req, res) => {
  const { company_name, address, city, state, zip, phone, website, notes } = req.body;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO clients (company_name, address, city, state, zip, phone, website, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(company_name, address, city, state, zip, phone, website, notes);
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ error: 'Client name already exists' });
  }
});

app.put('/api/clients/:id', requireAuth, (req, res) => {
  const { company_name, address, city, state, zip, phone, website, notes } = req.body;
  
  const stmt = db.prepare(`
    UPDATE clients 
    SET company_name = ?, address = ?, city = ?, state = ?, zip = ?, phone = ?, website = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  stmt.run(company_name, address, city, state, zip, phone, website, notes, req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(client);
});

app.delete('/api/clients/:id', requireAuth, (req, res) => {
  // Check if client has tickets
  const ticketCount = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE client_id = ?').get(req.params.id);
  if (ticketCount.count > 0) {
    return res.status(400).json({ error: 'Cannot delete client with existing tickets' });
  }
  
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ CLIENT CONTACT ROUTES ============

app.get('/api/clients/:clientId/contacts', requireAuth, (req, res) => {
  const contacts = db.prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, name').all(req.params.clientId);
  res.json(contacts);
});

app.post('/api/clients/:clientId/contacts', requireAuth, (req, res) => {
  const { name, email, phone, mobile, title, is_primary, notes } = req.body;
  
  // If setting as primary, unset other primary contacts
  if (is_primary) {
    db.prepare('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?').run(req.params.clientId);
  }
  
  const stmt = db.prepare(`
    INSERT INTO client_contacts (client_id, name, email, phone, mobile, title, is_primary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(req.params.clientId, name, email, phone, mobile, title, is_primary ? 1 : 0, notes);
  const contact = db.prepare('SELECT * FROM client_contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(contact);
});

app.put('/api/clients/:clientId/contacts/:id', requireAuth, (req, res) => {
  const { name, email, phone, mobile, title, is_primary, notes } = req.body;
  
  // If setting as primary, unset other primary contacts
  if (is_primary) {
    db.prepare('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?').run(req.params.clientId, req.params.id);
  }
  
  const stmt = db.prepare(`
    UPDATE client_contacts 
    SET name = ?, email = ?, phone = ?, mobile = ?, title = ?, is_primary = ?, notes = ?
    WHERE id = ? AND client_id = ?
  `);
  
  stmt.run(name, email, phone, mobile, title, is_primary ? 1 : 0, notes, req.params.id, req.params.clientId);
  const contact = db.prepare('SELECT * FROM client_contacts WHERE id = ?').get(req.params.id);
  res.json(contact);
});

app.delete('/api/clients/:clientId/contacts/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM client_contacts WHERE id = ? AND client_id = ?').run(req.params.id, req.params.clientId);
  res.json({ success: true });
});

// ============ TICKET ROUTES ============

app.get('/api/tickets', requireAuth, (req, res) => {
  const tickets = db.prepare(`
    SELECT t.*, c.company_name as client_name, cc.name as contact_name
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN client_contacts cc ON t.contact_id = cc.id
    ORDER BY t.created_at DESC
  `).all();
  res.json(tickets);
});

app.get('/api/tickets/:id', requireAuth, (req, res) => {
  const ticket = db.prepare(`
    SELECT t.*, c.company_name as client_name, cc.name as contact_name, cc.email as contact_email, cc.phone as contact_phone
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN client_contacts cc ON t.contact_id = cc.id
    WHERE t.id = ?
  `).get(req.params.id);
  
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  const notes = db.prepare(`
    SELECT n.*, u.username, u.full_name 
    FROM ticket_notes n 
    JOIN users u ON n.user_id = u.id 
    WHERE n.ticket_id = ? 
    ORDER BY n.created_at DESC
  `).all(req.params.id);
  
  const timeEntries = db.prepare(`
    SELECT t.*, u.username, u.full_name 
    FROM time_entries t 
    JOIN users u ON t.user_id = u.id 
    WHERE t.ticket_id = ? 
    ORDER BY t.entry_date DESC
  `).all(req.params.id);
  
  res.json({ ...ticket, notes, timeEntries });
});

app.post('/api/tickets', requireAuth, (req, res) => {
  const { title, description, client_id, contact_id, priority, status, category, assigned_to } = req.body;
  
  // Generate ticket ID
  const prefix = 'TKT';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  const ticketId = `${prefix}-${timestamp}-${random}`;
  
  const stmt = db.prepare(`
    INSERT INTO tickets (id, title, description, client_id, contact_id, priority, status, category, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(ticketId, title, description, client_id, contact_id || null, priority, status, category, assigned_to, req.session.username);
  
  const ticket = db.prepare(`
    SELECT t.*, c.company_name as client_name, cc.name as contact_name
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN client_contacts cc ON t.contact_id = cc.id
    WHERE t.id = ?
  `).get(ticketId);
  
  res.status(201).json(ticket);
});

app.put('/api/tickets/:id', requireAuth, (req, res) => {
  const { title, description, client_id, contact_id, priority, status, category, assigned_to } = req.body;
  
  const stmt = db.prepare(`
    UPDATE tickets 
    SET title = ?, description = ?, client_id = ?, contact_id = ?, priority = ?, status = ?, category = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  stmt.run(title, description, client_id, contact_id || null, priority, status, category, assigned_to, req.params.id);
  
  const ticket = db.prepare(`
    SELECT t.*, c.company_name as client_name, cc.name as contact_name
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN client_contacts cc ON t.contact_id = cc.id
    WHERE t.id = ?
  `).get(req.params.id);
  
  res.json(ticket);
});

app.delete('/api/tickets/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ TICKET NOTES ROUTES ============

app.post('/api/tickets/:id/notes', requireAuth, (req, res) => {




  const { note, is_client_facing } = req.body;

  

  const stmt = db.prepare('INSERT INTO ticket_notes (ticket_id, user_id, note, is_client_facing) VALUES (?, ?, ?, ?)');

  const result = stmt.run(req.params.id, req.session.userId, note, is_client_facing ? 1 : 0);

  

  const newNote = db.prepare(`

    SELECT n.*, u.username, u.full_name 

    FROM ticket_notes n 

    JOIN users u ON n.user_id = u.id 

    WHERE n.id = ?

  `).get(result.lastInsertRowid);

  

  res.status(201).json(newNote);
});

app.delete("/api/tickets/:ticketId/notes/:noteId", requireAuth, (req, res) => {
  db.prepare("DELETE FROM ticket_notes WHERE id = ? AND ticket_id = ?").run(req.params.noteId, req.params.ticketId);
  res.json({ success: true });
});


// ============ TIME ENTRY ROUTES ============

app.post('/api/tickets/:id/time', requireAuth, (req, res) => {
  const { hours, description, entry_date } = req.body;
  
  const stmt = db.prepare('INSERT INTO time_entries (ticket_id, user_id, hours, description, entry_date) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(req.params.id, req.session.userId, hours, description, entry_date);
  
  const newEntry = db.prepare(`
    SELECT t.*, u.username, u.full_name 
    FROM time_entries t 
    JOIN users u ON t.user_id = u.id 
    WHERE t.id = ?
  `).get(result.lastInsertRowid);
  
  res.status(201).json(newEntry);
});

// ============ USER ROUTES ============

app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, email, role FROM users ORDER BY username').all();
  res.json(users);
});

app.post('/api/users', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { username, password, full_name, email, role } = req.body;
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  try {
    const stmt = db.prepare('INSERT INTO users (username, password, full_name, email, role) VALUES (?, ?, ?, ?, ?)');
    stmt.run(username, hashedPassword, full_name, email, role || 'technician');
    
    const user = db.prepare('SELECT id, username, full_name, email, role FROM users WHERE username = ?').get(username);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

// ============ STATISTICS ROUTES ============

app.get('/api/stats', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM tickets').get().count;
  const open = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status IN ('New', 'Open', 'In Progress')").get().count;
  const resolved = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'Resolved'").get().count;
  const critical = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE priority = 'Critical' AND status NOT IN ('Resolved', 'Closed')").get().count;
  
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM tickets GROUP BY status').all();
  const byPriority = db.prepare('SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority').all();
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM tickets GROUP BY category').all();
  const topClients = db.prepare(`
    SELECT c.company_name as client, COUNT(*) as count 
    FROM tickets t
    JOIN clients c ON t.client_id = c.id
    GROUP BY c.company_name 
    ORDER BY count DESC 
    LIMIT 10
  `).all();
  
  res.json({
    summary: { total, open, resolved, critical },
    byStatus,
    byPriority,
    byCategory,
    topClients
  });
});
  const fs = require('fs');
app.get("/api/backup/status", requireAuth, (req, res) => {
  const path = require('path');
  const backupDir = path.join(__dirname, 'backups');
  
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db.gz'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stats.size, date: stats.mtime };
      })
      .sort((a, b) => b.date - a.date);
    
    const latest = files[0] || null;
    res.json({ latest, count: files.length });
  } catch (err) {
    res.json({ latest: null, count: 0 });
  }
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`MSP Ticketing System running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
