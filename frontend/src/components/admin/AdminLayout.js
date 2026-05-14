'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingBag, Users, Tag, ImageIcon,
  FileText, Menu, LogOut, Layers, Zap, Bell, TrendingUp, BarChart3,
  ChevronDown, Boxes, X, ChevronRight, Star, MessageSquare, RotateCcw, CreditCard, Coins
} from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import toast from 'react-hot-toast';
import api from '@/lib/api';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  {
    label: 'Catalogue', icon: Package,
    children: [
      { label: 'Products', href: '/admin/products', icon: ShoppingBag },
      { label: 'Categories', href: '/admin/categories', icon: Layers },
      { label: 'Brands', href: '/admin/brands', icon: Zap },
      { label: 'Collections', href: '/admin/collections', icon: Boxes },
    ]
  },
  {
    label: 'Sales', icon: TrendingUp,
    children: [
      { label: 'Orders',     href: '/admin/orders',     icon: ShoppingBag },
      { label: 'Flash Sales', href: '/admin/flash-sales', icon: Zap        },
      { label: 'Coupons',     href: '/admin/coupons',     icon: Tag        },
      { label: 'Revenue',     href: '/admin/revenue',     icon: TrendingUp },
      { label: 'Revenue by Category', href: '/admin/revenue-by-category', icon: BarChart3 },
      { label: 'Reports (CSV)', href: '/admin/reports', icon: FileText },
      { label: 'Abandoned Carts', href: '/admin/abandoned-carts', icon: ShoppingBag },
      { label: 'Payments',    href: '/admin/payments',    icon: CreditCard },
      { label: 'KJN Coins',   href: '/admin/coins',       icon: Coins },
    ]
  },
  { label: 'Pincode Delivery', href: '/admin/pincode-delivery', icon: Package },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Reviews', href: '/admin/reviews', icon: Star },
  { label: 'Contact Messages', href: '/admin/contact-messages', icon: MessageSquare },
  {
    label: 'Content', icon: FileText,
    children: [
      { label: 'Banners', href: '/admin/banners', icon: ImageIcon },
      { label: 'Blogs', href: '/admin/blogs', icon: FileText },
    ]
  },
];

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState({ Catalogue: true, Sales: true, Content: false });
  const [pending, setPending] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    api.get('/admin/dashboard').then(r => {
      const d = r.data.data;
      setPending(d?.orders?.pending || 0);
      setLowStock(d?.products?.lowStock || 0);
    }).catch(() => { });
    api.get('/reviews/admin/pending').then(r => {
      setPendingReviews((r.data.data || []).length);
    }).catch(() => { });
  }, []);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { }
    logout();
    toast.success('Logged out');
    router.push('/login');
  };

  const isActive = (href) => pathname === href;

  const pageTitle = () => {
    for (const item of navItems) {
      if (item.href === pathname) return item.label;
      if (item.children) {
        const c = item.children.find(ch => ch.href === pathname);
        if (c) return c.label;
      }
    }
    return 'Admin Panel';
  };

  const totalNotifs = pending + lowStock + pendingReviews;

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className={[
        'flex flex-col bg-white border-r border-gray-200 transition-all duration-300',
        'fixed lg:sticky top-0 left-0 h-screen z-50 lg:z-auto',
        sidebarOpen ? 'w-64' : 'w-[72px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}>

        {/* Logo row */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
          {sidebarOpen && (
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-900 flex items-center justify-center">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <div className="leading-none">
                <p className="font-heading font-extrabold text-sm text-gray-900">KJN Shop</p>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            </Link>
          )}
          {/* toggle - desktop */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="hidden lg:flex w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 items-center justify-center transition-colors ml-auto"
          >
            <Menu className="w-4 h-4 text-gray-600" />
          </button>
          {/* close - mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            if (item.children) {
              const open = expanded[item.label];
              const childActive = item.children.some(c => isActive(c.href));

              return (
                <div key={item.label}>
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [item.label]: !p[item.label] }))}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                      childActive
                        ? 'bg-primary-50 text-primary-900'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
                    ].join(' ')}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>

                  {open && sidebarOpen && (
                    <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                      {item.children.map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={[
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
                            isActive(child.href)
                              ? 'bg-primary-900 text-white'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
                          ].join(' ')}
                        >
                          <child.icon className="w-4 h-4 flex-shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  isActive(item.href)
                    ? 'bg-primary-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
                ].join(' ')}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className={`flex-shrink-0 border-t border-gray-200 ${sidebarOpen ? 'p-4' : 'p-2'}`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
          {/* Left */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-400 font-medium">Admin</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              <span className="font-semibold text-gray-800">{pageTitle()}</span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(v => !v)}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {totalNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {totalNotifs > 9 ? '9+' : totalNotifs}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotifs && (
                <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="font-bold text-sm text-gray-900">Notifications</p>
                    <button onClick={() => setShowNotifs(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {pending > 0 && (
                      <Link
                        href="/admin/orders"
                        onClick={() => setShowNotifs(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <ShoppingBag className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{pending} Pending Orders</p>
                          <p className="text-xs text-gray-500">Waiting for processing</p>
                        </div>
                      </Link>
                    )}
                    {lowStock > 0 && (
                      <Link
                        href="/admin/products"
                        onClick={() => setShowNotifs(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-red-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Package className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{lowStock} Low Stock Items</p>
                          <p className="text-xs text-gray-500">Need restocking soon</p>
                        </div>
                      </Link>
                    )}
                    {pendingReviews > 0 && (
                      <Link
                        href="/admin/reviews"
                        onClick={() => setShowNotifs(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-yellow-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Star className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{pendingReviews} Pending Reviews</p>
                          <p className="text-xs text-gray-500">Awaiting moderation</p>
                        </div>
                      </Link>
                    )}
                    {totalNotifs === 0 && (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-gray-500">All caught up!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* User pill */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-900 flex items-center justify-center text-white font-bold text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:block text-sm font-semibold text-gray-800">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
