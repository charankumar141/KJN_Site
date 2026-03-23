'use client';

import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FileDown, ListOrdered, Users, CreditCard, Building2, ShoppingBag, BarChart3, Package } from 'lucide-react';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const REPORTS = [
  { key: 'order', label: 'Order report', endpoint: '/admin/reports/export/orders', filenamePrefix: 'orders-report', icon: ListOrdered, requiresRange: true },
  { key: 'sales', label: 'Sales report', endpoint: '/admin/reports/export/sales', filenamePrefix: 'sales-report', icon: BarChart3, requiresRange: true },
  { key: 'customer', label: 'Customer report', endpoint: '/admin/reports/export/customers', filenamePrefix: 'customers-report', icon: Users, requiresRange: true },
  { key: 'order-items', label: 'Orders items report', endpoint: '/admin/reports/export/order-items', filenamePrefix: 'order-items-report', icon: ListOrdered, requiresRange: true },
  { key: 'order-item', label: 'Order item report', endpoint: '/admin/reports/export/order-items', filenamePrefix: 'order-items-report', icon: ListOrdered, requiresRange: true },
  { key: 'payment', label: 'Payment report', endpoint: '/admin/reports/export/payments', filenamePrefix: 'payment-report', icon: CreditCard, requiresRange: true },
  { key: 'wallet', label: 'Wallet report (COD advance)', endpoint: '/admin/reports/export/wallet', filenamePrefix: 'wallet-advance-report', icon: Building2, requiresRange: true },
  { key: 'gst-sales', label: 'GST sales report', endpoint: '/admin/reports/export/gst-sales', filenamePrefix: 'gst-sales-report', icon: Building2, requiresRange: true },
  { key: 'gstr1', label: 'GSTR1 report (simplified)', endpoint: '/admin/reports/export/gstr1', filenamePrefix: 'gstr1-report', icon: Building2, requiresRange: true },
  { key: 'daily', label: 'Daily sales summary', endpoint: '/admin/reports/export/daily-sales', filenamePrefix: 'daily-sales-summary', icon: BarChart3, requiresRange: true },
  { key: 'abandoned', label: 'Abandoned cart report', endpoint: '/admin/reports/export/abandoned-carts', filenamePrefix: 'abandoned-carts', icon: ShoppingBag, requiresRange: false },
  { key: 'stock', label: 'Stock report', endpoint: '/admin/reports/export/stock', filenamePrefix: 'stock-report', icon: Package, requiresRange: false },
];

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(null);
  const [selectedKey, setSelectedKey] = useState('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const selected = REPORTS.find((r) => r.key === selectedKey) || REPORTS[0];
  const Icon = selected.icon;

  const run = async () => {
    setLoading(selected.key);
    try {
      const params = {};
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(to).toISOString();

      const res = await api.get(selected.endpoint, {
        responseType: 'blob',
        params,
      });
      const filename = `${selected.filenamePrefix}-${Date.now()}.csv`;
      downloadBlob(res.data, filename);
      toast.success('Download started');
    } catch (e) {
      console.error(e);
      toast.error('Download failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-gray-900">Reports (CSV)</h1>
        <p className="text-sm text-gray-600 mt-1">Choose a report type from the dropdown and download as CSV for Excel.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2 text-primary-900 font-bold">
          {Icon && <Icon className="w-5 h-5" />}
          {selected.label}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Report type</label>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {REPORTS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={loading === selected.key}
          onClick={run}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-900 disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" />
          {loading === selected.key ? 'Downloading…' : 'Download CSV'}
        </button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>Note: Wallet report exports COD advance from orders (no separate wallet table exists in schema).</p>
          <p>GSTR1 export is simplified (state + tax-rate), since GSTIN/HSN details aren’t stored.</p>
        </div>
      </div>
    </div>
  );
}
