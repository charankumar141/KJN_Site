'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';

export default function PincodeDeliveryPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    pincode: '',
    estimatedDays: 3,
    estimatedDaysMax: '',
    isServiceable: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/pincode-delivery?limit=200');
      setList(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load pincode rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error('Enter a valid 6-digit pincode');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/admin/pincode-delivery/${editId}`, {
          estimatedDays: form.estimatedDays,
          estimatedDaysMax: form.estimatedDaysMax ? parseInt(form.estimatedDaysMax) : null,
          isServiceable: form.isServiceable,
        });
        toast.success('Pincode rule updated');
      } else {
        await api.post('/admin/pincode-delivery', form);
        toast.success('Pincode rule added');
      }
      setShowForm(false);
      setEditId(null);
      setForm({ pincode: '', estimatedDays: 3, estimatedDaysMax: '', isServiceable: true });
      loadList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row) => {
    setForm({
      pincode: row.pincode,
      estimatedDays: row.estimatedDays,
      estimatedDaysMax: row.estimatedDaysMax != null ? String(row.estimatedDaysMax) : '',
      isServiceable: row.isServiceable,
    });
    setEditId(row.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this pincode rule?')) return;
    try {
      await api.delete(`/admin/pincode-delivery/${id}`);
      toast.success('Deleted');
      loadList();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-gray-900">Pincode Delivery</h1>
          <p className="text-sm text-gray-600 mt-1">
            Set estimated delivery days by pincode. When user enters pincode, this estimate is shown (accurate by distance).
          </p>
        </div>
        <button
          onClick={() => {
            setEditId(null);
            setForm({ pincode: '', estimatedDays: 3, estimatedDaysMax: '', isServiceable: true });
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm"
        >
          <Plus className="w-4 h-4" /> Add Pincode
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-heading font-bold text-lg mb-4">{editId ? 'Edit' : 'Add'} Pincode Rule</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Pincode (6 digits) *</label>
              <input
                type="text"
                maxLength={6}
                pattern="\d{6}"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                value={form.pincode}
                onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))}
                placeholder="517390"
                required
                disabled={!!editId}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Est. days (min) *</label>
              <input
                type="number"
                min={1}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                value={form.estimatedDays}
                onChange={(e) => setForm((f) => ({ ...f, estimatedDays: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Est. days (max, optional)</label>
              <input
                type="number"
                min={1}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                value={form.estimatedDaysMax}
                onChange={(e) => setForm((f) => ({ ...f, estimatedDaysMax: e.target.value }))}
                placeholder="5"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isServiceable}
                  onChange={(e) => setForm((f) => ({ ...f, isServiceable: e.target.checked }))}
                  className="w-4 h-4 rounded text-primary"
                />
                <span className="text-sm font-semibold">Serviceable</span>
              </label>
              <button type="submit" disabled={saving} className="px-4 py-3 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-3 border border-gray-200 rounded-xl font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No pincode rules yet. Add one to show accurate delivery estimates.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-bold text-gray-700">Pincode</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">Est. days</th>
                <th className="text-left py-3 px-4 font-bold text-gray-700">Serviceable</th>
                <th className="text-right py-3 px-4 font-bold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono font-semibold">{row.pincode}</td>
                  <td className="py-3 px-4">
                    {row.estimatedDays}
                    {row.estimatedDaysMax != null ? ` - ${row.estimatedDaysMax}` : ''} days
                  </td>
                  <td className="py-3 px-4">
                    <span className={row.isServiceable ? 'text-green-600 font-semibold' : 'text-red-600'}>
                      {row.isServiceable ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => handleEdit(row)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
