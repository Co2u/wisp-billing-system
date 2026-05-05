import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { initDb } from './server/db';
import { initWorker } from './server/worker';
import { addSubscriberToMikrotik, suspendSubscriber, restoreSubscriber, getRouterStatus, syncRouterData, removeSubscriberFromMikrotik } from './server/mikrotik';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-wisp';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize DB and Worker
  initDb();
  initWorker();

  // Middleware for Auth
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const getSettingValue = (key: string, defaultValue: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row?.value ?? defaultValue;
  };

  const getGracePeriodDays = () => {
    const value = getSettingValue('grace_period', '7');
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 7 : parsed;
  };

  // --- API ENDPOINTS ---

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, role_id: user.role_id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name } });
  });

  app.get('/api/admin/settings', authenticate, (req, res) => {
    const user = db.prepare('SELECT id, username, full_name FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      username: user.username,
      full_name: user.full_name,
      grace_period: getGracePeriodDays()
    });
  });

  app.put('/api/admin/settings', authenticate, async (req, res) => {
    const { username, full_name, password, grace_period } = req.body;
    try {
      if (!username || !full_name) {
        return res.status(400).json({ error: 'Username and full name are required.' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: 'User not found' });

      const hashedPassword = password ? bcrypt.hashSync(password, 10) : user.password;

      const graceDays = parseInt(grace_period, 10);
      if (Number.isNaN(graceDays) || graceDays < 0) {
        return res.status(400).json({ error: 'Grace period must be a non-negative number.' });
      }

      db.prepare('UPDATE users SET username = ?, full_name = ?, password = ? WHERE id = ?')
        .run(username, full_name, hashedPassword, req.user.id);

      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('grace_period', graceDays.toString());

      db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        req.user.id,
        'Admin Settings Updated',
        `Updated admin settings and grace period to ${graceDays} days.`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update settings' });
    }
  });

  // Dashboard Stats
  app.get('/api/dashboard', authenticate, async (req, res) => {
    const totalSubscribers = (db.prepare('SELECT COUNT(*) as count FROM subscribers').get() as any).count;
    const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'ACTIVE'").get() as any).count;
    const suspendedUsers = (db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'SUSPENDED'").get() as any).count;
    const overdueAccounts = (db.prepare("SELECT COUNT(DISTINCT subscriber_id) as count FROM invoices WHERE status = 'UNPAID' AND due_date < datetime('now')").get() as any).count;
    
    // Monthly revenue (sum of payments this month)
    const monthlyRevenue = (db.prepare(`
      SELECT SUM(amount) as total 
      FROM payments 
      WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')
    `).get() as any).total || 0;

    // Get router health
    let routerLatency = 0;
    let routerCount = 0;
    const routers = db.prepare('SELECT id FROM mikrotik_routers WHERE is_active = 1').all() as any[];
    
    for (const r of routers) {
      try {
        const status = await getRouterStatus(r.id);
        if (status.connected && status.latency) {
          routerLatency += status.latency;
          routerCount++;
        }
      } catch (e) {
        // ignore
      }
    }
    
    const avgLatency = routerCount > 0 ? Math.round(routerLatency / routerCount) : 0;
    
    // Generate some mock network load data for the chart (in a real app this would come from SNMP/MikroTik API)
    const mockLoadHistory = Array.from({ length: 15 }, () => Math.floor(Math.random() * 80) + 20);
    const currentLoad = mockLoadHistory[mockLoadHistory.length - 1];

    res.json({ 
      totalSubscribers, 
      activeUsers, 
      suspendedUsers, 
      monthlyRevenue, 
      overdueAccounts,
      systemHealth: {
        dbSync: 100,
        workerEngine: 100,
        routerLatency: avgLatency,
        networkLoad: `${currentLoad * 10} Mbps`,
        loadHistory: mockLoadHistory
      }
    });
  });

  // Subscribers CRUD
  app.get('/api/subscribers', authenticate, (req, res) => {
    const subscribers = db.prepare(`
      SELECT s.*, p.name as plan_name, r.name as router_name
      FROM subscribers s
      LEFT JOIN plans p ON s.plan_id = p.id
      LEFT JOIN mikrotik_routers r ON s.router_id = r.id
    `).all();
    res.json(subscribers);
  });

  app.post('/api/subscribers', authenticate, async (req, res) => {
    const sub = req.body;
    try {
      if (!sub.full_name || !sub.username || !sub.password || !sub.plan_id || !sub.remote_address || !sub.router_id) {
        return res.status(400).json({ error: 'Full name, username, password, plan, remote address, and router are required.' });
      }

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(sub.plan_id) as any;
      if (!plan) {
        return res.status(400).json({ error: 'Selected plan does not exist.' });
      }

      const router = db.prepare('SELECT id FROM mikrotik_routers WHERE id = ?').get(sub.router_id);
      if (!router) {
        return res.status(400).json({ error: 'Selected router does not exist.' });
      }

      if (plan.router_id !== null && plan.router_id !== sub.router_id) {
        return res.status(400).json({ error: 'Selected plan is not available for the selected router.' });
      }

      const local_address = sub.local_address || '192.168.5.1';
      const billing_date = sub.billing_date || null;
      
      await addSubscriberToMikrotik({ ...sub, local_address });

      const result = db.prepare(`
        INSERT INTO subscribers (full_name, address, contact_number, username, password, plan_id, remote_address, local_address, router_id, billing_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sub.full_name, sub.address, sub.contact_number, sub.username, sub.password, sub.plan_id, sub.remote_address, local_address, sub.router_id, billing_date);
      
      const newSub = { id: result.lastInsertRowid, ...sub, local_address };
      
      db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        req.user.id,
        'Subscriber Created',
        `Created subscriber ${sub.username} and provisioned on router.`
      );

      res.json(newSub);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create subscriber' });
    }
  });

  app.put('/api/subscribers/:id', authenticate, async (req, res) => {
    const { full_name, address, contact_number, username, password, plan_id, remote_address, router_id, billing_date } = req.body;
    try {
      const subscriber = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(req.params.id) as any;
      if (!subscriber) return res.status(404).json({ error: 'Subscriber not found' });

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(plan_id) as any;
      if (!plan) {
        return res.status(400).json({ error: 'Selected plan does not exist.' });
      }

      if (plan.router_id !== null && plan.router_id !== router_id) {
        return res.status(400).json({ error: 'Selected plan is not available for the selected router.' });
      }

      const finalPassword = password || subscriber.password;
      const finalBillingDate = billing_date || null;

      const { updateSubscriberOnMikrotik } = await import('./server/mikrotik.js');
      const newSubscriber = {
        username,
        password: finalPassword,
        plan_id,
        remote_address,
        router_id,
        local_address: subscriber.local_address || '192.168.5.1'
      };
      
      await updateSubscriberOnMikrotik(subscriber, newSubscriber);

      db.prepare(`
        UPDATE subscribers
        SET full_name = ?, address = ?, contact_number = ?, username = ?, password = ?, plan_id = ?, remote_address = ?, router_id = ?, billing_date = ?
        WHERE id = ?
      `).run(full_name, address, contact_number, username, finalPassword, plan_id, remote_address, router_id, finalBillingDate, req.params.id);

      db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        req.user.id,
        'Subscriber Updated',
        `Updated subscriber ${username} details on router and database.`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update subscriber' });
    }
  });

  app.delete('/api/subscribers/:id', authenticate, async (req, res) => {
    try {
      const sub = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(req.params.id) as any;
      if (!sub) return res.status(404).json({ error: 'Subscriber not found' });

      await removeSubscriberFromMikrotik(sub);
      
      // Delete associated invoices/payments first due to foreign keys
      const invoices = db.prepare('SELECT id FROM invoices WHERE subscriber_id = ?').all(req.params.id) as any[];
      for (const inv of invoices) {
        db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(inv.id);
      }
      db.prepare('DELETE FROM invoices WHERE subscriber_id = ?').run(req.params.id);
      db.prepare('DELETE FROM subscribers WHERE id = ?').run(req.params.id);

      db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        req.user.id,
        'Subscriber Deleted',
        `Deleted subscriber ${sub.username} and removed from router.`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Enforcement APIs
  app.post('/api/enforcement/suspend', authenticate, async (req, res) => {
    const { subscriber_id } = req.body;
    await suspendSubscriber(subscriber_id);
    
    const sub = db.prepare('SELECT username FROM subscribers WHERE id = ?').get(subscriber_id) as any;
    db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
      req.user.id,
      'Subscriber Suspended',
      `Suspended subscriber ${sub?.username || subscriber_id} (Added to EXPIRED address-list).`
    );
    
    res.json({ success: true, message: 'Subscriber suspended' });
  });

  app.post('/api/enforcement/restore', authenticate, async (req, res) => {
    const { subscriber_id } = req.body;
    await restoreSubscriber(subscriber_id);
    
    const sub = db.prepare('SELECT username FROM subscribers WHERE id = ?').get(subscriber_id) as any;
    db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
      req.user.id,
      'Subscriber Restored',
      `Restored subscriber ${sub?.username || subscriber_id} (Removed from EXPIRED address-list).`
    );
    
    res.json({ success: true, message: 'Subscriber restored' });
  });

  // Invoices & Payments
  app.get('/api/invoices', authenticate, (req, res) => {
    const invoices = db.prepare(`
      SELECT i.*, s.full_name as subscriber_name 
      FROM invoices i 
      JOIN subscribers s ON i.subscriber_id = s.id
    `).all();
    res.json(invoices);
  });

  app.post('/api/invoices/generate', authenticate, (req, res) => {
    try {
      // Generate invoices for subscribers whose billing date has passed
      // and don't have unpaid invoices (same logic as automatic generation)
      const subscribersToBill = db.prepare(`
        SELECT s.id, s.full_name, s.billing_date, p.price, p.billing_cycle
        FROM subscribers s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.billing_date IS NOT NULL
          AND s.status IN ('ACTIVE', 'SUSPENDED')
          AND datetime(s.billing_date, '+' || p.billing_cycle || ' days') <= datetime('now')
          AND NOT EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.subscriber_id = s.id AND i.status = 'UNPAID'
          )
      `).all() as any[];

      let generatedCount = 0;

      for (const sub of subscribersToBill) {
        const gracePeriod = getGracePeriodDays();
      const billingDate = new Date(sub.billing_date);
      const dueDate = new Date(billingDate);
      dueDate.setDate(dueDate.getDate() + sub.billing_cycle + gracePeriod); // billing_cycle + grace period
      const dueDateStr = dueDate.toISOString();

        // Generate invoice
        db.prepare(`
          INSERT INTO invoices (subscriber_id, amount, due_date)
          VALUES (?, ?, ?)
        `).run(sub.id, sub.price, dueDateStr);
        generatedCount++;
      }

      db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        req.user.id,
        'Manual Invoice Generation',
        `Manually generated ${generatedCount} recurring invoices.`
      );

      res.json({ success: true, count: generatedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments', authenticate, async (req, res) => {
    const { invoice_id, amount, receipt_number } = req.body;
    try {
      db.prepare(`INSERT INTO payments (invoice_id, amount, receipt_number) VALUES (?, ?, ?)`).run(invoice_id, amount, receipt_number);
      db.prepare(`UPDATE invoices SET status = 'PAID' WHERE id = ?`).run(invoice_id);

      // When invoice is PAID: Update subscriber -> ACTIVE, Remove from EXPIRED
      const invoice = db.prepare('SELECT subscriber_id FROM invoices WHERE id = ?').get(invoice_id) as any;
      if (invoice) {
        await restoreSubscriber(invoice.subscriber_id);

        // Advance billing_date to next cycle
        const subscriber = db.prepare(`
          SELECT s.billing_date, p.billing_cycle
          FROM subscribers s
          JOIN plans p ON s.plan_id = p.id
          WHERE s.id = ?
        `).get(invoice.subscriber_id) as any;

        if (subscriber && subscriber.billing_date) {
          const currentBillingDate = new Date(subscriber.billing_date);
          const nextBillingDate = new Date(currentBillingDate);
          nextBillingDate.setDate(nextBillingDate.getDate() + subscriber.billing_cycle);

          db.prepare('UPDATE subscribers SET billing_date = ? WHERE id = ?')
            .run(nextBillingDate.toISOString(), invoice.subscriber_id);

          console.log(`Advanced billing date for subscriber ${invoice.subscriber_id} to ${nextBillingDate.toISOString()}`);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Plans
  app.get('/api/plans', authenticate, (req, res) => {
    const plans = db.prepare(`
      SELECT p.*, r.name as router_name
      FROM plans p
      LEFT JOIN mikrotik_routers r ON p.router_id = r.id
    `).all();
    res.json(plans);
  });

  app.post('/api/plans', authenticate, async (req, res) => {
    const { name, mikrotik_profile_name, speed_limit, price, billing_cycle, router_id } = req.body;
    try {
      const { addPlanToMikrotik } = await import('./server/mikrotik.js');
      const targetRouterId = router_id ? parseInt(router_id, 10) : null;

      if (targetRouterId) {
        await addPlanToMikrotik({ name, mikrotik_profile_name, speed_limit }, targetRouterId);
      } else {
        const routers = db.prepare('SELECT id FROM mikrotik_routers WHERE is_active = 1').all() as any[];
        for (const r of routers) {
          await addPlanToMikrotik({ name, mikrotik_profile_name, speed_limit }, r.id);
        }
      }
      
      const result = db.prepare(`INSERT INTO plans (name, mikrotik_profile_name, speed_limit, price, billing_cycle, router_id) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(name, mikrotik_profile_name, speed_limit, price, billing_cycle || 30, targetRouterId);
      res.json({ id: result.lastInsertRowid, name, mikrotik_profile_name, speed_limit, price, billing_cycle, router_id: targetRouterId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/plans/:id', authenticate, async (req, res) => {
    const { name, mikrotik_profile_name, speed_limit, price, billing_cycle, router_id } = req.body;
    try {
      const currentPlan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any;
      if (!currentPlan) return res.status(404).json({ error: 'Plan not found' });

      const newRouterId = router_id ? parseInt(router_id, 10) : null;
      const { updatePlanToMikrotik, addPlanToMikrotik, removePlanFromMikrotik } = await import('./server/mikrotik.js');

      if (currentPlan.router_id !== newRouterId) {
        if (currentPlan.router_id === null) {
          const routers = db.prepare('SELECT id FROM mikrotik_routers WHERE is_active = 1').all() as any[];
          for (const r of routers) {
            await removePlanFromMikrotik(currentPlan.mikrotik_profile_name, r.id);
          }
        } else {
          await removePlanFromMikrotik(currentPlan.mikrotik_profile_name, currentPlan.router_id);
        }

        if (newRouterId === null) {
          const routers = db.prepare('SELECT id FROM mikrotik_routers WHERE is_active = 1').all() as any[];
          for (const r of routers) {
            await addPlanToMikrotik({ name, mikrotik_profile_name, speed_limit }, r.id);
          }
        } else {
          await addPlanToMikrotik({ name, mikrotik_profile_name, speed_limit }, newRouterId);
        }
      } else {
        if (newRouterId === null) {
          const routers = db.prepare('SELECT id FROM mikrotik_routers WHERE is_active = 1').all() as any[];
          for (const r of routers) {
            await updatePlanToMikrotik({ 
              name, 
              mikrotik_profile_name, 
              speed_limit,
              old_mikrotik_profile_name: currentPlan.mikrotik_profile_name
            }, r.id);
          }
        } else {
          await updatePlanToMikrotik({ 
            name,
            mikrotik_profile_name,
            speed_limit,
            old_mikrotik_profile_name: currentPlan.mikrotik_profile_name
          }, newRouterId);
        }
      }

      db.prepare(`UPDATE plans SET name = ?, mikrotik_profile_name = ?, speed_limit = ?, price = ?, billing_cycle = ?, router_id = ? WHERE id = ?`)
        .run(name, mikrotik_profile_name, speed_limit, price, billing_cycle, newRouterId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/plans/:id', authenticate, async (req, res) => {
    try {
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any;
      if (!plan) return res.status(404).json({ error: 'Plan not found' });

      const { removePlanFromMikrotik } = await import('./server/mikrotik.js');
      if (plan.router_id === null) {
        const routers = db.prepare('SELECT id FROM mikrotik_routers WHERE is_active = 1').all() as any[];
        for (const r of routers) {
          await removePlanFromMikrotik(plan.mikrotik_profile_name, r.id);
        }
      } else {
        await removePlanFromMikrotik(plan.mikrotik_profile_name, plan.router_id);
      }

      db.prepare(`DELETE FROM plans WHERE id = ?`).run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return res.status(400).json({ error: 'Cannot delete plan because there are active subscribers using it.' });
      }
      res.status(400).json({ error: error.message });
    }
  });

  // Routers
  app.get('/api/routers', authenticate, (req, res) => {
    const routers = db.prepare('SELECT id, name, host, port, username, is_active FROM mikrotik_routers').all();
    res.json(routers);
  });

  app.post('/api/routers', authenticate, (req, res) => {
    const { name, host, port, username, password } = req.body;
    try {
      const result = db.prepare(`INSERT INTO mikrotik_routers (name, host, port, username, password, is_active) VALUES (?, ?, ?, ?, ?, 1)`).run(name, host, port || 8728, username, password || '');
      res.json({ id: result.lastInsertRowid, name, host, port: port || 8728, username, is_active: 1 });
    } catch (error: any) {
      console.error('Failed to add router', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/routers/:id/toggle', authenticate, (req, res) => {
    const { is_active } = req.body;
    try {
      db.prepare(`UPDATE mikrotik_routers SET is_active = ? WHERE id = ?`).run(is_active ? 1 : 0, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/routers/:id', authenticate, (req, res) => {
    const { name, host, port, username, password } = req.body;
    try {
      if (!name || !host || !username) {
        return res.status(400).json({ error: 'Name, host, and username are required.' });
      }

      const router = db.prepare('SELECT * FROM mikrotik_routers WHERE id = ?').get(req.params.id) as any;
      if (!router) return res.status(404).json({ error: 'Router not found' });

      const hashedPassword = password ? bcrypt.hashSync(password, 10) : router.password;

      db.prepare(`
        UPDATE mikrotik_routers
        SET name = ?, host = ?, port = ?, username = ?, password = ?
        WHERE id = ?
      `).run(name, host, port || 8728, username, hashedPassword, req.params.id);

      db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        req.user.id,
        'Router Updated',
        `Updated router ${name} details.`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update router' });
    }
  });

  app.delete('/api/routers/:id', authenticate, (req, res) => {
    try {
      db.prepare(`DELETE FROM mikrotik_routers WHERE id = ?`).run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return res.status(400).json({ error: 'Cannot delete router because it has active subscribers assigned to it.' });
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/routers/:id/status', authenticate, async (req, res) => {
    try {
      const routerId = parseInt(req.params.id, 10);
      const status = await getRouterStatus(routerId);
      res.json(status);
    } catch (error) {
      res.json({ connected: false });
    }
  });

  app.post('/api/routers/:id/sync', authenticate, async (req, res) => {
    try {
      const routerId = parseInt(req.params.id, 10);
      await syncRouterData(routerId);
      res.json({ success: true, message: 'Router data synced successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/logs', authenticate, async (req, res) => {
    try {
      const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10').all();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
