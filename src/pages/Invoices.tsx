import React, { useState, useEffect } from 'react';
import { Search, Currency, FileText } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [receiptNumber, setReceiptNumber] = useState('');

  const fetchInvoices = async () => {
    try {
      const res = await apiFetch('/api/invoices', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleGenerateBatch = async () => {
    if (!window.confirm('Generate invoices for subscribers whose billing cycle has come due?')) return;
    setGenerating(true);
    try {
      const res = await apiFetch('/api/invoices/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Successfully generated ${data.count} new invoices.`);
        fetchInvoices();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate invoices.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePayClick = (invoice: any) => {
    setSelectedInvoice(invoice);
    setReceiptNumber('');
    setPaymentModalOpen(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !receiptNumber) return;

    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ invoice_id: selectedInvoice.id, amount: selectedInvoice.amount, receipt_number: receiptNumber })
      });
      fetchInvoices();
      setPaymentModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.subscriber_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(inv.id).includes(searchQuery)
  );

  return (
    <div className="p-6 flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Invoices & Billing</h2>
        <button 
          onClick={handleGenerateBatch}
          disabled={generating}
          className="bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 hover:bg-[var(--card-bg)] transition-colors disabled:opacity-50"
        >
          <FileText size={16} />
          {generating ? 'Generating...' : 'Generate Batch'}
        </button>
      </div>

      <div className="bento-card flex-1 overflow-hidden p-0 flex flex-col">
        <div className="p-4 border-b border-[var(--border)] flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={16} />
            <input 
              type="text" 
              placeholder="Search invoices by name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-[var(--bg)] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">INV #</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Subscriber</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Amount</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Due Date</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Status</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-dim)]">Loading invoices...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-dim)]">No invoices found.</td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs opacity-80">INV-{String(inv.id).padStart(5, '0')}</td>
                    <td className="px-6 py-4 font-medium">{inv.subscriber_name}</td>
                    <td className="px-6 py-4 font-mono text-xs">₱{inv.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-[var(--text-dim)]">{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${inv.status === 'PAID' ? 'badge-active' : 'badge-expired'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.status === 'UNPAID' && (
                        <button 
                          onClick={() => handlePayClick(inv)}
                          className="bg-[rgba(63,185,80,0.1)] text-[var(--accent-green)] border border-[var(--accent-green)] px-3 py-1 rounded text-xs font-semibold hover:bg-[rgba(63,185,80,0.2)] transition-colors inline-flex items-center gap-1"
                        >
                          <Currency size={12} />
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && selectedInvoice && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bento-card w-full max-w-sm shadow-2xl border-[var(--border)]">
            <div className="flex items-center gap-2 mb-6">
              <Currency size={18} className="text-[var(--accent-green)]" />
              <h3 className="text-lg font-semibold">Record Payment</h3>
            </div>
            
            <form onSubmit={submitPayment} className="space-y-4">
              <div className="bg-white/5 p-3 rounded-md text-sm mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--text-dim)]">Subscriber:</span>
                  <span className="font-semibold">{selectedInvoice.subscriber_name}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--text-dim)]">Amount Due:</span>
                  <span className="font-semibold text-[var(--accent-green)]">₱{selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Receipt Number</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="e.g. REC-10293"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[var(--accent-green)] text-[var(--bg)] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
