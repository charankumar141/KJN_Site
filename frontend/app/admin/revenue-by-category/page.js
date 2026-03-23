'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const RS = String.fromCharCode(8377);
const COLORS = ['#1B5E20', '#2E7D32', '#43A047', '#66BB6A', '#81C784', '#A5D6A7'];

export default function RevenueByCategoryPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadReport();
  }, [from, to]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/revenue-report/category?from=${from}&to=${to}`);
      setData(res.data.data || []);
    } catch (err) {
      console.error('Failed to load category report', err);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-gray-900">Revenue by Category</h1>
        <p className="text-sm text-gray-600 mt-1">Reports of different categories: revenue, quantity sold, order count.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No data for this period.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-heading font-bold text-lg mb-4">Summary</h2>
            <p className="text-2xl font-extrabold text-primary-900">{RS}{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total revenue</p>
            <p className="text-sm text-gray-500 mt-1">{data.length} categories</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-heading font-bold text-lg mb-4">Revenue by Category</h2>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tickFormatter={(v) => `${RS}${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="categoryName" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${RS}${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#1B5E20" radius={[0, 4, 4, 0]}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Category</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Quantity</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Orders</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.categoryId} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-900">{row.categoryName}</td>
                    <td className="py-3 px-4 text-right font-semibold">{RS}{row.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
