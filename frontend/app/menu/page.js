'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import useAuthStore from '@/store/useAuthStore';

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coinBalance, setCoinBalance] = useState(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    api.get('/categories')
      .then((r) => setCategories(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCoinBalance(null);
      return;
    }
    api.get('/user/coins')
      .then((r) => setCoinBalance(parseInt(r.data?.data?.balance ?? 0, 10) || 0))
      .catch(() => setCoinBalance(null));
  }, [isAuthenticated]);

  const RS = String.fromCharCode(8377);

  const quickLinks = [
    { label: 'Home', href: '/' },
    { label: 'My Orders', href: '/orders' },
    { label: 'My Account', href: '/account' },
    ...(isAuthenticated
      ? [{ label: coinBalance != null ? `KJN Coins (${RS}${Number(coinBalance).toLocaleString('en-IN')})` : 'KJN Coins', href: '/cart' }]
      : []),
    { label: 'About Us', href: '/about-us' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact Us', href: '/contact-us' },
  ];

  const policyLinks = [
    { label: 'Terms & Conditions', href: '/tos' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Return & Refund Policy', href: '/refund-policy' },
    { label: 'Shipping Policy', href: '/shipping-policy' },
    { label: 'Payment Policy', href: '/payment-policy' },
  ];

  return (
    <div className="container" style={{ padding: '24px 16px' }}>
      {/* <h1 style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 24, marginBottom: 24 }}>Menu</h1> */}
      <section style={{ marginBottom: 32 }}>
        {/* <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Categories</h2> */}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
            {categories.map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.slug}`} style={{
                padding: '12px', background: 'white', borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)', textAlign: 'center',
                fontWeight: 600, color: '#374151', textDecoration: 'none',
              }}>
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} style={{
              padding: '10px 14px', borderRadius: 8, background: 'white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', color: '#374151',
              textDecoration: 'none', fontWeight: 600,
            }}>
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 8, paddingLeft: 2 }}>Policies</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {policyLinks.map((link) => (
            <Link key={link.href} href={link.href} style={{
              padding: '10px 14px', borderRadius: 8, background: 'white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', color: '#6B7280',
              textDecoration: 'none', fontWeight: 600, fontSize: 14,
            }}>
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
