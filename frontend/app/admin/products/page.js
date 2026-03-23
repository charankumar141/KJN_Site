'use client';
import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Eye, EyeOff, X, Package, Zap, Sparkles, Copy, Download, Upload, FileDown } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import MultiImageUploader from '@/components/admin/MultiImageUploader';

const emptyForm = {
  name: '', slug: '', sku: '', mrp: '', sellingPrice: '', gstType: 'IGST', gstPercent: '18', cessPercent: '0',
  stockQuantity: '', categoryId: '', brandId: '', images: [],
  shortDescription: '', description: '', isActive: true, isFeatured: false,
  specifications: [],
  allowedPaymentMethods: ['COD', 'ONLINE'],
  codAdvancePercent: '0',
  googleMerchantCentre: false,
  metaTitle: '', metaDescription: '',
};

function parseSpecs(specs) {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return [];
  return Object.entries(specs).map(([key, value]) => ({ key, value: String(value) }));
}

function serializeSpecs(specsArr) {
  const obj = {};
  for (const { key, value } of specsArr) {
    if (key.trim()) obj[key.trim()] = value;
  }
  return Object.keys(obj).length > 0 ? obj : null;
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [dupId, setDupId] = useState(null);
  const csvInputRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/products?limit=100');
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Fetch products error:', err);
      toast.error('Failed to load products');
    }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch { }
  };

  const fetchBrands = async () => {
    try {
      const res = await api.get('/brands');
      setBrands(res.data.data || []);
    } catch { }
  };

  const handleToggle = async (product) => {
    const next = !product.isActive;
    // Optimistic update
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: next } : p));
    try {
      await api.put(`/products/${product.id}`, { isActive: next });
      toast.success(next ? 'Product is now visible' : 'Product hidden from store');
    } catch {
      // Revert on error
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: !next } : p));
      toast.error('Failed to update visibility');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.mrp || !form.sellingPrice) {
      toast.error('Name, MRP and Selling Price are required');
      return;
    }
    if (!form.categoryId) {
      toast.error('Please select a category');
      return;
    }
    if ((form.images || []).length > 6) {
      toast.error('Maximum 6 images allowed');
      return;
    }
    setSaving(true);
    try {
      const { specifications: specsArr, images: formImages, ...formRest } = form;
      const imagesPayload = (formImages || []).map((img) => {
        if (img && typeof img === 'object') return img.url || img.image || '';
        return img;
      }).filter(Boolean);
      const mainImage = imagesPayload[0] || null;
      const payload = {
        ...formRest,
        image: mainImage, // keep compatibility; backend will also set main image from first gallery image
        mrp: parseFloat(form.mrp),
        sellingPrice: parseFloat(form.sellingPrice),
        gstType: form.gstType || 'IGST',
        gstPercent: parseFloat(form.gstPercent || 18),
        cessPercent: parseFloat(form.cessPercent || 0),
        stockQuantity: parseInt(form.stockQuantity || 0),
        categoryId: form.categoryId || null,
        brandId: form.brandId || null,
        specifications: serializeSpecs(specsArr),
        allowedPaymentMethods: Array.isArray(form.allowedPaymentMethods) ? form.allowedPaymentMethods : ['COD', 'ONLINE'],
        codAdvancePercent: parseFloat(form.codAdvancePercent || 0),
        googleMerchantCentre: !!form.googleMerchantCentre,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        images: imagesPayload,
      };

      if (editId) {
        await api.put(`/products/${editId}`, payload);
        toast.success('Product updated!');
      } else {
        await api.post('/products', payload);
        toast.success('Product created!');
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      fetchProducts();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally { setSaving(false); }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    setCsvBusy(true);
    try {
      const res = await api.get('/admin/products/export/csv', { responseType: 'blob' });
      downloadBlob(res.data, `products-export-${Date.now()}.csv`);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error('Export failed');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setCsvBusy(true);
    try {
      const res = await api.get('/admin/products/csv-template', { responseType: 'blob' });
      downloadBlob(res.data, 'products-import-template.csv');
      toast.success('Template downloaded');
    } catch (e) {
      toast.error('Template download failed');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleCsvFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsvBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/admin/products/import/csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { created, updated, errors } = res.data.data || {};
      toast.success(res.data.message || 'Import done');
      if (errors?.length) {
        toast.error(`${errors.length} row(s) had issues — check server response`);
        console.warn('CSV import errors', errors);
      }
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleDuplicate = async (product) => {
    setDupId(product.id);
    try {
      await api.post(`/products/${product.id}/duplicate`);
      toast.success('Product duplicated — edit the copy to adjust name/slug');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Duplicate failed');
    } finally {
      setDupId(null);
    }
  };

  const handleGenerateDescription = async () => {
    if (!form.name) {
      toast.error('Enter product name first');
      return;
    }
    try {
      const res = await api.post('/products/generate-description', {
        name: form.name,
        shortDescription: form.shortDescription,
        specifications: serializeSpecs(form.specifications),
        categoryName: categories.find((c) => c.id === form.categoryId)?.name,
        brandName: brands.find((b) => b.id === form.brandId)?.name,
      });
      const desc = res.data?.data?.description;
      if (desc) setForm((f) => ({ ...f, description: desc }));
      toast.success('Description generated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate description');
    }
  };

  const handleEdit = async (p) => {
    setForm({
      name: p.name || '', slug: p.slug || '', sku: p.sku || '',
      mrp: p.mrp || '', sellingPrice: p.sellingPrice || '',
      gstType: p.gstType || 'IGST',
      gstPercent: p.gstPercent != null ? String(p.gstPercent) : '18',
      cessPercent: p.cessPercent != null ? String(p.cessPercent) : '0',
      stockQuantity: p.stockQuantity ?? '',
      categoryId: p.categoryId || '', brandId: p.brandId || '',
      images: [],
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      isActive: p.isActive !== false, isFeatured: p.isFeatured || false,
      specifications: parseSpecs(p.specifications),
      allowedPaymentMethods: Array.isArray(p.allowedPaymentMethods) ? p.allowedPaymentMethods : ['COD', 'ONLINE'],
      codAdvancePercent: p.codAdvancePercent != null ? String(p.codAdvancePercent) : '0',
      googleMerchantCentre: !!p.googleMerchantCentre,
      metaTitle: p.metaTitle || '', metaDescription: p.metaDescription || '',
    });
    setEditId(p.id);
    setShowForm(true);
    try {
      const res = await api.get(`/products/${p.slug}`);
      const data = res.data?.data;
      if (data?.images?.length) {
        setForm((f) => ({
          ...f,
          images: data.images.map((img) => ({
            id: img.id,
            url: img.image,
            isDefault: !!img.isPrimary,
          })),
        }));
      }
    } catch (_) { /* optional */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-gray-900">Products</h1>
          <p className="text-sm text-gray-600 mt-1">{products.length} total products</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvFile}
          />
          <button
            type="button"
            disabled={csvBusy}
            onClick={() => csvInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-800 rounded-xl font-semibold text-sm hover:border-primary-800 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            type="button"
            disabled={csvBusy}
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-800 rounded-xl font-semibold text-sm hover:border-primary-800 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Template
          </button>
          <button
            type="button"
            disabled={csvBusy}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-800 rounded-xl font-semibold text-sm hover:border-primary-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-900 transition-colors shadow-primary"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
          />
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-200">
              <div className="h-48 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-xl animate-pulse mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-heading font-bold text-lg text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first product</p>
          <button
            onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-900 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-300 group"
            >
              {/* Product Image */}
              <div className="relative h-56 bg-gray-50 overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="%23D1D5DB" stroke-width="1.5"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"%3E%3C/rect%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"%3E%3C/circle%3E%3Cpolyline points="21 15 16 10 5 21"%3E%3C/polyline%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                )}

                {/* Stock Badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.stockQuantity > 10
                      ? 'bg-emerald-500 text-white'
                      : product.stockQuantity > 0
                        ? 'bg-amber-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}>
                    {product.stockQuantity} in stock
                  </span>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.isActive
                      ? 'bg-primary text-white'
                      : 'bg-gray-500 text-white'
                    }`}>
                    {product.isActive ? 'Active' : 'Hidden'}
                  </span>
                  {product.isFlashSale && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center gap-1">
                      <Zap className="w-3 h-3" /> FLASH
                    </span>
                  )}
                </div>

                {/* Quick Actions - Show on Hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-3 bg-white rounded-full hover:bg-blue-50 transition-colors"
                    title="Edit product"
                  >
                    <Edit2 className="w-5 h-5 text-blue-600" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(product)}
                    disabled={dupId === product.id}
                    className="p-3 bg-white rounded-full hover:bg-purple-50 transition-colors disabled:opacity-50"
                    title="Duplicate product"
                  >
                    <Copy className="w-5 h-5 text-purple-600" />
                  </button>
                  <button
                    onClick={() => handleToggle(product)}
                    className={`p-3 bg-white rounded-full transition-colors ${product.isActive ? 'hover:bg-amber-50' : 'hover:bg-green-50'}`}
                    title={product.isActive ? 'Hide from store' : 'Show in store'}
                  >
                    {product.isActive
                      ? <EyeOff className="w-5 h-5 text-amber-500" />
                      : <Eye className="w-5 h-5 text-green-600" />
                    }
                  </button>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                {/* Category & Brand */}
                <div className="flex items-center gap-2 mb-2">
                  {product.category && (
                    <span className="text-xs text-primary-900 font-semibold bg-primary-50 px-2 py-1 rounded">
                      {product.category.name}
                    </span>
                  )}
                  {product.brand && (
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {product.brand.name}
                    </span>
                  )}
                </div>

                {/* Product Name */}
                <h3 className="font-heading font-bold text-base text-gray-900 mb-1 line-clamp-2 min-h-[2.5rem]">
                  {product.name}
                </h3>

                {/* SKU */}
                {product.sku && (
                  <p className="text-xs text-gray-500 mb-3">SKU: {product.sku}</p>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-xl font-extrabold text-gray-900">
                    &#8377;{product.sellingPrice}
                  </span>
                  {product.mrp !== product.sellingPrice && (
                    <>
                      <span className="text-sm text-gray-500 line-through">
                        &#8377;{product.mrp}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        {Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>

                {/* Featured Badge */}
                {product.isFeatured && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="font-semibold">Featured</span>
                  </div>
                )}

                {/* Description */}
                {product.shortDescription && (
                  <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                    {product.shortDescription}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(product)}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-semibold text-xs hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(product)}
                    disabled={dupId === product.id}
                    className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg font-semibold text-xs hover:bg-purple-100 transition-colors disabled:opacity-50"
                  >
                    {dupId === product.id ? '…' : 'Duplicate'}
                  </button>
                  <button
                    onClick={() => handleToggle(product)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                      product.isActive
                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {product.isActive
                      ? <><EyeOff className="w-3.5 h-3.5" /> Hide</>
                      : <><Eye className="w-3.5 h-3.5" /> Show</>
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading font-bold text-xl text-gray-900">
                {editId ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <MultiImageUploader
                images={form.images || []}
                onChange={(images) => setForm(f => ({ ...f, images }))}
                maxImages={6}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Name *</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Product name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">SKU (leave empty for auto SKU-1, SKU-2...)</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.sku}
                    onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))}
                    placeholder="Auto"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">MRP *</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.mrp}
                    onChange={(e) => setForm(f => ({ ...f, mrp: e.target.value }))}
                    placeholder="1000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Selling Price *</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.sellingPrice}
                    onChange={(e) => setForm(f => ({ ...f, sellingPrice: e.target.value }))}
                    placeholder="800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Stock</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.stockQuantity}
                    onChange={(e) => setForm(f => ({ ...f, stockQuantity: e.target.value }))}
                    placeholder="50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">GST Type (e-commerce)</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.gstType}
                    onChange={(e) => setForm(f => ({ ...f, gstType: e.target.value }))}
                  >
                    <option value="IGST">IGST</option>
                    <option value="CGST_SGST">CGST + SGST</option>
                    <option value="GST_CESS">GST + CESS</option>
                    <option value="CGST_SGST_CESS">CGST + SGST + CESS</option>
                  </select>
                </div>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">GST %</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.gstPercent}
                    onChange={(e) => setForm(f => ({ ...f, gstPercent: e.target.value }))}
                    placeholder="18"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">CESS % (GST + CESS)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.cessPercent}
                    onChange={(e) => setForm(f => ({ ...f, cessPercent: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Payment options for this product</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.allowedPaymentMethods || []).includes('COD')}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...(form.allowedPaymentMethods || []).filter((x) => x !== 'COD'), 'COD']
                          : (form.allowedPaymentMethods || []).filter((x) => x !== 'COD');
                        setForm((f) => ({ ...f, allowedPaymentMethods: next.length ? next : ['ONLINE'] }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-semibold text-gray-700">COD</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.allowedPaymentMethods || []).includes('ONLINE')}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...(form.allowedPaymentMethods || []).filter((x) => x !== 'ONLINE'), 'ONLINE']
                          : (form.allowedPaymentMethods || []).filter((x) => x !== 'ONLINE');
                        setForm((f) => ({ ...f, allowedPaymentMethods: next.length ? next : ['COD'] }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-semibold text-gray-700">Online</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">COD advance % (amount to pay when ordering with COD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                  value={form.codAdvancePercent}
                  onChange={(e) => setForm(f => ({ ...f, codAdvancePercent: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.googleMerchantCentre}
                  onChange={(e) => setForm(f => ({ ...f, googleMerchantCentre: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-semibold text-gray-700">Show in Google Merchant Centre (when user searches product name in Google)</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.categoryId}
                    onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">Select category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Brand</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.brandId}
                    onChange={(e) => setForm(f => ({ ...f, brandId: e.target.value }))}
                  >
                    <option value="">Select brand</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-700">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg font-semibold text-xs hover:bg-amber-200 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generate with AI
                  </button>
                </div>
                <textarea
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all resize-vertical"
                  rows="4"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Product description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Meta Title (SEO)</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.metaTitle}
                    onChange={(e) => setForm(f => ({ ...f, metaTitle: e.target.value }))}
                    placeholder="Product name for search engines"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Meta Description (SEO)</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                    value={form.metaDescription}
                    onChange={(e) => setForm(f => ({ ...f, metaDescription: e.target.value }))}
                    placeholder="Short description for Google"
                  />
                </div>
              </div>

              {/* Specifications */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-700">Specifications</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, specifications: [...f.specifications, { key: '', value: '' }] }))}
                    className="text-xs font-bold text-primary-900 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>
                {form.specifications.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No specifications added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {form.specifications.map((spec, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                          placeholder="Property (e.g. Weight)"
                          value={spec.key}
                          onChange={e => setForm(f => {
                            const specs = [...f.specifications];
                            specs[idx] = { ...specs[idx], key: e.target.value };
                            return { ...f, specifications: specs };
                          })}
                        />
                        <input
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-primary-800 focus:ring-4 focus:ring-primary-100 transition-all"
                          placeholder="Value (e.g. 5 kg)"
                          value={spec.value}
                          onChange={e => setForm(f => {
                            const specs = [...f.specifications];
                            specs[idx] = { ...specs[idx], value: e.target.value };
                            return { ...f, specifications: specs };
                          })}
                        />
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, specifications: f.specifications.filter((_, i) => i !== idx) }))}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm(f => ({ ...f, isFeatured: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold text-gray-700">Featured</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-5 py-3 bg-white border-2 border-gray-200 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-5 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-900 transition-colors shadow-primary disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editId ? 'Update Product' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}