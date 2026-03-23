'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { ShoppingBag, MapPin, Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const RS = String.fromCharCode(8377);

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    loadCarts();
  }, [page]);

  const sendReminder = async (cartId) => {
    setSendingId(cartId);
    try {
      await api.post(`/admin/abandoned-carts/${cartId}/send-reminder`);
      toast.success('Reminder email sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send email');
    } finally {
      setSendingId(null);
    }
  };

  const loadCarts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/abandoned-carts?page=${page}&limit=10`);
      setCarts(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load abandoned carts', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && carts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-gray-900">Abandoned Carts</h1>
        <p className="text-sm text-gray-600 mt-1">
          Users who added items to cart but did not place order. User details, product and address (if entered at checkout) are shown.
        </p>
      </div>

      {carts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-heading font-bold text-lg text-gray-900 mb-2">No abandoned carts</h3>
          <p className="text-gray-500">When users add to cart and leave without buying, they will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Mobile</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Products</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Address</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">City</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">State</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Pincode</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Subtotal</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Items</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Last Updated</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Email</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => {
                  const snap = cart.checkoutSnapshot || {};
                  const userName = cart.user?.name || snap.name || 'Guest';
                  const phone = cart.user?.phone || snap.phone || '';
                  const email = cart.user?.email || '';
                  const products = (cart.items || []).map((i) => i.productName).filter(Boolean);
                  const productsText = products.length > 3 ? products.slice(0, 3).join(', ') + ` +${products.length - 3}` : products.join(', ');
                  return (
                    <tr key={cart.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{userName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{cart.userId || cart.sessionId}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{phone || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{email || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-[320px]">
                        <div className="line-clamp-2" title={products.join(', ')}>{productsText || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-[320px]">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="line-clamp-2" title={[snap.line1, snap.line2].filter(Boolean).join(', ')}>
                            {[snap.line1, snap.line2].filter(Boolean).join(', ') || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{snap.city || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{snap.state || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-mono">{snap.pincode || '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold">{RS}{Number(cart.subtotal || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{cart.totalItems || 0}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-600 whitespace-nowrap">
                        {new Date(cart.updatedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cart.user?.email ? (
                          <button
                            type="button"
                            onClick={() => sendReminder(cart.id)}
                            disabled={sendingId === cart.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-900 disabled:opacity-50"
                            title="Send abandoned cart reminder"
                          >
                            {sendingId === cart.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                            Send
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400" title="Logged-in email required">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
