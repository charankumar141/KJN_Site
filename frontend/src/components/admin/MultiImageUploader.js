'use client';
// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/components/admin/MultiImageUploader.js
//
// Used in: Admin Products page for product gallery (up to 8 images)
// Supports: drag-and-drop, multiple files at once, reorder, set default
//
// Usage:
//   <MultiImageUploader
//     images={form.images}
//     onChange={(images) => setForm({...form, images})}
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Star, Loader, AlertCircle, GripVertical } from 'lucide-react';
import api from '@/lib/api';

export default function MultiImageUploader({ images = [], onChange, maxImages = 6 }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  // ── Upload files ───────────────────────────────────────────
  const handleFiles = useCallback(async (files) => {
    const fileArr = Array.from(files);
    if (images.length + fileArr.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalid = fileArr.find(f => !allowed.includes(f.type));
    if (invalid) { setError('Only JPEG, PNG, WebP images allowed'); return; }

    const oversized = fileArr.find(f => f.size > 10 * 1024 * 1024);
    if (oversized) { setError(`${oversized.name} is too large (max 10 MB)`); return; }

    setError('');
    setUploading(true);

    try {
      // Show local previews immediately
      const previews = fileArr.map((f, i) => ({
        id: `temp-${Date.now()}-${i}`,
        url: URL.createObjectURL(f),
        isDefault: images.length === 0 && i === 0,
        isUploading: true,
      }));

      const newImages = [...images, ...previews];
      onChange(newImages);

      // Upload all at once
      const formData = new FormData();
      fileArr.forEach(f => formData.append('images', f));

      const res = await api.post('/upload/product-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploaded = res.data.data; // backend returns { image, thumbnail } per file (or legacy { url })

      // Replace temp previews with real URLs
      const finalImages = newImages.map(img => {
        if (!img.isUploading) return img;
        const tempIdx = previews.findIndex(p => p.id === img.id);
        if (tempIdx === -1 || !uploaded[tempIdx]) return img;
        URL.revokeObjectURL(img.url);
        const serverUrl = uploaded[tempIdx].url || uploaded[tempIdx].image;
        return { ...img, url: serverUrl, isUploading: false, id: `img-${Date.now()}-${tempIdx}` };
      });

      onChange(finalImages);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
      // Remove temp previews on error
      onChange(images);
    } finally {
      setUploading(false);
      setUploadProgress({});
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [images, onChange, maxImages]);

  const handleRemove = (id) => {
    const updated = images.filter(img => img.id !== id);
    // If removed was default, make first image default
    if (updated.length > 0 && !updated.find(i => i.isDefault)) {
      updated[0].isDefault = true;
    }
    onChange(updated);
  };

  const handleSetDefault = (id) => {
    onChange(images.map(img => ({ ...img, isDefault: img.id === id })));
  };

  const canAddMore = images.length < maxImages && !uploading;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
          Product Images <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(up to {maxImages})</span>
        </label>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{images.length}/{maxImages}</span>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
          {images.map((img) => (
            <div key={img.id} style={{
              position: 'relative', borderRadius: 12, overflow: 'hidden',
              border: img.isDefault ? '2px solid #1B5E20' : '2px solid #E5E7EB',
              aspectRatio: '1', background: '#F3F4F6',
            }}>
              <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

              {/* Loading overlay */}
              {img.isUploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader style={{ width: 24, color: 'white', animation: 'spin 1s linear infinite' }} />
                </div>
              )}

              {/* Default badge */}
              {img.isDefault && !img.isUploading && (
                <div style={{ position: 'absolute', top: 5, left: 5, background: '#1B5E20', color: 'white', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>
                  DEFAULT
                </div>
              )}

              {/* Action buttons */}
              {!img.isUploading && (
                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Remove */}
                  <button type="button" onClick={() => handleRemove(img.id)}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(220,38,38,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X style={{ width: 12, color: 'white' }} />
                  </button>
                  {/* Set default */}
                  {!img.isDefault && (
                    <button type="button" onClick={() => handleSetDefault(img.id)}
                      title="Set as main image"
                      style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Star style={{ width: 12, color: '#F59E0B' }} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — only show if can add more */}
      {canAddMore && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#1B5E20' : '#D1D5DB'}`,
            borderRadius: 12,
            padding: '20px',
            background: dragOver ? '#F0FDF4' : '#FAFAFA',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s',
          }}
        >
          <Upload style={{ width: 24, color: '#9CA3AF', marginBottom: 8 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 2px' }}>
            {uploading ? 'Uploading...' : dragOver ? 'Drop images here' : 'Click to upload or drag & drop'}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
            Upload multiple at once · JPEG, PNG, WebP · Max 10 MB each
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <AlertCircle style={{ width: 14, color: '#DC2626', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#DC2626' }}>{error}</span>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
        ⭐ Click the star icon on any image to set it as the main display image
      </p>

      <input ref={inputRef} type="file" accept="image/*" multiple
        onChange={e => handleFiles(e.target.files)} style={{ display: 'none' }} />
    </div>
  );
}