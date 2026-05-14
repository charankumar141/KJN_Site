'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Coins, Plus, ToggleLeft, ToggleRight, Gift, Users } from 'lucide-react';

export default function AdminCoinsPage() {
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceInfo, setBalanceInfo] = useState(null);

  const [newUserCoins, setNewUserCoins] = useState(100);

  const [promoForm, setPromoForm] = useState({
    name: '',
    coinsAmount: '',
    startAt: '',
    endAt: '',
    isActive: true,
  });

  const [grantForm, setGrantForm] = useState({
    userId: '',
    email: '',
    phone: '',
    coinsAmount: '',
    reason: '',
  });

  const [bulkForm, setBulkForm] = useState({ coinsAmount: '', reason: '' });
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, fRes] = await Promise.all([
        api.get('/admin/coins/settings'),
        api.get('/admin/coins/festivals'),
      ]);
      const s = sRes.data?.data;
      setNewUserCoins(s?.newUserCoins ?? 100);
      setFestivals(fRes.data?.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load coin settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      const coins = parseInt(newUserCoins, 10);
      if (!Number.isFinite(coins) || coins < 0) {
        toast.error('Coins must be a non-negative integer');
        return;
      }
      await api.put('/admin/coins/settings', { newUserCoins: coins });
      toast.success('New customer coins updated');
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Update failed');
    }
  };

  const createPromo = async () => {
    try {
      if (!promoForm.name.trim()) {
        toast.error('Promo name is required');
        return;
      }
      const coins = parseInt(promoForm.coinsAmount, 10);
      if (!Number.isFinite(coins) || coins < 0) {
        toast.error('coinsAmount must be a non-negative integer');
        return;
      }
      if (!promoForm.startAt || !promoForm.endAt) {
        toast.error('startAt and endAt are required');
        return;
      }

      await api.post('/admin/coins/festivals', {
        name: promoForm.name.trim(),
        coinsAmount: coins,
        startAt: new Date(promoForm.startAt),
        endAt: new Date(promoForm.endAt),
        isActive: !!promoForm.isActive,
      });

      toast.success('Festival promo created');
      setPromoForm({ name: '', coinsAmount: '', startAt: '', endAt: '', isActive: true });
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to create promo');
    }
  };

  const togglePromo = async (id, next) => {
    try {
      await api.put(`/admin/coins/festivals/${id}`, { isActive: !!next });
      toast.success(next ? 'Promo activated' : 'Promo deactivated');
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Update failed');
    }
  };

  const grantCoins = async () => {
    try {
      const coins = parseInt(grantForm.coinsAmount, 10);
      if (!Number.isFinite(coins) || coins <= 0) {
        toast.error('coinsAmount must be a positive integer');
        return;
      }
      if (!grantForm.userId && !grantForm.email && !grantForm.phone) {
        toast.error('Provide userId OR email OR phone');
        return;
      }

      await api.post('/admin/coins/grant', {
        userId: grantForm.userId || null,
        email: grantForm.email || null,
        phone: grantForm.phone || null,
        coinsAmount: coins,
        reason: grantForm.reason || 'Admin grant',
        source: 'ADMIN_GRANT',
      });
      toast.success('Coins granted');
      setGrantForm({ userId: '', email: '', phone: '', coinsAmount: '', reason: '' });
      setBalanceInfo(null);
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Grant failed');
    }
  };

  const checkBalance = async () => {
    try {
      if (!grantForm.userId && !grantForm.email && !grantForm.phone) {
        toast.error('Provide userId OR email OR phone to check balance');
        return;
      }
      const res = await api.get('/admin/coins/balance', {
        params: {
          userId: grantForm.userId || undefined,
          email: grantForm.email || undefined,
          phone: grantForm.phone || undefined,
        },
      });
      setBalanceInfo(res.data?.data || null);
      toast.success('Balance loaded');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Balance lookup failed');
    }
  };

  const grantAllCustomers = async () => {
    try {
      const coins = parseInt(bulkForm.coinsAmount, 10);
      if (!Number.isFinite(coins) || coins <= 0) {
        toast.error('coinsAmount must be a positive integer');
        return;
      }
      setBulkLoading(true);
      const res = await api.post('/admin/coins/grant-all', {
        coinsAmount: coins,
        reason: bulkForm.reason?.trim() || undefined,
      });
      toast.success(res.data?.message || 'Bulk grant completed');
      setBulkForm({ coinsAmount: '', reason: '' });
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Bulk grant failed');
    } finally {
      setBulkLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-gray-900">KJN Coins</h1>
        <p className="text-sm text-gray-600 mt-1">1 coin = 1 rupee for redemption mapping (points system).</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-primary-900">
          <Coins className="w-5 h-5" />
          New customer welcome coins
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Coins for each new signup</label>
            <input
              type="number"
              value={newUserCoins}
              onChange={(e) => setNewUserCoins(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              min={0}
            />
          </div>
          <button
            type="button"
            onClick={saveSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-900"
          >
            Save
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2 font-bold text-primary-900">
          <Gift className="w-5 h-5" />
          Festival promos (extra coins on signup in the date window)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Promo name</label>
            <input
              value={promoForm.name}
              onChange={(e) => setPromoForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Diwali Offer"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Extra coins</label>
            <input
              type="number"
              value={promoForm.coinsAmount}
              onChange={(e) => setPromoForm((p) => ({ ...p, coinsAmount: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              min={0}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Start date/time</label>
            <input
              type="datetime-local"
              value={promoForm.startAt}
              onChange={(e) => setPromoForm((p) => ({ ...p, startAt: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">End date/time</label>
            <input
              type="datetime-local"
              value={promoForm.endAt}
              onChange={(e) => setPromoForm((p) => ({ ...p, endAt: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-4">
            <label className="text-xs font-semibold text-gray-600">Active</label>
            <button
              type="button"
              onClick={() => setPromoForm((p) => ({ ...p, isActive: !p.isActive }))}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {promoForm.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
              {promoForm.isActive ? 'On' : 'Off'}
            </button>
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={createPromo}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-900"
            >
              <Plus className="w-4 h-4" />
              Create promo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-700">Coins</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-700">Start</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-700">End</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-700">Status</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {festivals.length === 0 ? (
                <tr>
                  <td className="py-8 px-4 text-sm text-gray-500" colSpan={6}>
                    No festival promos yet.
                  </td>
                </tr>
              ) : (
                festivals.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">{p.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{p.coinsAmount}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{new Date(p.startAt).toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{new Date(p.endAt).toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{p.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => togglePromo(p.id, !p.isActive)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-primary-900">
          <Users className="w-5 h-5" />
          Grant coins to all customers
        </div>
        <p className="text-sm text-gray-600">
          Credits every account with role <strong>Customer</strong>. Logged-in shoppers will see the new balance in the site menu (KJN Coins) and at checkout.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Coins per customer</label>
            <input
              type="number"
              value={bulkForm.coinsAmount}
              onChange={(e) => setBulkForm((b) => ({ ...b, coinsAmount: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              min={1}
              placeholder="e.g. 50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (optional)</label>
            <input
              value={bulkForm.reason}
              onChange={(e) => setBulkForm((b) => ({ ...b, reason: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. New Year bonus"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              disabled={bulkLoading}
              onClick={grantAllCustomers}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-900 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
            >
              {bulkLoading ? 'Processing…' : 'Grant to all customers'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-primary-900">
          <Plus className="w-5 h-5" />
          Manual coin grant (admin)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">User ID (optional)</label>
            <input
              value={grantForm.userId}
              onChange={(e) => setGrantForm((g) => ({ ...g, userId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="user uuid"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email (optional)</label>
            <input
              value={grantForm.email}
              onChange={(e) => setGrantForm((g) => ({ ...g, email: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="name@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone (optional)</label>
            <input
              value={grantForm.phone}
              onChange={(e) => setGrantForm((g) => ({ ...g, phone: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="mobile number"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Coins to grant (positive)</label>
            <input
              type="number"
              value={grantForm.coinsAmount}
              onChange={(e) => setGrantForm((g) => ({ ...g, coinsAmount: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              min={1}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (optional)</label>
            <input
              value={grantForm.reason}
              onChange={(e) => setGrantForm((g) => ({ ...g, reason: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Festival bonus / Customer support"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={checkBalance}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-800 rounded-xl text-sm font-semibold hover:border-primary-800"
              >
                Check balance
              </button>
              <button
                type="button"
                onClick={grantCoins}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-900"
              >
                Grant coins
              </button>
            </div>
          </div>
        </div>

        {balanceInfo && (
          <div className="pt-4 border-t border-gray-100">
            <div className="font-bold text-primary-900 text-sm mb-2">Coin balance</div>
            <div className="text-sm text-gray-700">
              Balance: <span className="font-extrabold">{balanceInfo.balance}</span> coins
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

