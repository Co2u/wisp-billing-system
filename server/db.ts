import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'wisp.db');
const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role_id INTEGER,
      full_name TEXT,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS mikrotik_routers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 8728,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mikrotik_profile_name TEXT NOT NULL,
      speed_limit TEXT,
      price REAL NOT NULL,
      billing_cycle INTEGER DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      address TEXT,
      contact_number TEXT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      plan_id INTEGER,
      status TEXT DEFAULT 'ACTIVE',
      remote_address TEXT UNIQUE NOT NULL,
      local_address TEXT DEFAULT '192.168.5.1',
      router_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES plans(id),
      FOREIGN KEY (router_id) REFERENCES mikrotik_routers(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriber_id INTEGER,
      amount REAL NOT NULL,
      due_date DATETIME NOT NULL,
      status TEXT DEFAULT 'UNPAID',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscriber_id) REFERENCES subscribers(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      amount REAL NOT NULL,
      receipt_number TEXT,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Seed initial data
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
  if (roleCount.count === 0) {
    db.prepare("INSERT INTO roles (name) VALUES ('Admin'), ('Staff')").run();
    
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password, role_id, full_name) VALUES (?, ?, ?, ?)").run('admin', hash, 1, 'System Administrator');
    
    db.prepare("INSERT INTO plans (name, mikrotik_profile_name, speed_limit, price) VALUES (?, ?, ?, ?)").run('Basic 10Mbps', 'basic_10m', '10M/10M', 20.00);
    db.prepare("INSERT INTO plans (name, mikrotik_profile_name, speed_limit, price) VALUES (?, ?, ?, ?)").run('Pro 50Mbps', 'pro_50m', '50M/50M', 50.00);
  }
}

export default db;
