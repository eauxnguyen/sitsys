const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const username = process.argv[2];
const password = process.argv[3];
const fullName = process.argv[4] || username;
const role = process.argv[5] || 'technician';

if (!username || !password) {
    console.log('Usage: node create-user.js <username> <password> [full-name] [role]');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const db = new Database('ticketing.db');

try {
    db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)').run(username, hash, fullName, role);
    console.log('User created: ' + username + ' (' + role + ')');
} catch (error) {
    console.error('Error:', error.message);
}

db.close();
