'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ShoppingBag, Search, Heart, User, Menu, X,
  ChevronDown, ChevronRight, Bell, LogOut,
  Package, Settings, Tag, Layers, Zap, Home,
  FileText, Shield, RotateCcw, Truck, CreditCard,
  Coins,
} from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import useCartStore from '@/store/useCartStore';
import api from '@/lib/api';

const NAV_LINKS = [
  { label: 'Home',       href: '/'           },
  { label: 'Products',   href: '/products'   },
  { label: 'Categories', href: '/categories' },
  { label: 'Brands',     href: '/brands'     },
];

const MORE_LINKS = [
  { label: 'My Account',        href: '/account',          icon: User    },
  { label: 'My Orders',         href: '/orders',           icon: Package },
  { label: 'KJN Coins',         href: '/cart',             icon: Coins   },
  { label: 'About Us',          href: '/about-us',         icon: Layers  },
  { label: 'Blog',              href: '/blog',             icon: Tag     },
  { label: 'Contact Us',        href: '/contact-us',       icon: Bell    },
];

const POLICY_LINKS = [
  { label: 'Terms & Conditions', href: '/tos',              icon: FileText },
  { label: 'Privacy Policy',     href: '/privacy-policy',   icon: Shield  },
  { label: 'Refund Policy',      href: '/refund-policy',    icon: RotateCcw },
  { label: 'Shipping Policy',    href: '/shipping-policy',  icon: Truck   },
  { label: 'Payment Policy',     href: '/payment-policy',   icon: CreditCard },
];

export default function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();

  const [scrolled,      setScrolled]      = useState(false);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [categories,    setCategories]    = useState([]);
  const [catOpen,       setCatOpen]       = useState(false);
  const [moreOpen,      setMoreOpen]      = useState(false);
  const [accountOpen,   setAccountOpen]   = useState(false);
  const [coinBalance,   setCoinBalance]   = useState(null);

  const { user, isAuthenticated, logout } = useAuthStore();
  const { cart, fetchCart }               = useCartStore();
  const cartCount = cart?.totalItems || 0;

  const searchRef  = useRef(null);
  const catRef     = useRef(null);
  const moreRef    = useRef(null);
  const accountRef = useRef(null);

  /* scroll shadow */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /* close drawer on route change */
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  /* lock body scroll when drawer open */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  /* fetch meta once */
  useEffect(() => {
    fetchCart();
    api.get('/categories?limit=24').then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCoinBalance(null);
      return;
    }
    const load = () => {
      api.get('/user/coins').then((r) => {
        setCoinBalance(parseInt(r.data?.data?.balance ?? 0, 10) || 0);
      }).catch(() => setCoinBalance(null));
    };
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [isAuthenticated, pathname]);

  /* search with debounce */
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(searchQuery)}&limit=6`);
        setSearchResults(res.data.data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 320);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* outside-click closers */
  useEffect(() => {
    const fn = (e) => {
      if (catRef.current     && !catRef.current.contains(e.target))     setCatOpen(false);
      if (moreRef.current    && !moreRef.current.contains(e.target))    setMoreOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
      if (searchRef.current  && !searchRef.current.contains(e.target))  { setSearchOpen(false); }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery('');
    setSearchOpen(false);
    setSearchResults([]);
  };

  const handleLogout = () => {
    logout();
    setAccountOpen(false);
    router.push('/');
  };

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  const RS = String.fromCharCode(8377);

  return (
    <>
      {/* ??????????? MAIN HEADER ??????????? */}
      <header className={`sticky top-0 z-[200] bg-white transition-all duration-300 ${
        scrolled ? 'shadow-[0_4px_24px_rgba(0,0,0,0.10)]' : 'border-b border-gray-100'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 h-16">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <img
                src="https://image.cdn.shpy.in/386933/KJNLogo-1767688579320.jpeg?height=200&format=webp"
                alt="KJN Shop"
                className="h-10 w-auto object-contain"
              />
            </Link>

            {/* ?? Desktop Search ?? */}
            <div className="hidden md:flex flex-1 max-w-xl relative" ref={searchRef}>
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search products, brands, categories..."
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:border-primary-900 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>

              {/* Search dropdown */}
              {searchOpen && (searchQuery.length >= 2) && (
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  {searching ? (
                    <div className="flex items-center gap-3 px-4 py-4 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                      Searching...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      {searchResults.map(p => (
                        <Link key={p.id} href={`/products/${p.slug}`}
                          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            <img src={p.image || p.images?.[0]?.image} alt={p.name}
                              className="w-full h-full object-cover"
                              onError={e => { e.target.style.display = 'none'; }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                            <p className="text-xs text-gray-500">{p.category?.name}</p>
                          </div>
                          <span className="text-sm font-extrabold text-primary-900 flex-shrink-0">
                            {RS}{Number(p.sellingPrice).toLocaleString('en-IN')}
                          </span>
                        </Link>
                      ))}
                      <button
                        onClick={handleSearch}
                        className="w-full px-4 py-3 text-sm font-bold text-primary-900 bg-primary-50 hover:bg-primary-100 transition-colors flex items-center justify-center gap-2"
                      >
                        View all results for &quot;{searchQuery}&quot; <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="px-4 py-4 text-sm text-gray-500 text-center">No products found</div>
                  )}
                </div>
              )}
            </div>

            {/* ?? Desktop Nav Links ?? */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive(link.href)
                      ? 'text-primary-900 bg-primary-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}>
                  {link.label}
                </Link>
              ))}

              {/* More dropdown */}
              <div className="relative" ref={moreRef}>
                <button onClick={() => setMoreOpen(v => !v)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    moreOpen ? 'text-primary-900 bg-primary-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}>
                  More
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                {moreOpen && (
                  <div className="absolute top-[calc(100%+8px)] right-0 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden py-1">
                    {MORE_LINKS.filter((item) => item.label !== 'KJN Coins' || isAuthenticated).map((item) => (
                      <Link key={item.href + item.label} href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-primary-900 transition-colors">
                        <span className="flex items-center gap-3 min-w-0">
                          <item.icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.label === 'KJN Coins' && coinBalance != null && (
                          <span className="text-xs font-extrabold text-amber-700 flex-shrink-0">{RS}{Number(coinBalance).toLocaleString('en-IN')}</span>
                        )}
                      </Link>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Policies</p>
                      {POLICY_LINKS.map(item => (
                        <Link key={item.href} href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-primary-900 transition-colors">
                          <item.icon className="w-3.5 h-3.5 text-gray-400" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </nav>

            {/* ?? Right Icons ?? */}
            <div className="flex items-center gap-1 ml-auto">

              {/* Mobile search */}
              <button onClick={() => router.push('/products')}
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                <Search className="w-4.5 h-4.5 text-gray-700" />
              </button>

              {/* Wishlist */}
              {isAuthenticated && (
                <Link href="/account/wishlist"
                  className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                  <Heart className="w-4.5 h-4.5 text-gray-700" />
                </Link>
              )}

              {/* Admin badge */}
              {isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                <Link href="/admin"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary-900 text-white text-xs font-bold rounded-xl hover:bg-primary-800 transition-colors">
                  <Settings className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}

              {/* Cart */}
              <Link href="/cart" className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                <ShoppingBag className="w-4.5 h-4.5 text-gray-700" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center px-1 leading-none">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>

              {/* Account */}
              {isAuthenticated ? (
                <div className="relative" ref={accountRef}>
                  <button onClick={() => setAccountOpen(v => !v)}
                    className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl border-2 transition-all ${
                      accountOpen ? 'border-primary-900 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-900 to-green-600 flex items-center justify-center text-white text-xs font-extrabold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-sm font-bold text-gray-800 max-w-20 truncate">
                      {user?.name?.split(' ')[0]}
                    </span>
                    <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-gray-500 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {accountOpen && (
                    <div className="absolute top-[calc(100%+8px)] right-0 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                      {/* User info header */}
                      <div className="px-4 py-3 bg-gradient-to-r from-primary-900 to-green-700 text-white">
                        <p className="font-extrabold text-sm">{user?.name}</p>
                        <p className="text-xs text-white/70 truncate">{user?.email || user?.phone}</p>
                        {coinBalance != null && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-200">
                            <Coins className="w-3.5 h-3.5 flex-shrink-0" />
                            KJN Coins: {RS}{Number(coinBalance).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                      <div className="py-1">
                        {[
                          { label: 'My Account',  href: '/account',        icon: User    },
                          { label: 'My Orders',   href: '/orders',         icon: Package },
                          { label: 'Wishlist',    href: '/account/wishlist', icon: Heart  },
                        ].map(item => (
                          <Link key={item.href} href={item.href}
                            onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-primary-900 transition-colors">
                            <item.icon className="w-4 h-4 text-gray-400" />
                            {item.label}
                          </Link>
                        ))}
                        {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                          <Link href="/admin" onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-primary-900 transition-colors">
                            <Settings className="w-4 h-4 text-gray-400" /> Admin Panel
                          </Link>
                        )}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                            <LogOut className="w-4 h-4" /> Logout
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/login"
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white text-sm font-bold rounded-xl transition-colors">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Login</span>
                </Link>
              )}

              {/* Mobile hamburger */}
              <button onClick={() => setDrawerOpen(v => !v)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors ml-1">
                {drawerOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
              </button>
            </div>
          </div>
        </div>

        {/* ?? Desktop Category Strip ?? */}
        <div className="hidden lg:block border-t border-gray-100 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-0 h-10 overflow-x-auto hide-scroll">
              <div className="relative flex-shrink-0" ref={catRef}>
                <button onClick={() => setCatOpen(v => !v)}
                  className={`flex items-center gap-1.5 h-10 px-4 text-xs font-extrabold uppercase tracking-wide transition-colors ${
                    catOpen ? 'text-primary-900 bg-primary-50' : 'text-gray-700 hover:text-primary-900 hover:bg-gray-50'
                  }`}>
                  <Layers className="w-3.5 h-3.5" />
                  All Categories
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${catOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Mega dropdown */}
                {catOpen && (
                  <div className="absolute top-full left-0 bg-white rounded-b-2xl shadow-2xl border border-t-0 border-gray-100 z-50 w-64 py-2 max-h-80 overflow-y-auto">
                    {categories.map(cat => (
                      <Link key={cat.id} href={`/categories/${cat.slug}`}
                        onClick={() => setCatOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-900 transition-colors">
                        {cat.image
                          ? <img src={cat.image} alt={cat.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Package className="w-3 h-3 text-gray-400" /></div>
                        }
                        {cat.name}
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />

              {/* Quick category pills */}
              {categories.slice(0, 10).map(cat => (
                <Link key={cat.id} href={`/categories/${cat.slug}`}
                  className={`flex-shrink-0 px-3 h-10 flex items-center text-xs font-semibold transition-colors whitespace-nowrap ${
                    pathname === `/categories/${cat.slug}`
                      ? 'text-primary-900 border-b-2 border-primary-900'
                      : 'text-gray-600 hover:text-primary-900'
                  }`}>
                  {cat.name}
                </Link>
              ))}

              <Link href="/products?featured=true"
                className="flex-shrink-0 ml-auto flex items-center gap-1 px-3 h-10 text-xs font-extrabold text-orange-600 hover:text-orange-700 transition-colors whitespace-nowrap">
                <Zap className="w-3.5 h-3.5" /> Featured Deals
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ??????????? MOBILE DRAWER ??????????? */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[300] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-primary-900 to-green-700 text-white flex-shrink-0">
              <img
                src="https://image.cdn.shpy.in/386933/KJNLogo-1767688579320.jpeg?height=200&format=webp"
                alt="KJN Shop" className="h-8 w-auto object-contain brightness-0 invert"
              />
              <button onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User bar */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-900 to-green-600 flex items-center justify-center text-white font-extrabold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email || user?.phone}</p>
                    {coinBalance != null && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-extrabold text-amber-700">
                        <Coins className="w-3.5 h-3.5" />
                        {RS}{Number(coinBalance).toLocaleString('en-IN')} in coins
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Link href="/login" onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary-900 text-white font-bold text-sm rounded-xl">
                  <User className="w-4 h-4" /> Login / Sign Up
                </Link>
              )}
            </div>

            {/* Mobile search */}
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <form onSubmit={e => { e.preventDefault(); if (searchQuery.trim()) { router.push(`/products?search=${encodeURIComponent(searchQuery)}`); setDrawerOpen(false); setSearchQuery(''); } }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-900" />
                </div>
              </form>
            </div>

            {/* Scrollable links */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-2">
                <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 px-2 py-2">Navigate</p>
                {[
                  { label: 'Home',       href: '/',          icon: Home    },
                  { label: 'Products',   href: '/products',  icon: Package },
                  { label: 'Categories', href: '/categories', icon: Layers },
                  { label: 'Brands',     href: '/brands',    icon: Tag     },
                ].map(item => (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-colors mb-0.5 ${
                      isActive(item.href) ? 'bg-primary-50 text-primary-900' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                    <item.icon className={`w-4 h-4 ${isActive(item.href) ? 'text-primary-900' : 'text-gray-400'}`} />
                    {item.label}
                  </Link>
                ))}
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 px-2 py-2">Categories</p>
                  {categories.slice(0, 12).map(cat => (
                    <Link key={cat.id} href={`/categories/${cat.slug}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-primary-900 transition-colors mb-0.5">
                      {cat.image
                        ? <img src={cat.image} alt={cat.name} className="w-6 h-6 rounded-full object-cover" />
                        : <div className="w-6 h-6 rounded-full bg-gray-100" />
                      }
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* More links */}
              <div className="px-4 py-2 border-t border-gray-100">
                <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 px-2 py-2">More</p>
                {MORE_LINKS.filter((item) => item.label !== 'KJN Coins' || isAuthenticated).map(item => (
                  <Link key={item.href + item.label} href={item.href}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-primary-900 transition-colors mb-0.5">
                    <span className="flex items-center gap-3 min-w-0">
                      <item.icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.label === 'KJN Coins' && coinBalance != null && (
                      <span className="text-xs font-extrabold text-amber-700 flex-shrink-0">{RS}{Number(coinBalance).toLocaleString('en-IN')}</span>
                    )}
                  </Link>
                ))}
              </div>

              {/* Policy links */}
              <div className="px-4 py-2 border-t border-gray-100">
                <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 px-2 py-2">Policies</p>
                {POLICY_LINKS.map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-primary-900 transition-colors mb-0.5">
                    <item.icon className="w-4 h-4 text-gray-400" />
                    {item.label}
                  </Link>
                ))}
              </div>

              {/* Logout */}
              {isAuthenticated && (
                <div className="px-4 py-4 border-t border-gray-100">
                  <button onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <style>{`.hide-scroll::-webkit-scrollbar{display:none}.hide-scroll{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
}