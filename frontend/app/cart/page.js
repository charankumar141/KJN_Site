'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Minus, Plus, ShoppingBag, Tag,
  ArrowRight, Truck, X, ChevronRight, Package, ShieldCheck,
  Gift, ChevronDown, ChevronUp, Copy, Check, Zap, Coins
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from '@/store/useCartStore';
import useAuthStore from '@/store/useAuthStore';

const RS = String.fromCharCode(8377);

const NO_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23D1D5DB' stroke-width='1'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";

function fmt(n) { return Number(n).toLocaleString('en-IN'); }

export default function CartPage() {
  const { cart, fetchCart, updateItem, removeItem, applyCoupon, removeCoupon, loading } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [coupon, setCoupon] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchCart();
    import('@/lib/api').then(({ default: api }) => {
      api.get('/coupons/active')
        .then(r => setAvailableCoupons(r.data.data || []))
        .catch(() => { });
    });
  }, []);

  // Cart abandonment warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (cart?.items?.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cart?.items?.length]);

  const handleApplyCoupon = async () => {
    if (!coupon.trim()) { toast.error('Enter a coupon code'); return; }
    if (!isAuthenticated) { toast.error('Please login to apply coupons'); return; }
    setCouponLoading(true);
    try {
      const res = await applyCoupon(coupon.toUpperCase());
      toast.success(res.message || 'Coupon applied!');
      setCoupon('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    } finally { setCouponLoading(false); }
  };

  const handleRemoveCoupon = async () => {
    try { await removeCoupon(); toast.success('Coupon removed'); }
    catch { toast.error('Failed to remove coupon'); }
  };

  const handleQty = async (itemId, newQty) => {
    if (newQty < 1) return;
    try { await updateItem(itemId, newQty); }
    catch { toast.error('Failed to update quantity'); }
  };

  const handleRemove = async (itemId) => {
    setRemovingId(itemId);
    try { await removeItem(itemId); toast.success('Item removed'); }
    catch { toast.error('Failed to remove item'); }
    finally { setRemovingId(null); }
  };

  const handlePickCoupon = (code) => {
    setCoupon(code);
    // flash copy indicator
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-primary-900 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-semibold">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (!cart || cart.items?.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Package className="w-12 h-12 text-gray-300" />
        </div>
        <h2 className="font-heading font-extrabold text-2xl text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          Looks like you have not added anything yet. Let us help you find something!
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-primary-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-primary-800 transition-colors"
        >
          <ShoppingBag className="w-5 h-5" />
          Browse Products
        </Link>
        <Link href="/" className="mt-4 text-sm text-gray-500 hover:text-primary-900 font-semibold transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  const freeShippingProgress = Math.min(100, ((cart.subtotal || 0) / 500) * 100);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-10">

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-3 flex items-center gap-1.5 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary-900 font-semibold transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-bold text-gray-800">Shopping Cart</span>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-5">

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <h1 className="font-heading font-extrabold text-2xl md:text-3xl text-gray-900">Shopping Cart</h1>
          <span className="bg-primary-900 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
            {cart.totalItems}
          </span>
        </div>

        {/* Free shipping bar */}
        {cart.freeShippingRemaining > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800 mb-1.5">
                Add <span className="text-amber-600">{RS}{fmt(cart.freeShippingRemaining)}</span> more for FREE delivery!
              </p>
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${freeShippingProgress}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3.5 mb-5 flex items-center gap-3">
            <Truck className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm font-bold text-green-700">You qualify for FREE delivery!</p>
          </div>
        )}

        {/* Body grid */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* Cart items */}
          <div className="flex-1 min-w-0 space-y-3">
            {cart.items.map(item => {
              const totalSaved = item.mrp > item.unitPrice
                ? Math.round(((item.mrp - item.unitPrice) / item.mrp) * 100)
                : 0;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border border-gray-100 transition-all duration-200 ${removingId === item.id ? 'opacity-40 scale-95' : ''
                    }`}
                >
                  <div className="p-4 flex gap-4">
                    {/* Image */}
                    <Link href={`/products/${item.slug}`} className="flex-shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                        <img
                          src={item.image || NO_IMG}
                          alt={item.name}
                          onError={e => { e.target.onerror = null; e.target.src = NO_IMG; }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/products/${item.slug}`} className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-gray-900 leading-snug line-clamp-2 hover:text-primary-900 transition-colors">
                            {item.name}
                          </h3>
                        </Link>
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={removingId === item.id}
                          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center flex-shrink-0 transition-colors group"
                        >
                          <X className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                        </button>
                      </div>

                      {item.variant && (
                          <p className="text-xs text-gray-500 font-semibold">{item.variant}</p>
                        )}

                        {/* Flash sale badge */}
                        {item.isFlashSalePrice && (
                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full w-fit">
                            <Zap className="w-2.5 h-2.5" /> Flash Price
                          </span>
                        )}

                      {/* Price + qty */}
                      <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                        <div className="flex items-baseline flex-wrap gap-1.5">
                          <span className="font-extrabold text-base text-gray-900">
                            {RS}{fmt(item.totalPrice)}
                          </span>
                          {item.mrp > item.unitPrice && (
                            <span className="text-xs text-gray-400 line-through">
                              {RS}{fmt(Number(item.mrp) * item.quantity)}
                            </span>
                          )}
                          {totalSaved > 0 && (
                            <span className="text-xs font-bold text-green-600">
                              {totalSaved}% off
                            </span>
                          )}
                        </div>

                        {/* Qty stepper */}
                        <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => handleQty(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5 text-gray-700" />
                          </button>
                          <span className="w-9 sm:w-10 text-center font-extrabold text-sm text-gray-900 select-none">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQty(item.id, item.quantity + 1)}
                            disabled={item.quantity >= 10}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-gray-700" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Link
              href="/products"
              className="flex items-center gap-2 text-sm font-bold text-primary-900 hover:text-primary-800 transition-colors px-1 py-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>

          {/* Order Summary sidebar */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-24 space-y-4">

            {/* Coupon */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-orange-500" />
                </div>
                <h3 className="font-heading font-bold text-base text-gray-900">Apply Coupon</h3>
              </div>

              {cart.couponCode ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-green-600 font-semibold mb-0.5">Coupon applied</p>
                    <p className="font-extrabold text-green-700 text-sm tracking-wide">{cart.couponCode}</p>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={coupon}
                      onChange={e => setCoupon(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                      className="flex-1 px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-primary-900 focus:outline-none font-semibold uppercase placeholder:normal-case placeholder:font-normal"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading}
                      className="px-4 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                  </div>

                  {/* Available coupons */}
                  {availableCoupons.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setCouponsOpen(v => !v)}
                        className="flex items-center justify-between w-full text-xs font-bold text-primary-900 hover:text-primary-800 transition-colors py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5" />
                          {availableCoupons.length} coupon{availableCoupons.length > 1 ? 's' : ''} available
                        </span>
                        {couponsOpen
                          ? <ChevronUp className="w-3.5 h-3.5" />
                          : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {couponsOpen && (
                        <div className="mt-2 space-y-2">
                          {availableCoupons.map(c => {
                            const isCopied = copiedCode === c.code;
                            const discountLabel =
                              c.type === 'PERCENT'
                                ? Number(c.value) + '% off'
                                : c.type === 'FLAT'
                                  ? RS + Number(c.value).toLocaleString('en-IN') + ' off'
                                  : 'Free Shipping';
                            const eligible = !c.minOrderAmount || cart.subtotal >= Number(c.minOrderAmount);
                            return (
                              <div
                                key={c.code}
                                className={'rounded-xl border-2 border-dashed p-3 flex items-center gap-3 transition-all ' + (
                                  eligible
                                    ? 'border-orange-200 bg-orange-50 hover:border-orange-400'
                                    : 'border-gray-200 bg-gray-50 opacity-60'
                                )}
                              >
                                {/* Code pill */}
                                <div className="flex-shrink-0">
                                  <span className="bg-white border border-orange-300 text-orange-600 font-extrabold text-xs px-2.5 py-1 rounded-lg tracking-widest">
                                    {c.code}
                                  </span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-extrabold text-gray-800">{discountLabel}</p>
                                  {Number(c.minOrderAmount) > 0 && (
                                    <p className={'text-[10px] font-semibold mt-0.5 ' + (eligible ? 'text-gray-500' : 'text-orange-600')}>
                                      {eligible
                                        ? 'You are eligible!'
                                        : 'Min order: ' + RS + Number(c.minOrderAmount).toLocaleString('en-IN')}
                                    </p>
                                  )}
                                  {c.maxDiscount && c.type === 'PERCENT' && (
                                    <p className="text-[10px] text-gray-400 font-semibold">
                                      Upto {RS}{Number(c.maxDiscount).toLocaleString('en-IN')}
                                    </p>
                                  )}
                                  {c.validUntil && (
                                    <p className="text-[10px] text-gray-400 font-semibold">
                                      Expires {new Date(c.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </p>
                                  )}
                                </div>

                                {/* Apply button */}
                                <button
                                  onClick={() => handlePickCoupon(c.code)}
                                  disabled={!eligible}
                                  className={'flex-shrink-0 flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ' + (
                                    eligible
                                      ? 'bg-primary-900 hover:bg-primary-800 text-white'
                                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  )}
                                >
                                  {isCopied
                                    ? <><Check className="w-3 h-3" /> Copied!</>
                                    : <><Copy className="w-3 h-3" /> Apply</>}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Price summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-heading font-bold text-base text-gray-900 mb-4">Order Summary</h3>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Subtotal ({cart.totalItems} items)</span>
                  <span className="font-bold text-gray-900">{RS}{fmt(cart.subtotal)}</span>
                </div>

                {cart.couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-semibold">Coupon Discount</span>
                    <span className="font-bold text-green-600">-{RS}{fmt(cart.couponDiscount)}</span>
                  </div>
                )}

                {cart.coinDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 font-semibold">KJN Coins Discount</span>
                    <span className="font-bold text-emerald-600">-{RS}{fmt(cart.coinDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Delivery</span>
                  <span className={`font-bold ${cart.shippingCharge === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {cart.shippingCharge === 0 ? 'FREE' : `${RS}${cart.shippingCharge}`}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-semibold">GST (included)</span>
                  <span className="text-gray-400 font-semibold">{RS}{Number(cart.gstAmount || 0).toFixed(2)}</span>
                </div>

                <div className="border-t-2 border-gray-100 pt-3 flex justify-between">
                  <span className="font-heading font-extrabold text-base text-gray-900">Total</span>
                  <span className="font-heading font-extrabold text-xl text-primary-900">
                    {RS}{fmt(cart.totalAmount)}
                  </span>
                </div>

                {(cart.couponDiscount > 0 || cart.coinDiscount > 0) && (
                  <div className="bg-green-50 rounded-xl px-4 py-2.5 text-center">
                    <p className="text-sm font-extrabold text-green-700">
                      You save {RS}{fmt((cart.couponDiscount || 0) + (cart.coinDiscount || 0))} on this order!
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push('/checkout')}
                className="w-full mt-5 py-3.5 bg-primary-900 hover:bg-primary-800 text-white font-extrabold text-base rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { icon: ShieldCheck, text: 'Secure Payment' },
                  { icon: Truck, text: 'Fast Delivery' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <Icon className="w-4 h-4 text-primary-900 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden z-30 shadow-lg">
        <div className="flex-1">
          <p className="text-xs text-gray-500 font-semibold">Total</p>
          <p className="font-heading font-extrabold text-lg text-primary-900">
            {RS}{fmt(cart.totalAmount)}
          </p>
        </div>
        <button
          onClick={() => router.push('/checkout')}
          className="flex-1 py-3 bg-primary-900 hover:bg-primary-800 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          Checkout <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}