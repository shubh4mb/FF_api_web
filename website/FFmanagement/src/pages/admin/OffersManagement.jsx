import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Zap, Gift, ShoppingCart, Layers, AlertCircle, CheckCircle, X, Clock,
  LayoutGrid
} from 'lucide-react';
import { getOffers, createOffer, updateOffer, toggleOffer, deleteOffer } from '../../api/offers';
import { getCategories } from '../../api/categories';
import { getCollections } from '../../api/collections';

const ADMIN_OFFER_TYPES = [
  { value: 'FIRST_TIME_USER', label: 'First-Time User', icon: Gift, color: '#16A34A', bg: '#F0FDF4', description: 'Discount for first-time buyers' },
  { value: 'CART_VALUE', label: 'Cart Value', icon: ShoppingCart, color: '#EA580C', bg: '#FFF7ED', description: 'Discount when cart exceeds value' },
  { value: 'CATEGORY', label: 'Category', icon: Layers, color: '#2563EB', bg: '#EFF6FF', description: 'Discount on specific categories' },
  { value: 'COLLECTION', label: 'Collection', icon: LayoutGrid, color: '#7C3AED', bg: '#F5F3FF', description: 'Discount on curated collections' },
  { value: 'FLASH_SALE', label: 'Flash Sale', icon: Zap, color: '#DC2626', bg: '#FEF2F2', description: 'Time-limited flash discount' },
];

export default function OffersManagement() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);

  const fetchInitialData = async () => {
    try {
      const [catRes, collRes] = await Promise.all([
        getCategories(),
        getCollections()
      ]);
      setCategories(catRes?.categories || []);
      setCollections(collRes?.collections || []);
    } catch (err) {
      console.error('Failed to fetch initial data', err);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter) params.type = typeFilter;
      const res = await getOffers(params);
      setOffers(res?.offers || []);
    } catch (err) {
      setError('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOffers(); }, [typeFilter]);

  const handleToggle = async (id) => {
    try {
      await toggleOffer(id);
      setOffers((prev) => prev.map((o) => (o._id === id ? { ...o, isActive: !o.isActive } : o)));
    } catch {
      setError('Failed to toggle offer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this offer permanently?')) return;
    try {
      await deleteOffer(id);
      setOffers((prev) => prev.filter((o) => o._id !== id));
      setSuccess('Offer deleted');
    } catch {
      setError('Failed to delete offer');
    }
  };

  const handleFormSubmit = async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      if (editingOffer) {
        await updateOffer(editingOffer._id, data);
        setSuccess('Offer updated successfully');
      } else {
        await createOffer(data);
        setSuccess('Offer created successfully');
      }
      setShowForm(false);
      setEditingOffer(null);
      await fetchOffers();
    } catch (err) {
      setError(err?.message || 'Failed to save offer');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const activeOffers = offers.filter((o) => o.isActive);
  const inactiveOffers = offers.filter((o) => !o.isActive);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Offers Management</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage platform-wide offers</p>
        </div>
        <button
          onClick={() => { setEditingOffer(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
        >
          <Plus size={16} /> Create Offer
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold mb-4 text-center">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm font-semibold mb-4 text-center">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Type Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setTypeFilter('')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!typeFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          All
        </button>
        {ADMIN_OFFER_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${typeFilter === t.value ? 'text-white' : 'hover:opacity-80'}`}
            style={{
              background: typeFilter === t.value ? t.color : t.bg,
              color: typeFilter === t.value ? '#fff' : t.color,
            }}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="text-center py-12 text-slate-400">Loading offers...</div>}

      {/* Empty */}
      {!loading && offers.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <Tag size={48} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-500 mb-1">No Offers</h3>
          <p className="text-sm text-slate-400">Create your first platform offer</p>
        </div>
      )}

      {/* Offers Table / Rows */}
      {!loading && activeOffers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Active Offers ({activeOffers.length})</h2>
          <div className="space-y-3">
            {activeOffers.map((offer) => (
              <OfferRow key={offer._id} offer={offer} onToggle={handleToggle} onEdit={(o) => { setEditingOffer(o); setShowForm(true); }} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {!loading && inactiveOffers.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-400 mb-3">Inactive Offers ({inactiveOffers.length})</h2>
          <div className="space-y-3">
            {inactiveOffers.map((offer) => (
              <OfferRow key={offer._id} offer={offer} onToggle={handleToggle} onEdit={(o) => { setEditingOffer(o); setShowForm(true); }} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <OfferFormModal
          offer={editingOffer}
          submitting={submitting}
          categories={categories}
          collections={collections}
          onSubmit={handleFormSubmit}
          onClose={() => { setShowForm(false); setEditingOffer(null); }}
        />
      )}
    </div>
  );
}

// ── Offer Row ──
function OfferRow({ offer, onToggle, onEdit, onDelete }) {
  const typeConfig = ADMIN_OFFER_TYPES.find((t) => t.value === offer.type);
  const TypeIcon = typeConfig?.icon || Tag;
  const isExpired = new Date(offer.endDate) < new Date();
  const discountLabel = offer.discountType === 'flat' ? `₹${offer.discountValue} OFF` : `${offer.discountValue}% OFF`;

  return (
    <div className={`bg-white rounded-xl p-4 border flex items-center gap-4 transition-all hover:shadow-sm ${offer.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
      {/* Icon */}
      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: typeConfig?.bg || '#F1F5F9' }}>
        <TypeIcon size={22} color={typeConfig?.color || '#475569'} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-800 truncate">{offer.title}</div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-tight" style={{ background: typeConfig?.bg || '#F1F5F9', color: typeConfig?.color || '#475569' }}>
            {typeConfig?.label || offer.type}
          </span>
          <span className="text-xs font-extrabold" style={{ color: typeConfig?.color || '#475569' }}>
            {discountLabel}
          </span>
          {offer.couponCode && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-dashed border-slate-300">
              {offer.couponCode}
            </span>
          )}
          {isExpired && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-500">EXPIRED</span>}
          {offer.conditions?.firstTimeUserOnly && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-600">1ST ORDER</span>}
          {offer.benefitType === 'PRODUCT' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">PRODUCT BENEFIT</span>}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-medium">
          <span className="flex items-center gap-1"><Clock size={10} /> Ends {new Date(offer.endDate).toLocaleDateString()}</span>
          <span>{offer.currentUsage || 0} used</span>
          {offer.maxUsageTotal && <span>/ {offer.maxUsageTotal} max</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => onToggle(offer._id)} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors" title={offer.isActive ? 'Deactivate' : 'Activate'}>
          {offer.isActive ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} className="text-slate-300" />}
        </button>
        <button onClick={() => onEdit(offer)} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors" title="Edit">
          <Pencil size={14} className="text-slate-400" />
        </button>
        <button onClick={() => onDelete(offer._id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
          <Trash2 size={14} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ── Form Modal ──
function OfferFormModal({ offer, submitting, categories, collections, onSubmit, onClose }) {
  const [form, setForm] = useState({
    title: offer?.title || '',
    description: offer?.description || '',
    badgeText: offer?.badgeText || '',
    type: offer?.type || 'FIRST_TIME_USER',
    discountType: offer?.discountType || 'percentage',
    discountValue: offer?.discountValue || 0,
    maxDiscount: offer?.maxDiscount || '',
    conditions: {
      minCartValue: offer?.conditions?.minCartValue || 0,
      categoryIds: offer?.conditions?.categoryIds || [],
      subCategoryIds: offer?.conditions?.subCategoryIds || [],
      collectionId: offer?.conditions?.collectionId || null,
      genders: offer?.conditions?.genders || [],
      firstTimeUserOnly: offer?.conditions?.firstTimeUserOnly || offer?.type === 'FIRST_TIME_USER',
    },
    startDate: offer?.startDate ? new Date(offer.startDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    endDate: offer?.endDate ? new Date(offer.endDate).toISOString().slice(0, 16) : '',
    isFlashSale: offer?.isFlashSale || offer?.type === 'FLASH_SALE',
    couponCode: offer?.couponCode || '',
    requiresCoupon: offer?.requiresCoupon || false,
    maxUsageTotal: offer?.maxUsageTotal || '',
    maxUsagePerUser: offer?.maxUsagePerUser || 1,
    freeDelivery: offer?.freeDelivery || false,
    priority: offer?.priority || 0,
    benefitType: offer?.benefitType || (offer?.type === 'COLLECTION' ? 'PRODUCT' : 'CART'),
    stackable: offer?.stackable !== undefined ? offer.stackable : true,
    isExclusive: offer?.isExclusive || false,
  });

  const update = (key, value) => {
    setForm((p) => {
        const newState = { ...p, [key]: value };
        // Auto-set benefit type if choosing collection or category
        if (key === 'type' && (value === 'COLLECTION' || value === 'CATEGORY')) {
            newState.benefitType = 'PRODUCT';
        } else if (key === 'type') {
            newState.benefitType = 'CART';
        }
        return newState;
    });
  };
  
  const updateCond = (key, value) => setForm((p) => ({ ...p, conditions: { ...p.conditions, [key]: value } }));

  const mainCategories = categories?.filter(c => c.level === 0) || [];
  const subCategories = categories?.filter(c => c.level === 1) || [];

  const handleToggleCategory = (id, type) => {
    const list = form.conditions[type] || [];
    if (list.includes(id)) {
      updateCond(type, list.filter(x => x !== id));
    } else {
      updateCond(type, [...list, id]);
    }
  };

  const handleTypeChange = (type) => {
    update('type', type);
    if (type === 'FIRST_TIME_USER') updateCond('firstTimeUserOnly', true);
    else updateCond('firstTimeUserOnly', false);
    if (type === 'FLASH_SALE') update('isFlashSale', true);
    else update('isFlashSale', false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.endDate) return;
    onSubmit({
      ...form,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      maxUsageTotal: form.maxUsageTotal ? Number(form.maxUsageTotal) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-7 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-slate-800">
            {offer ? 'Edit Offer' : 'Create Admin Offer'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-2 block tracking-tight uppercase">Offer Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ADMIN_OFFER_TYPES.map((t) => (
                <button
                  key={t.value} type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${form.type === t.value ? 'shadow-sm' : 'border-slate-50'}`}
                  style={{
                    borderColor: form.type === t.value ? t.color : undefined,
                    background: form.type === t.value ? t.bg : '#F8FAFC',
                  }}
                >
                  <t.icon size={18} color={t.color} />
                  <div>
                    <div className="text-xs font-bold text-slate-700">{t.label}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Title *</label>
            <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. ₹150 OFF on first order" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" required />
          </div>

          {/* Discount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Discount Type</label>
              <select value={form.discountType} onChange={(e) => update('discountType', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50">
                <option value="percentage">% Off</option>
                <option value="flat">₹ Flat</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Value *</label>
              <input type="number" value={form.discountValue} onChange={(e) => update('discountValue', Number(e.target.value))} min={0} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50" required />
            </div>
            {form.discountType === 'percentage' && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Max ₹</label>
                <input type="number" value={form.maxDiscount} onChange={(e) => update('maxDiscount', e.target.value)} min={0} placeholder="No cap" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50" />
              </div>
            )}
          </div>

          {/* Logic Box */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Eligibility Logic</h3>
            
            {(form.type === 'CART_VALUE' || form.type === 'CATEGORY' || form.type === 'COLLECTION') && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Min Cart Value (₹)</label>
                <input type="number" value={form.conditions.minCartValue} onChange={(e) => updateCond('minCartValue', Number(e.target.value))} min={0} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white" />
              </div>
            )}

            {form.type === 'COLLECTION' && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Target Collection</label>
                <select 
                  value={form.conditions.collectionId || ''} 
                  onChange={(e) => updateCond('collectionId', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-white"
                >
                  <option value="">Select Collection</option>
                  {collections.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {form.type === 'CATEGORY' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">Whitelist Genders</label>
                  <div className="flex gap-2">
                    {['MEN', 'WOMEN', 'KIDS'].map((g) => (
                      <button
                        key={g} type="button"
                        onClick={() => {
                          const genders = form.conditions.genders || [];
                          updateCond('genders', genders.includes(g) ? genders.filter((x) => x !== g) : [...genders, g]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all uppercase ${(form.conditions.genders || []).includes(g) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block mb-1.5">Categories</label>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {mainCategories.map(cat => (
                            <button
                                key={cat._id} type="button"
                                onClick={() => handleToggleCategory(cat._id, 'categoryIds')}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all uppercase ${(form.conditions.categoryIds || []).includes(cat._id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                            >
                                {cat.name}
                            </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block mb-1.5">Sub-Categories</label>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {subCategories.map(sub => (
                            <button
                                key={sub._id} type="button"
                                onClick={() => handleToggleCategory(sub._id, 'subCategoryIds')}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all uppercase ${(form.conditions.subCategoryIds || []).includes(sub._id) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                            >
                                {sub.name}
                            </button>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Start *</label>
              <input type="datetime-local" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">End *</label>
              <input type="datetime-local" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Coupon Code</label>
                <input value={form.couponCode} onChange={(e) => update('couponCode', e.target.value.toUpperCase())} placeholder="Optional" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 tracking-wider" />
            </div>
            <div className="space-y-2 py-1">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.requiresCoupon} onChange={(e) => update('requiresCoupon', e.target.checked)} className="rounded" />
                    <span className="text-xs font-semibold text-slate-500">Requires coupon</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.freeDelivery} onChange={(e) => update('freeDelivery', e.target.checked)} className="rounded" />
                    <span className="text-xs font-semibold text-slate-500">Free Delivery</span>
                </label>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Stacking & Type</label>
                <div className="flex gap-2 mb-3">
                    {['PRODUCT', 'CART', 'DELIVERY'].map(bt => (
                        <button
                            key={bt} type="button"
                            onClick={() => update('benefitType', bt)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${form.benefitType === bt ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                        >
                            {bt}
                        </button>
                    ))}
                </div>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.stackable} onChange={(e) => update('stackable', e.target.checked)} className="rounded" />
                        <span className="text-xs font-semibold text-slate-500">Stackable</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.isExclusive} onChange={(e) => { update('isExclusive', e.target.checked); if(e.target.checked) update('stackable', false); }} className="rounded" />
                        <span className="text-xs font-semibold text-orange-600">Exclusive</span>
                    </label>
                </div>
          </div>

          <button
            type="submit" disabled={submitting}
            className="w-full py-3.5 rounded-xl text-sm font-extrabold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
          >
            {submitting ? 'Processing...' : offer ? 'Update Live Scheme' : 'Launch New Offer'}
          </button>
        </form>
      </div>
    </div>
  );
}
