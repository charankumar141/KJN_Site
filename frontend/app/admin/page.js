'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Package, ShoppingBag, Users, TrendingUp,
  TrendingDown, AlertCircle, Clock, DollarSign,
  Zap, ArrowUpRight, ChevronRight
} from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/useAuthStore';

const RS = String.fromCharCode(8377);
function fmt(n) { return Number(n).toLocaleString('en-IN'); }

/* ─── Animated Counter ──────────────────── */
function AnimatedNumber({ value, prefix = '', duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const end = typeof value === 'number' ? value : parseInt(value) || 0;
    if (end === 0) {
      ref.current = requestAnimationFrame(() => setDisplay(0));
      return () => cancelAnimationFrame(ref.current);
    }
    const startTime = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.floor(eased * end));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);

  return <>{prefix}{display.toLocaleString('en-IN')}</>;
}

/* ─── Status Badge ──────────────────── */
const statusColors = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SHIPPED: 'bg-purple-50 text-purple-700 border-purple-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  OUT_FOR_DELIVERY: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  RETURNED: 'bg-rose-50 text-rose-700 border-rose-200',
  REFUNDED: 'bg-gray-50 text-gray-700 border-gray-200',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    Promise.all([
      api.get('/admin/dashboard'),
      api.get('/orders/admin/all?limit=5'),
    ]).then(([dashRes, ordersRes]) => {
      setStats(dashRes.data.data);
      setRecentOrders(ordersRes.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!stats) return <p className="text-gray-600">Failed to load dashboard data</p>;

  const statCards = [
    {
      title: 'Pending Orders',
      value: stats.orders?.pending || 0,
      trend: '+12%',
      trendUp: false,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50',
      description: 'Awaiting processing',
      link: '/admin/orders'
    },
    {
      title: 'Total Orders',
      value: stats.orders?.total || 0,
      trend: '+23%',
      trendUp: true,
      icon: ShoppingBag,
      gradient: 'from-primary-700 to-primary-900',
      bgLight: 'bg-primary-50',
      description: 'All time orders',
      link: '/admin/orders'
    },
    {
      title: 'Total Products',
      value: stats.products?.total || 0,
      trend: '+8%',
      trendUp: true,
      icon: Package,
      gradient: 'from-blue-500 to-blue-700',
      bgLight: 'bg-blue-50',
      description: 'Active listings',
      link: '/admin/products'
    },
    {
      title: 'Low Stock',
      value: stats.products?.lowStock || 0,
      trend: '-5%',
      trendUp: false,
      icon: AlertCircle,
      gradient: 'from-red-500 to-rose-600',
      bgLight: 'bg-red-50',
      description: 'Need restocking',
      link: '/admin/products'
    },
    {
      title: 'Abandoned Carts',
      value: stats.carts?.abandoned || 0,
      trend: '+0%',
      trendUp: true,
      icon: ShoppingBag,
      gradient: 'from-slate-600 to-slate-800',
      bgLight: 'bg-slate-50',
      description: 'Users left without buying',
      link: '/admin/abandoned-carts'
    },
  ];

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <p className="text-primary-200 text-sm font-medium mb-1">{greeting} 👋</p>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl mb-2">
            Welcome back, {user?.name || 'Admin'}
          </h1>
          <p className="text-primary-200 text-sm max-w-lg">
            Here&apos;s your store overview. Monitor orders, manage products, and keep your business running smoothly.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, index) => (
          <Link
            key={index}
            href={card.link}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Decorative gradient strip */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />

            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${card.trendUp
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
                }`}>
                {card.trendUp ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                <span className={`text-xs font-bold ${card.trendUp ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                  {card.trend}
                </span>
              </div>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{card.title}</p>
            <h3 className="font-heading font-extrabold text-3xl text-gray-900 mb-1">
              <AnimatedNumber value={card.value} />
            </h3>
            <p className="text-xs text-gray-500">{card.description}</p>

            {/* Hover arrow */}
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="w-5 h-5 text-gray-300" />
            </div>
          </Link>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders - Larger */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-lg text-gray-900">Recent Orders</h2>
              <p className="text-xs text-gray-500 mt-0.5">Latest orders across your store</p>
            </div>
            <Link href="/admin/orders" className="text-xs font-semibold text-primary-700 hover:text-primary-900 flex items-center gap-1 transition-colors">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No orders yet</div>
            ) : (
              recentOrders.slice(0, 5).map(order => (
                <div key={order.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  {/* Order avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-700">{order.user?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{order.user?.name || 'Unknown'}</p>
                      <span className="text-[10px] text-gray-400 font-mono">#{order.orderNumber}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  {/* Amount */}
                  <p className="text-sm font-bold text-gray-900">{RS}{fmt(order.totalAmount)}</p>
                  {/* Status */}
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColors[order.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    {order.status?.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-heading font-bold text-lg text-gray-900">Quick Actions</h2>
            <p className="text-xs text-gray-500 mt-0.5">Frequently used shortcuts</p>
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: 'Add Product', href: '/admin/products', icon: Package, gradient: 'from-primary-600 to-primary-800', desc: 'Create new listings' },
              { label: 'View All Orders', href: '/admin/orders', icon: ShoppingBag, gradient: 'from-blue-500 to-blue-700', desc: 'Manage customer orders' },
              { label: 'Flash Sales', href: '/admin/flash-sales', icon: Zap, gradient: 'from-amber-500 to-orange-600', desc: 'Limited-time deals' },
              { label: 'Customers', href: '/admin/customers', icon: Users, gradient: 'from-purple-500 to-purple-700', desc: 'View customer base' },
              { label: 'Revenue Report', href: '/admin/revenue', icon: DollarSign, gradient: 'from-emerald-500 to-green-700', desc: 'Financial analytics' },
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="group flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{action.label}</p>
                  <p className="text-[10px] text-gray-400">{action.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
