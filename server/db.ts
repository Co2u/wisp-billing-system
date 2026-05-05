import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'wisp.db');
let db = openDatabase(dbPath);

function openDatabase(targetPath: string) {
  return new Database(targetPath);
}

function resetCorruptDatabase(error: unknown) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.corrupt-${timestamp}`;
  console.warn(`Database corruption detected. Backing up to ${backupPath}.`, error);

  try {
    db.close();
  } catch {
    // Ignore close failures on a corrupt handle.
  }

  if (fs.existsSync(dbPath)) {
    fs.renameSync(dbPath, backupPath);
  }

  db = openDatabase(dbPath);
}

export function initDb() {
  try {
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
        billing_cycle INTEGER DEFAULT 30,
        router_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
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
        billing_date DATETIME,
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
  } catch (error: any) {
    if (error?.code !== 'SQLITE_CORRUPT') {
      throw error;
    }

    resetCorruptDatabase(error);
    return initDb();
  }

  const subscriberColumns = db.prepare('PRAGMA table_info(subscribers)').all() as any[];
  if (!subscriberColumns.some((col) => col.name === 'billing_date')) {
    db.prepare('ALTER TABLE subscribers ADD COLUMN billing_date DATETIME').run();
  }

  const planColumns = db.prepare('PRAGMA table_info(plans)').all() as any[];
  if (!planColumns.some((col) => col.name === 'router_id')) {
    db.prepare('ALTER TABLE plans ADD COLUMN router_id INTEGER').run();
  }

  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
  if (roleCount.count === 0) {
    db.prepare("INSERT INTO roles (name) VALUES ('Admin'), ('Staff')").run();

    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password, role_id, full_name) VALUES (?, ?, ?, ?)")
      .run('admin', hash, 1, 'System Administrator');

    db.prepare("INSERT INTO plans (name, mikrotik_profile_name, speed_limit, price) VALUES (?, ?, ?, ?)")
      .run('Basic 10Mbps', 'basic_10m', '10M/10M', 20.0);
    db.prepare("INSERT INTO plans (name, mikrotik_profile_name, speed_limit, price) VALUES (?, ?, ?, ?)")
      .run('Pro 50Mbps', 'pro_50m', '50M/50M', 50.0);
  }

  const subscribersWithoutBillingDate = db.prepare('SELECT id FROM subscribers WHERE billing_date IS NULL').all() as any[];
  if (subscribersWithoutBillingDate.length > 0) {
    const now = new Date().toISOString();
    for (const sub of subscribersWithoutBillingDate) {
      db.prepare('UPDATE subscribers SET billing_date = ? WHERE id = ?').run(now, sub.id);
    }
    console.log(`Set default billing dates for ${subscribersWithoutBillingDate.length} subscribers`);
  }
}

export { db as default };
