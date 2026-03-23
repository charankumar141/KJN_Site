'use client';

import Link from 'next/link';
import { Phone, Mail, MapPin, Youtube, Twitter, Facebook, Instagram, Headphones, ExternalLink } from 'lucide-react';

export default function Footer() {
  const mapEmbedUrl =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL
      : null;
  const mapLinkUrl =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_LINK_URL
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_LINK_URL
      : 'https://www.google.com/maps/search/?api=1&query=KJN+Trading+Mulakalacheruvu';

  return (
    <footer className="bg-[#0F2412] text-gray-300 mt-auto">
      {/* Top strip with logo and social icons */}
      <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] py-5">
        <div className="container mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="https://image.cdn.shpy.in/386933/KJNLogo-1767688579320.jpeg?height=200&format=webp"
              alt="KJN Shop"
              className="h-11 w-auto object-contain"
            />
            <div>
              <span className="text-white font-heading font-extrabold text-xl">KJN</span>
              <p className="text-xs text-green-200/80">Farming & Electronics</p>
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { icon: Youtube, href: 'https://youtube.com/@shopatkjn', label: 'YouTube' },
              { icon: Twitter, href: 'https://x.com/_kjn__', label: 'Twitter' },
              { icon: Facebook, href: 'https://facebook.com/profile.php?id=61562979543949', label: 'Facebook' },
              { icon: Instagram, href: 'https://instagram.com/shopatkjn', label: 'Instagram' },
            ].map(({ icon: Icon, href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 hover:bg-white/25 rounded-lg flex items-center justify-center transition-colors"
                aria-label={label}
              >
                <Icon className="w-4 h-4 text-white" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main footer links */}
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Contact */}
          <div>
            <h4 className="text-white font-heading font-bold text-base mb-4">Contact Us</h4>
            <div className="space-y-3">
              <div className="flex gap-2.5">
                <MapPin className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs leading-relaxed">
                  SY No 444/3, Near Bharat Petroleum, Kadiri Road, Mulakalacheruvu, AP – 517390
                </span>
              </div>
              <a href="tel:9804599804" className="flex items-center gap-2.5 text-xs hover:text-green-400 transition-colors">
                <Phone className="w-4 h-4 text-green-400" /> 9804599804
              </a>
              <a href="mailto:info@shopatkjn.com" className="flex items-center gap-2.5 text-xs hover:text-green-400 transition-colors">
                <Mail className="w-4 h-4 text-green-400" /> info@shopatkjn.com
              </a>
              <a
                href={mapLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-green-300 hover:text-green-400 transition-colors mt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-heading font-bold text-base mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { label: 'Home', href: '/' },
                { label: 'My Orders', href: '/orders' },
                { label: 'My Account', href: '/account' },
                { label: 'About Us', href: '/about-us' },
                { label: 'Blog', href: '/blog' },
                { label: 'Contact Us', href: '/contact-us' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-xs hover:text-green-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h4 className="text-white font-heading font-bold text-base mb-4">Policies</h4>
            <ul className="space-y-2">
              {[
                { label: 'Payment Policy', href: '/payment-policy' },
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Return & Refund', href: '/refund-policy' },
                { label: 'Shipping Policy', href: '/shipping-policy' },
                { label: 'Terms & Conditions', href: '/tos' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-xs hover:text-green-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Technical Support */}
          <div>
            <h4 className="text-white font-heading font-bold text-base mb-4">Technical Support</h4>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Headphones className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-white">Naresh Kireedula</span>
                </div>
                <a href="mailto:nareshk@shopatkjn.com" className="flex items-center gap-2 text-xs hover:text-green-400 transition-colors ml-5">
                  <Mail className="w-3 h-3 text-green-400 flex-shrink-0" /> nareshk@shopatkjn.com
                </a>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Headphones className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-white">Charan Kumar</span>
                </div>
                <a href="mailto:charan@shopatkjn.com" className="flex items-center gap-2 text-xs hover:text-green-400 transition-colors ml-5">
                  <Mail className="w-3 h-3 text-green-400 flex-shrink-0" /> charan@shopatkjn.com
                </a>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-white font-heading font-bold text-base mb-4">Categories</h4>
            <ul className="space-y-2">
              {[
                { label: 'Farming Tools', href: '/categories/farm-equipments' },
                { label: 'Garden Tools', href: '/categories/garden-tools' },
                { label: 'Chaff Cutters', href: '/categories/chaff-cutters' },
                { label: 'Fans & Lighting', href: '/categories/fans-lighting' },
                { label: 'Irrigation Fittings', href: '/categories/irrigation-items' },
                { label: 'Motors & Fittings', href: '/categories/motors-fittings' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-xs hover:text-green-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Store map (optional embed from NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL) */}
      {mapEmbedUrl && (
        <div className="border-t border-white/10">
          <div className="container mx-auto px-4 py-6">
            <h4 className="text-white font-heading font-bold text-sm mb-3">Find us on the map</h4>
            <div className="rounded-xl overflow-hidden border border-white/10 aspect-[21/9] min-h-[200px] max-h-[320px] bg-black/20">
              <iframe
                title="KJN Shop location"
                src={mapEmbedUrl}
                className="w-full h-full min-h-[200px] border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="border-t border-white/10 py-4">
        <div className="container mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            © 2026 KJN Trading Company. All rights reserved. GSTIN: 37CMMPK7267H1ZG
          </p>
          <img
            src="https://image.cdn.shpy.in/static/web-store/payment-methods.png"
            alt="Accepted payment methods"
            className="h-6 opacity-70"
          />
        </div>
      </div>
    </footer>
  );
}