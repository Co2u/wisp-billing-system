import cron from 'node-cron';
import db from './db.ts';
import { suspendSubscriber } from './mikrotik.ts';

let workerRunInProgress = false;

export function initWorker() {
  runBillingCycleCheck();
  cron.schedule('0 0 * * *', runBillingCycleCheck);
}

function getGracePeriodDays() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('grace_period') as any;
  const value = row?.value ?? '7';
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 7 : parsed;
}

async function generateRecurringInvoices() {
  try {
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

    console.log(`Found ${subscribersToBill.length} subscribers needing billing.`);

    const gracePeriod = getGracePeriodDays();
    for (const sub of subscribersToBill) {
      const billingDate = new Date(sub.billing_date);
      const dueDate = new Date(billingDate);
      dueDate.setDate(dueDate.getDate() + sub.billing_cycle + gracePeriod);
      const dueDateStr = dueDate.toISOString();

      const result = db.prepare(`
        INSERT INTO invoices (subscriber_id, amount, due_date)
        VALUES (?, ?, ?)
      `).run(sub.id, sub.price, dueDateStr);

      console.log(`Generated invoice #${result.lastInsertRowid} for subscriber ${sub.full_name} ($${sub.price}) due ${dueDateStr}`);
    }

    if (subscribersToBill.length > 0) {
      db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)')
        .run(null, 'Automatic Invoice Generation', `Generated ${subscribersToBill.length} recurring invoices.`);
    }
  } catch (error) {
    console.error('Error in generateRecurringInvoices:', error);
  }
}

async function runBillingCycleCheck() {
  if (workerRunInProgress) {
    console.log('Billing cycle check skipped because a previous run is still in progress.');
    return;
  }

  workerRunInProgress = true;

  try {
    console.log('Running daily billing cycle check...');

    await generateRecurringInvoices();

    console.log('Running daily overdue check...');

    const overdueInvoices = db.prepare(`
      SELECT i.subscriber_id
      FROM invoices i
      JOIN subscribers s ON i.subscriber_id = s.id
      WHERE datetime(i.due_date) < datetime('now')
        AND i.status = 'UNPAID'
        AND s.status = 'ACTIVE'
    `).all() as { subscriber_id: number }[];

    for (const invoice of overdueInvoices) {
      console.log(`Suspending subscriber ${invoice.subscriber_id} due to overdue invoice.`);
      await suspendSubscriber(invoice.subscriber_id);
    }

    console.log('Daily billing cycle check completed.');
  } catch (error) {
    console.error('Error in billing cycle check:', error);
  } finally {
    workerRunInProgress = false;
  }
}
