import React, { useState, useEffect } from 'react';
import { 
  X, Check, Save, Loader2, Package, Layers, DollarSign, 
  Tag, ShieldCheck, Plus, Trash2, ChevronDown 
} from 'lucide-react';
import { getBaseProductById, editProduct } from '@/api/products';
import { getCategories } from '@/api/categories';
import { getBrands } from '@/api/brand';

export default function EditProductModal({ isOpen, onClose, product, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Form states
  const [name, setName] = useState('');
  const [styleName, setStyleName] = useState('');
  const [description, setDescription] = useState('');
  const [brandId, setBrandId] = useState('');
  const [soldBy, setSoldBy] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [gender, setGender] = useState(['MEN', 'WOMEN']);
  const [price, setPrice] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [sizes, setSizes] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isTriable, setIsTriable] = useState(true);

  const productId = product?._id || product?.id || product?.styleGroupId;

  useEffect(() => {
    if (!isOpen) return;

    // Load categories & brands
    getCategories()
      .then(res => setCategories(res?.categories || res || []))
      .catch(err => console.error("Error loading categories:", err));

    getBrands()
      .then(res => setBrands(res?.brands || res?.data || res || []))
      .catch(err => console.error("Error loading brands:", err));

    if (!productId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await getBaseProductById(productId);
        const p = res?.product || res?.data || res || product;

        setName(p.name || '');
        setStyleName(p.styleName || '');
        setDescription(p.description || '');
        
        const bId = p.brandId?._id || p.brandId || '';
        setBrandId(typeof bId === 'object' ? bId._id || '' : String(bId));
        setSoldBy(p.soldBy || p.brand || '');

        const catId = p.categoryId?._id || p.categoryId || '';
        setCategoryId(typeof catId === 'object' ? catId._id || '' : String(catId));

        const subCatId = p.subCategoryId?._id || p.subCategoryId || '';
        setSubCategoryId(typeof subCatId === 'object' ? subCatId._id || '' : String(subCatId));

        setGender(Array.isArray(p.gender) && p.gender.length > 0 ? p.gender : ['MEN', 'WOMEN']);
        
        const initialPrice = p.price ?? p.variants?.[0]?.price ?? 0;
        const initialMrp = p.mrp ?? p.variants?.[0]?.mrp ?? initialPrice;
        const initialDiscount = p.discount ?? p.variants?.[0]?.discount ?? 0;
        setPrice(initialPrice);
        setMrp(initialMrp);
        setDiscount(initialDiscount);

        // Populate sizes
        if (p.sizes && p.sizes.length > 0) {
          setSizes(p.sizes.map(s => ({
            _id: s._id,
            size: s.size || 'M',
            stock: Number(s.stock) || 0,
            merchantSizeCode: s.merchantSizeCode || ''
          })));
        } else if (p.variants?.[0]?.sizes && p.variants[0].sizes.length > 0) {
          setSizes(p.variants[0].sizes.map(s => ({
            _id: s._id,
            size: s.size || 'M',
            stock: Number(s.stock) || 0,
            merchantSizeCode: s.merchantSizeCode || ''
          })));
        } else {
          setSizes([{ size: 'Free', stock: Number(p.stock) || 0 }]);
        }

        setTags(Array.isArray(p.tags) ? p.tags : []);
        setIsActive(p.isActive !== false);
        setIsVerified(Boolean(p.isVerified));
        setIsTriable(p.isTriable !== false);
      } catch (err) {
        console.error("Error fetching product details for editing:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, productId]);

  if (!isOpen) return null;

  const parentCategories = categories.filter(c => c.level === 0 || !c.parentId);
  const subCategories = categories.filter(c => categoryId && (c.parentId === categoryId || c.parentId?._id === categoryId));

  const handlePriceChange = (val) => {
    const num = Math.max(0, Number(val));
    setPrice(num);
    if (mrp > 0 && num <= mrp) {
      setDiscount(Math.round(((mrp - num) / mrp) * 100));
    }
  };

  const handleMrpChange = (val) => {
    const num = Math.max(0, Number(val));
    setMrp(num);
    if (num > 0 && price <= num) {
      setDiscount(Math.round(((num - price) / num) * 100));
    }
  };

  const handleDiscountChange = (val) => {
    const num = Math.min(100, Math.max(0, Number(val)));
    setDiscount(num);
    if (mrp > 0) {
      setPrice(Math.round(mrp * (1 - num / 100)));
    }
  };

  const handleAddSize = () => {
    setSizes(prev => [...prev, { size: 'M', stock: 0 }]);
  };

  const handleRemoveSize = (index) => {
    setSizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSizeChange = (index, field, value) => {
    setSizes(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Product name is required.");
      return;
    }
    if (price <= 0) {
      alert("Please specify a valid price.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        styleName: styleName.trim(),
        description: description.trim(),
        brandId: brandId || null,
        soldBy: soldBy.trim() || undefined,
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        gender,
        price: Number(price),
        mrp: Number(mrp) || Number(price),
        discount: Number(discount) || 0,
        sizes: sizes.map(s => ({
          _id: s._id,
          size: s.size,
          stock: Number(s.stock) || 0,
          merchantSizeCode: s.merchantSizeCode || ''
        })),
        tags,
        isActive,
        isVerified,
        isTriable,
        updateAllVariants: true
      };

      const res = await editProduct(productId, payload);
      alert("Product updated successfully!");
      if (onSuccess) {
        onSuccess(res?.product || { _id: productId, ...payload });
      }
      onClose();
    } catch (err) {
      console.error("Failed to save product:", err);
      alert("Failed to update product: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Edit Product (Admin)</h2>
              <p className="text-xs text-slate-500">Update catalog details, pricing, category, brand, and stock</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
            <span className="ml-3 text-slate-600 font-medium">Loading product details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* 1. Basic Info */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-600" /> Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="e.g. Regular Fit Linen Shirt"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Style Name (Optional)</label>
                  <input
                    type="text"
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="e.g. Oxford Classic"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="Detailed product description..."
                />
              </div>

              {/* Gender Focus */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gender Focus</label>
                <div className="flex flex-wrap gap-4">
                  {['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'].map(g => (
                    <label key={g} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gender.includes(g)}
                        onChange={(e) => {
                          if (e.target.checked) setGender(prev => [...prev, g]);
                          else setGender(prev => prev.filter(x => x !== g));
                        }}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Categorization & Brand */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" /> Category & Brand
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Main Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubCategoryId('');
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="">-- No Category --</option>
                    {parentCategories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategory</label>
                  <select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                    disabled={!categoryId}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">-- No Subcategory --</option>
                    {subCategories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="">-- No Brand / Custom --</option>
                    {brands.map(b => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sold By / Brand Text (Optional)</label>
                <input
                  type="text"
                  value={soldBy}
                  onChange={(e) => setSoldBy(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="e.g. FlashFits Boutique or Zara"
                />
              </div>
            </div>

            {/* 3. Pricing & Discounts */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Pricing & Discount
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (Max Retail Price) ₹</label>
                  <input
                    type="number"
                    min={0}
                    value={mrp}
                    onChange={(e) => handleMrpChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Final Selling Price ₹ *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* 4. Sizes & Stock Management */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-sky-600" /> Sizes & Stock Quantity
                </h3>
                <button
                  type="button"
                  onClick={handleAddSize}
                  className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-100 hover:bg-sky-200 rounded-md transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Size
                </button>
              </div>

              <div className="space-y-2">
                {sizes.map((sz, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="w-28">
                      <select
                        value={sz.size}
                        onChange={(e) => handleSizeChange(idx, 'size', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                      >
                        {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Stock:</span>
                      <input
                        type="number"
                        min={0}
                        value={sz.stock}
                        onChange={(e) => handleSizeChange(idx, 'stock', Math.max(0, Number(e.target.value)))}
                        className="w-24 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-slate-500">SKU Code:</span>
                      <input
                        type="text"
                        value={sz.merchantSizeCode || ''}
                        onChange={(e) => handleSizeChange(idx, 'merchantSizeCode', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                        placeholder="e.g. M-01"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSize(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition"
                      title="Remove size"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Search Tags */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200 space-y-3">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-sky-600" /> Search Tags
              </h3>

              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700">
                    {t}
                    <X className="w-3.5 h-3.5 cursor-pointer text-slate-400 hover:text-rose-500" onClick={() => handleRemoveTag(t)} />
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add a search tag..."
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Add Tag
                </button>
              </div>
            </div>

            {/* 6. Settings & Verification Toggles */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-800 text-sm mb-3">Status & Visibility</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-sky-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Product Active</span>
                    <span className="text-[11px] text-slate-400">Visible in user search</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVerified}
                    onChange={(e) => setIsVerified(e.target.checked)}
                    className="rounded text-sky-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Verified Badge</span>
                    <span className="text-[11px] text-slate-400">Admin quality approved</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTriable}
                    onChange={(e) => setIsTriable(e.target.checked)}
                    className="rounded text-sky-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Try & Buy Enabled</span>
                    <span className="text-[11px] text-slate-400">Eligible for 30-min trial</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer / Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md transition flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
