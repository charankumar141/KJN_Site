'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight, ChevronLeft, Truck, Shield, RefreshCw,
  Headphones, ArrowRight, Zap, Star, Package,
  Flame, Clock, MapPin, CheckCircle, Award, Users,
} from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import api from '@/lib/api';

const NO_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 24 24' fill='none' stroke='%23D1D5DB' stroke-width='1'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";

/* ── Animated counter hook ────────────────────────────────── */
function useCounter(target, duration = 1200, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const raw = String(target).replace(/[^0-9.]/g, '');
    const num = parseFloat(raw);
    if (!num) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(ease * num));
      if (p < 1) requestAnimationFrame(step);
      else setVal(num);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  const suffix = String(target).replace(/[0-9.,]/g, '');
  return val > 0 ? `${val.toLocaleString()}${suffix}` : `0${suffix}`;
}

const GLOBAL_CSS = `
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes brand-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  .hide-scroll::-webkit-scrollbar{display:none}
  .hide-scroll{-ms-overflow-style:none;scrollbar-width:none}
  .brand-track{display:flex;width:max-content;animation:brand-scroll 28s linear infinite}
  .brand-track:hover{animation-play-state:paused}
  .cat-img{transition:transform .3s ease}
  .cat-card:hover .cat-img{transform:scale(1.05)}
  @keyframes popup-in{from{opacity:0;transform:scale(.92) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes popup-out{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(.92) translateY(20px)}}
  .popup-in{animation:popup-in .35s cubic-bezier(.22,1,.36,1) both}
  .popup-out{animation:popup-out .25s ease-in both}
`;

/* ── Skeleton ─────────────────────────────────────────────── */
function Skel({ h = 20, w = '100%', r = 8 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite'
    }} />
  );
}

/* ── Section Heading ──────────────────────────────────────── */
function SectionHead({ label, tag, href }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-start gap-3">
        <div className="section-bar w-1.5 h-8 bg-primary-900 rounded-full mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="font-heading font-extrabold text-lg md:text-xl text-gray-900 leading-tight">{label}</h2>
          {tag && <p className="text-xs text-gray-400 mt-0.5 font-medium">{tag}</p>}
        </div>
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs font-bold text-primary-900 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
          View All <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

/* ── Product Skeleton ─────────────────────────────────────── */
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <Skel h={190} r={0} />
      <div className="p-3 space-y-2">
        <Skel h={10} w="55%" r={4} />
        <Skel h={13} r={4} />
        <Skel h={13} w="75%" r={4} />
        <Skel h={17} w="45%" r={4} />
      </div>
    </div>
  );
}

/* ── Flash Sale Countdown Timer ───────────────────────────── */
function FlashTimer() {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      const diff = end - now;
      setTime({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const pad = n => String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-1">
      {[['H', time.h], ['M', time.m], ['S', time.s]].map(([l, v], idx) => (
        <span key={l} className="flex items-center gap-1">
          <span className="bg-white/20 backdrop-blur-sm rounded-md px-2 py-1 text-white font-extrabold text-sm font-mono min-w-[30px] text-center">
            {pad(v)}
          </span>
          {idx < 2 && <span className="text-white/70 font-bold text-sm">:</span>}
        </span>
      ))}
    </div>
  );
}

/* ── Recently Viewed ──────────────────────────────────────── */
function RecentlyViewed() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const viewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      setProducts(viewed.slice(0, 6));
    }
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-8 md:py-10 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-8 bg-primary-900 rounded-full mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="font-heading font-extrabold text-lg md:text-xl text-gray-900 leading-tight">Continue Where You Left Off</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Your recently viewed products</p>
            </div>
          </div>
          <button
            onClick={() => { if (typeof window !== 'undefined') { localStorage.removeItem('recentlyViewed'); setProducts([]); } }}
            className="text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}

/* ── Happy Customers ──────────────────────────────────────── */
function LiveHappyCustomers() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    api.get('/orders/happy/customers?limit=8')
      .then((res) => setCustomers(res.data.data || []))
      .catch(() => { });
  }, []);

  if (!customers.length) return null;

  const avatarColors = ['#1B5E20','#E65100','#1565C0','#6A1B9A','#BF360C','#00695C','#283593','#558B2F'];

  return (
    <section className="py-8 md:py-12" style={{ background: 'linear-gradient(135deg,#f8fdf8 0%,#f0f9f0 100%)' }}>
      <div className="container mx-auto px-4">
        <SectionHead label="Happy Customers" tag="Real farmers, real deliveries" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {customers.map((c, i) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
                  style={{ background: avatarColors[i % avatarColors.length] }}
                >
                  {c.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{c.city}, {c.state}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] bg-green-50 text-green-700 font-semibold px-2 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Delivered
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stat Card with animated counter ─────────────────────── */
function StatCard({ val, label, Icon, color, idx }) {
  const [active, setActive] = useState(false);
  const [popped, setPopped] = useState(false);
  const ref = useRef(null);
  const displayVal = useCounter(val, 1200, active);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => { setActive(true); setPopped(true); }, idx * 120);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [idx]);

  return (
    <div
      ref={ref}
      className="section-reveal bg-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-5 text-center border border-white/10 hover:bg-white/15 transition-all hover:-translate-y-1 duration-300 cursor-default"
      style={{ transitionDelay: `${idx * 100}ms` }}
    >
      <div
        className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center transition-transform duration-300 hover:scale-110"
        style={{ background: color + '25' }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div
        className={`font-heading font-extrabold text-2xl md:text-3xl text-white mb-1 ${popped ? 'stat-pop' : ''}`}
        style={{ animationDelay: `${idx * 120}ms` }}
      >
        {displayVal}
      </div>
      <div className="text-xs text-white/55 font-semibold">{label}</div>
    </div>
  );
}

/* ── Popup Banner ────────────────────────────────────────── */
function PopupBanner({ banner, onClose }) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 260);
  };
  const bg = banner.bgColor || '#1B3C2B';
  const textColor = banner.textColor || '#ffffff';
  const overlayOpacity = banner.overlayOpacity ?? 0.65;
  const hasText = banner.title || banner.subtitle || banner.buttonText;
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6"
      style={{ background: `rgba(0,0,0,${overlayOpacity})`, backdropFilter: 'blur(6px)' }}
      onClick={close}
    >
      <div
        className={`relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl w-full ${closing ? 'popup-out' : 'popup-in'}`}
        style={{
          background: bg,
          maxWidth: 'min(680px, 95vw)',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 flex items-center justify-center transition-colors"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <span style={{ color: '#fff', fontSize: 22, lineHeight: 1, fontWeight: 300 }}>×</span>
        </button>

        {/* Banner image — fills width, natural aspect ratio, scrollable if very tall */}
        {banner.image && (
          <div className="w-full overflow-hidden flex-shrink-0" style={{ maxHeight: hasText ? '65dvh' : '92dvh' }}>
            <img
              src={banner.image}
              alt={banner.title || 'Offer'}
              className="w-full h-auto block"
              style={{ objectFit: 'cover', width: '100%' }}
            />
          </div>
        )}

        {/* Text content — only if any text fields present */}
        {hasText && (
          <div className="px-6 py-5 sm:px-8 sm:py-6 text-center flex-shrink-0">
            {banner.title && (
              <h2
                className="font-heading font-extrabold leading-tight mb-2"
                style={{ color: textColor, fontSize: 'clamp(18px,3.5vw,26px)' }}
              >
                {banner.title}
              </h2>
            )}
            {banner.subtitle && (
              <p
                className="mb-4 leading-relaxed"
                style={{ color: textColor, opacity: 0.85, fontSize: 'clamp(13px,1.8vw,15px)' }}
              >
                {banner.subtitle}
              </p>
            )}
            {banner.linkUrl && (
              <a
                href={banner.linkUrl}
                onClick={close}
                className="inline-flex items-center gap-2 font-extrabold rounded-full transition-all hover:-translate-y-0.5 hover:shadow-xl"
                style={{
                  background: textColor,
                  color: bg,
                  padding: 'clamp(10px,1.5vw,14px) clamp(22px,4vw,36px)',
                  fontSize: 'clamp(13px,1.6vw,15px)',
                }}
              >
                {banner.buttonText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main HomePage ────────────────────────────────────────── */
export default function HomePage() {
  const [banners, setBanners] = useState([]);
  const [popupBanner, setPopupBanner] = useState(null);
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [newest, setNewest] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const [flashSaleActive, setFlashSaleActive] = useState(false);
  const [activeTab, setActiveTab] = useState('featured');
  const [slideKey, setSlideKey] = useState(0);
  const [statsActive, setStatsActive] = useState(false);
  const timerRef = useRef(null);

  const allSlides = [
    { type: flashSaleActive ? 'flashSale' : 'static' },
    ...banners.map(b => ({ type: 'banner', ...b })),
  ];

  useEffect(() => {
    (async () => {
      try {
        const [catR, featR, newR, bannerR, brandR, flashR] = await Promise.all([
          api.get('/categories?limit=20'),
          api.get('/products?featured=true&limit=10'),
          api.get('/products?sort=newest&limit=10'),
          api.get('/banners'),
          api.get('/brands?limit=20'),
          api.get('/flash-sales/active').catch(() => ({ data: { data: [] } })),
        ]);
        setCategories(catR.data.data || []);
        setFeatured(featR.data.data || []);
        setNewest(newR.data.data || []);
        const allBanners = (bannerR.data.data || []).filter(b => b.isActive && (b.image || b.imageUrl));
        setBanners(allBanners.filter(b => b.position !== 'popup'));
        setBrands(brandR.data.data || []);
        setFlashSaleActive((flashR.data.data || []).length > 0);
        // Show popup banner with optional delay
        const popup = allBanners.find(b => b.position === 'popup');
        if (popup) {
          const delay = (popup.popupDelay ?? 1) * 1000;
          setTimeout(() => setPopupBanner(popup), delay);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (allSlides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setTimeout(() => {
        setSlide(p => (p + 1) % allSlides.length);
        setSlideKey(k => k + 1);
      }, 420);
    }, 5500);
    return () => clearInterval(timerRef.current);
  }, [allSlides.length]);

  const goToSlide = (idx) => {
    setTimeout(() => {
      setSlide(idx);
      setSlideKey(k => k + 1);
    }, 420);
  };
  const prevSlide = () => { clearInterval(timerRef.current); goToSlide((slide - 1 + allSlides.length) % allSlides.length); };
  const nextSlide = () => { clearInterval(timerRef.current); goToSlide((slide + 1) % allSlides.length); };

  const tabProducts = activeTab === 'featured' ? featured : newest;

  return (
    <div className="bg-gray-50 min-h-screen">
      <style>{GLOBAL_CSS}</style>

      {/* ── HERO CAROUSEL ─────────────────────────────────── */}
      <section className="relative bg-primary-900">
        {loading ? (
          <Skel h={420} r={0} />
        ) : (
          <div className="relative overflow-hidden" style={{ height: 'clamp(260px, 52vw, 520px)' }}>
            <div
              className="flex h-full transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${slide * 100}%)`, willChange: 'transform' }}
            >
              {allSlides.map((s, i) =>
                s.type === 'flashSale' ? (
                  <div key="flashSale" className="flex-shrink-0 w-full h-full relative" style={{ background: 'linear-gradient(135deg,#7B1515 0%,#C62828 45%,#E64A19 100%)' }}>
                    {/* Strobe flash */}
                    <div className="strobe-layer" />
                    {/* Full-slide FX: spotlight beams + sparkles + embers */}
                    {/* <FlashSaleFX /> */}
                    {/* Drifting glowing orbs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
                      <div className="orb-a absolute -top-24 -right-24 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,109,0,.22) 0%,transparent 70%)' }} />
                      <div className="orb-b absolute -bottom-16 left-1/4 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,171,0,.14) 0%,transparent 70%)' }} />
                      <div className="orb-a absolute top-1/3 right-1/3 w-48 h-48 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.05) 0%,transparent 70%)', animationDelay: '-4s' }} />
                    </div>
                    <div className="container mx-auto px-4 h-full flex items-center relative" style={{ zIndex: 5 }}>
                      <div key={slideKey} className="text-white max-w-lg">
                        {/* LIVE badge */}
                        <div className="hw1 inline-flex items-center gap-2 mb-4">
                          <span className="inline-flex items-center gap-2 bg-red-600/90 border border-red-400/50 text-white text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg" style={{ boxShadow: '0 0 16px rgba(239,68,68,.6)' }}>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-200" />
                            </span>
                            LIVE
                          </span>
                          <span className="inline-flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-400/30 text-yellow-200 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                            <Flame className="w-3.5 h-3.5" /> Flash Sale · Ends in <FlashTimer />
                          </span>
                        </div>
                        <h1 className="hw2 font-heading font-extrabold text-white leading-tight mb-3" style={{ fontSize: 'clamp(24px,5vw,54px)', textShadow: '0 2px 20px rgba(0,0,0,.4)' }}>
                          Massive Discounts<br />Only for Today!
                        </h1>
                        <p className="hw3 text-white/80 mb-6 text-sm md:text-base max-w-md">
                          Best deals on sprayers, motors, tools and more — before they&apos;re gone.
                        </p>
                        <div className="hw4 flex flex-wrap gap-3">
                          <Link href="/collections/flash-sale" className="hero-btn-primary inline-flex items-center gap-2 bg-yellow-400 text-yellow-900 font-extrabold px-6 py-3 rounded-full text-sm shadow-xl hover:bg-yellow-300" style={{ boxShadow: '0 0 24px rgba(251,191,36,.6)' }}>
                            Shop Flash Sale <ArrowRight className="w-4 h-4" />
                          </Link>
                          <Link href="/products" className="inline-flex items-center gap-2 border-2 border-white/60 text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-white/10 transition-colors">
                            All Products
                          </Link>
                        </div>
                      </div>
                    </div>
                    {/* Fire with neon ring glow */}
                    <div
                      className="absolute right-8 top-1/2 hidden md:flex flex-col items-center pointer-events-none select-none"
                      style={{ transform: 'translateY(-50%)', zIndex: 5 }}
                    >
                      {/* Neon ring */}
                      <div style={{
                        position: 'absolute', width: 120, height: 120,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,171,0,.35)',
                        animation: 'neon-ring 2s ease-in-out infinite',
                      }} />
                      <div style={{
                        fontSize: '7.5rem', lineHeight: 1,
                        animation: 'fire-dance 1.8s ease-in-out infinite',
                      }}>🔥</div>
                    </div>
                  </div>
                ) : s.type === 'static' ? (
                  <div key="static" className="flex-shrink-0 w-full h-full relative" style={{ background: 'linear-gradient(135deg,#1A4D20 0%,#2E7D32 55%,#43A047 100%)' }}>
                    {/* Drifting glowing orbs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
                      <div className="orb-a absolute -top-24 -right-24 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.08) 0%,transparent 70%)' }} />
                      <div className="orb-b absolute -bottom-16 -left-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%)' }} />
                      <div className="orb-a absolute top-1/3 left-1/3 w-48 h-48 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.04) 0%,transparent 70%)', animationDelay: '-6s' }} />
                      {/* Floating wheat stalks */}
                      <div className="absolute bottom-10 right-52 text-5xl opacity-20" style={{ animation: 'float-bob 5s 1s ease-in-out infinite' }}>🌾</div>
                      <div className="absolute top-10 right-72 text-3xl opacity-15" style={{ animation: 'float-bob 3.8s .4s ease-in-out infinite' }}>🌱</div>
                    </div>
                    <div className="container mx-auto px-4 h-full flex items-center relative" style={{ zIndex: 2 }}>
                      <div key={slideKey} className="text-white max-w-lg">
                        <div className="hw1 inline-block bg-white/15 border border-white/20 text-white/90 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
                          🌾 Premium Agricultural Equipment
                        </div>
                        <h1 className="hw2 font-heading font-extrabold text-white leading-tight mb-3" style={{ fontSize: 'clamp(24px,5vw,54px)', textShadow: '0 2px 16px rgba(0,0,0,.3)' }}>
                          Trusted by Farmers<br />Across Andhra Pradesh
                        </h1>
                        <p className="hw3 text-white/75 mb-6 text-sm md:text-base max-w-md">
                          Sprayers, seeders, motors, tools and more — at the best prices, delivered to your door.
                        </p>
                        <div className="hw4 flex flex-wrap gap-3">
                          <Link href="/products" className="hero-btn-primary inline-flex items-center gap-2 bg-white text-primary-900 font-extrabold px-6 py-3 rounded-full text-sm shadow-lg hover:bg-primary-50">
                            Shop Now <ArrowRight className="w-4 h-4" />
                          </Link>
                          <Link href="/categories" className="inline-flex items-center gap-2 border-2 border-white/60 text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-white/10 transition-colors">
                            Browse Categories
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="flex-shrink-0 w-full h-full relative cursor-pointer overflow-hidden"
                    onClick={() => s.linkUrl && s.linkUrl !== '#' && window.location.assign(s.linkUrl)}
                  >
                    {/* Ken Burns zoom+pan on the image */}
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={s.image || s.imageUrl}
                        alt={s.title || 'Banner'}
                        className={`w-full h-full object-cover ${i % 2 === 0 ? 'ken-a' : 'ken-b'}`}
                        style={{ transformOrigin: 'center center', willChange: 'transform' }}
                        onError={e => { e.target.onerror = null; e.target.src = NO_IMG; }}
                      />
                    </div>
                    {/* Animated gradient overlay with hue shift */}
                    <div
                      className="absolute inset-0 banner-overlay-anim"
                      style={{ background: 'linear-gradient(120deg,rgba(0,0,0,.58) 0%,rgba(0,0,0,.28) 50%,rgba(0,0,0,.08) 100%)' }}
                    />
                    {/* Shimmer light sweep */}
                    <div className="absolute inset-0 banner-sweep" />
                    {/* Floating depth orbs */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="orb-a absolute -top-16 right-1/3 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%)' }} />
                      <div className="orb-b absolute bottom-0 left-1/4 w-48 h-48 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.04) 0%,transparent 70%)' }} />
                    </div>
                    {/* Text content with cinematic reveal */}
                    {s.title && (
                      <div className="absolute inset-0 flex items-center px-6 md:px-16" style={{ zIndex: 4 }}>
                        <div key={slideKey} className="text-white max-w-lg">
                          <p className="clip-reveal-1 text-[11px] font-bold uppercase tracking-widest mb-2" style={{ opacity: .75 }}>Special Offer</p>
                          <h2 className="clip-reveal-2 font-heading font-extrabold text-2xl md:text-5xl leading-tight mb-4" style={{ textShadow: '0 2px 24px rgba(0,0,0,.5)' }}>{s.title}</h2>
                          {s.linkUrl && (
                            <div className="clip-reveal-3">
                              <span
                                onClick={e => { e.stopPropagation(); window.location.assign(s.linkUrl); }}
                                className="inline-flex items-center gap-2 bg-white text-primary-900 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-primary-50 transition-all cursor-pointer shadow-xl hover:-translate-y-0.5"
                                style={{ boxShadow: '0 8px 28px rgba(0,0,0,.3)' }}
                              >
                                Shop Now <ArrowRight className="w-4 h-4" />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── TRUST BADGES ──────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { icon: Truck, title: 'Free Delivery', sub: 'Orders above ₹500', color: '#1B5E20' },
              { icon: Shield, title: 'Genuine Products', sub: '100% authentic brands', color: '#1565C0' },
              { icon: RefreshCw, title: 'Easy Returns', sub: '7-day return policy', color: '#E65100' },
              { icon: Headphones, title: '24/7 Support', sub: 'WhatsApp & Phone', color: '#6A1B9A' },
            ].map(({ icon: Icon, title, sub, color }, idx) => (
              <div
                key={title}
                className={`flex items-center gap-3 px-4 py-4 md:py-5 trust-badge ${idx < 3 ? 'border-b md:border-b-0 md:border-r border-gray-100' : ''} ${idx === 1 ? 'border-r border-gray-100 md:border-r-0 md:border-r' : ''}`}
                ref={el => {
                  if (!el) return;
                  const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } }, { threshold: 0.2 });
                  obs.observe(el);
                }}
                style={{ transitionDelay: `${idx * 80}ms` }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 hover:scale-110" style={{ background: color + '15' }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 leading-tight">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FLASH SALE BANNER (when active) ───────────────── */}
      {flashSaleActive && !loading && (
        <section style={{ background: 'linear-gradient(90deg,#B71C1C,#E53935,#FF6F00)' }}>
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Flame className="w-5 h-5 text-yellow-300 flex-shrink-0 animate-pulse" />
                <span className="text-white font-bold text-sm truncate">Flash Sale is LIVE — Limited stock!</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <FlashTimer />
                <Link href="/collections/flash-sale" className="bg-yellow-400 text-yellow-900 font-extrabold text-xs px-4 py-1.5 rounded-full hover:bg-yellow-300 transition-colors whitespace-nowrap">
                  Shop Now
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CATEGORIES ────────────────────────────────────── */}
      <section className="py-7 md:py-10 bg-white">
        <div className="container mx-auto px-4">
          <SectionHead label="Shop by Category" tag="Find what you need fast" href="/categories" />
          {loading ? (
            <div className="flex gap-3 overflow-x-auto hide-scroll pb-1">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 w-20">
                  <Skel h={72} w={72} r={16} />
                  <Skel h={11} w={56} r={4} />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto hide-scroll">
              <div className="flex gap-3 pb-1 min-w-max md:grid md:grid-cols-8 md:gap-3 md:min-w-0">
                {categories.slice(0, 16).map(cat => (
                  <Link key={cat.id} href={`/categories/${cat.slug}`} className="cat-card flex flex-col items-center gap-2 group w-20 md:w-auto">
                    <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 group-hover:border-primary-400 group-hover:shadow-md transition-all flex items-center justify-center flex-shrink-0">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="cat-img w-full h-full object-cover" onError={e => { e.target.onerror = null; e.target.src = NO_IMG; }} />
                      ) : (
                        <Package className="w-7 h-7 text-gray-300" />
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight line-clamp-2 group-hover:text-primary-900 transition-colors">
                      {cat.name}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── PROMO CARDS ───────────────────────────────────── */}
      <section className="py-4 bg-gray-50">
        <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1 */}
          {flashSaleActive ? (
            <Link href="/collections/flash-sale" className="rounded-2xl relative block group promo-shine" style={{ background: 'linear-gradient(135deg,#7B1515,#C62828,#E64A19)', minHeight: 150, borderRadius: 16 }}>
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute right-10 -top-6 w-24 h-24 rounded-full bg-yellow-400/15" />
              </div>
              <div className="p-5 relative z-10 h-full flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-300 mb-1 flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Flash Sale Live
                  </p>
                  <h3 className="font-heading font-extrabold text-xl text-white leading-tight">Grab Limited<br />Time Deals!</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold px-4 py-2 rounded-full self-start mt-3 group-hover:bg-yellow-300 transition-colors">
                  Shop Now <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ) : (
            <Link href="/products" className="rounded-2xl relative block group promo-shine" style={{ background: 'linear-gradient(135deg,#1A4D20,#2E7D32,#43A047)', minHeight: 150, borderRadius: 16 }}>
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute right-10 -top-6 w-24 h-24 rounded-full bg-white/10" />
              </div>
              <div className="p-5 relative z-10 h-full flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">Up to 30% off</p>
                  <h3 className="font-heading font-extrabold text-xl text-white leading-tight">Farm Equipment<br />Super Sale</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 bg-white text-primary-900 text-xs font-bold px-4 py-2 rounded-full self-start mt-3 group-hover:bg-primary-50 transition-colors">
                  Shop Now <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          )}
          {/* Card 2 */}
          <Link href="/products" className="rounded-2xl relative block group promo-shine" style={{ background: 'linear-gradient(135deg,#B45309,#D97706,#F59E0B)', minHeight: 150, borderRadius: 16 }}>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute right-10 -top-6 w-24 h-24 rounded-full bg-white/10" />
            </div>
            <div className="p-5 relative z-10 h-full flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">Prepaid Discount</p>
                <h3 className="font-heading font-extrabold text-xl text-white leading-tight">Extra 1.5% Off<br />on All Prepaid Orders</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-white text-amber-700 text-xs font-bold px-4 py-2 rounded-full self-start mt-3 group-hover:bg-amber-50 transition-colors">
                Grab Deal <Zap className="w-3 h-3" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── FEATURED + NEW ARRIVALS (Tabbed) ─────────────── */}
      {(loading || featured.length > 0 || newest.length > 0) && (
        <section className="py-7 md:py-10 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {[
                  { key: 'featured', label: '⭐ Featured', href: '/products?featured=true' },
                  { key: 'newest', label: '🆕 New Arrivals', href: '/products?sort=newest' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Link href={activeTab === 'featured' ? '/products?featured=true' : '/products?sort=newest'} className="flex items-center gap-1 text-xs font-bold text-primary-900 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-full transition-colors">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {loading
                ? Array(5).fill(0).map((_, i) => <ProductSkeleton key={i} />)
                : tabProducts.map(p => <ProductCard key={p.id} product={p} />)
              }
            </div>
          </div>
        </section>
      )}

      {/* ── BRANDS MARQUEE ────────────────────────────────── */}
      {(loading || brands.length > 0) && (
        <section className="py-7 bg-gray-50 overflow-hidden">
          <div className="container mx-auto px-4 mb-5">
            <SectionHead label="Top Brands" tag="Trusted names in agriculture" href="/brands" />
          </div>
          {loading ? (
            <div className="flex gap-4 px-4 overflow-x-auto hide-scroll">
              {Array(8).fill(0).map((_, i) => <Skel key={i} h={64} w={112} r={12} />)}
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right,#f9fafb,transparent)' }} />
              <div className="absolute right-0 top-0 bottom-0 w-10 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left,#f9fafb,transparent)' }} />
              <div className="brand-track gap-4 px-4">
                {[...brands, ...brands].map((b, i) => (
                  <Link key={i} href={`/brands/${b.slug}`}
                    className="flex-shrink-0 w-28 h-14 bg-white rounded-xl border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all flex items-center justify-center p-3">
                    {b.logo
                      ? <img src={b.logo} alt={b.name} className="max-w-full max-h-full object-contain" onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                      : <span className="text-xs font-bold text-gray-600 text-center leading-tight">{b.name}</span>
                    }
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── WHY CHOOSE KJN ────────────────────────────────── */}
      <section
        className="py-10 md:py-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0D2B10 0%,#1B5E20 60%,#2E7D32 100%)' }}
        ref={el => {
          if (!el) return;
          const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
              el.querySelectorAll('.section-reveal').forEach((c, i) => {
                setTimeout(() => c.classList.add('visible'), i * 100);
              });
              obs.disconnect();
            }
          }, { threshold: 0.1 });
          obs.observe(el);
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-8">
            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-white mb-2">Why Farmers Choose KJN</h2>
            <p className="text-white/60 text-sm">Serving the farming community since day one</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { val: '1000+', label: 'Products', icon: Package, color: '#4ADE80' },
              { val: '50+', label: 'Brands', icon: Award, color: '#FACC15' },
              { val: '10K+', label: 'Customers', icon: Users, color: '#60A5FA' },
              { val: '4.8★', label: 'Avg Rating', icon: Star, color: '#FB923C' },
            ].map(({ val, label, icon: Icon, color }, idx) => (
              <StatCard key={label} val={val} label={label} Icon={Icon} color={color} idx={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HAPPY CUSTOMERS ───────────────────────────────── */}
      <LiveHappyCustomers />

      {/* ── RECENTLY VIEWED ───────────────────────────────── */}
      <RecentlyViewed />

      {/* ── POPUP BANNER ──────────────────────────────────── */}
      {popupBanner && <PopupBanner banner={popupBanner} onClose={() => setPopupBanner(null)} />}

      {/* ── APP CTA ───────────────────────────────────────── */}
      <section className="py-8 md:py-10 bg-white">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg,#0D2B10 0%,#1B5E20 100%)' }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
              <div className="absolute -bottom-8 left-1/3 w-36 h-36 rounded-full bg-white/5" />
            </div>
            <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 text-center md:text-left">
                <span className="inline-block text-xs font-bold text-green-300 uppercase tracking-widest mb-3">📱 KJN Mobile App</span>
                <h3 className="font-heading font-extrabold text-2xl md:text-3xl text-white mb-2 leading-tight">Shop Smarter<br />on the Go</h3>
                <p className="text-white/65 text-sm mb-6 max-w-sm mx-auto md:mx-0">Exclusive app-only deals, real-time order tracking & instant support.</p>
                <a href="https://play.google.com/store/apps/details?id=app.shoopy.kjn_trading_company" target="_blank" rel="noopener noreferrer" className="inline-block">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" className="h-11" />
                </a>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                {[
                  { val: '1000+', label: 'Products', icon: '📦' },
                  { val: '10K+', label: 'Downloads', icon: '⬇️' },
                  { val: '4.8★', label: 'Rating', icon: '⭐' },
                ].map(({ val, label, icon }) => (
                  <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 px-5 py-4 text-center min-w-[80px]">
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className="font-heading font-extrabold text-lg text-white">{val}</div>
                    <div className="text-[11px] text-white/55 font-semibold mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}