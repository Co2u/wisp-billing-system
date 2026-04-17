import cron from 'node-cron';
import db from './db';
import { suspendSubscriber } from './mikrotik';

export function initWorker() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily overdue check...');
    
    // Find overdue users: due_date < NOW AND status = ACTIVE
    // In SQLite, datetime('now') gets current UTC time
    const overdueInvoices = db.prepare(`
      SELECT i.subscriber_id 
      FROM invoices i
      JOIN subscribers s ON i.subscriber_id = s.id
      WHERE i.due_date < datetime('now') 
        AND i.status = 'UNPAID'
        AND s.status = 'ACTIVE'
    `).all() as { subscriber_id: number }[];

    for (const invoice of overdueInvoices) {
      console.log(`Suspending subscriber ${invoice.subscriber_id} due to overdue invoice.`);
      await suspendSubscriber(invoice.subscriber_id);
    }
    
    console.log('Daily overdue check completed.');
  });
}
