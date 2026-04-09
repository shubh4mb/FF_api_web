import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Zap, Gift, ShoppingCart, Layers, AlertCircle, CheckCircle, X, Clock,
} from 'lucide-react';
import { getOffers, createOffer, updateOffer, toggleOffer, deleteOffer } from '../../api/offers';

const ADMIN_OFFER_TYPES = [
  { value: 'FIRST_TIME_USER', label: 'First-Time User', icon: Gift, color: '#16A34A', bg: '#F0FDF4', description: 'Discount for first-time buyers' },
  { value: 'CART_VALUE', label: 'Cart Value', icon: ShoppingCart, color: '#EA580C', bg: '#FFF7ED', description: 'Discount when cart exceeds value' },
  { value: 'CATEGORY', label: 'Category', icon: Layers, color: '#2563EB', bg: '#EFF6FF', description: 'Discount on specific categories' },
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
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold mb-4">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm font-semibold mb-4">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="text-2xl font-black text-slate-800">{offers.length}</div>
          <div className="text-xs font-semibold text-slate-400 mt-1">Total Offers</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="text-2xl font-black text-green-600">{activeOffers.length}</div>
          <div className="text-xs font-semibold text-slate-400 mt-1">Active</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="text-2xl font-black text-orange-600">{inactiveOffers.length}</div>
          <div className="text-xs font-semibold text-slate-400 mt-1">Inactive</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="text-2xl font-black text-blue-600">{offers.reduce((s, o) => s + (o.currentUsage || 0), 0)}</div>
          <div className="text-xs font-semibold text-slate-400 mt-1">Total Redemptions</div>
        </div>
      </div>

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

      {/* Active Offers */}
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
          <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: typeConfig?.bg || '#F1F5F9', color: typeConfig?.color || '#475569' }}>
            {typeConfig?.label || offer.type}
          </span>
          <span className="text-xs font-extrabold" style={{ color: typeConfig?.color || '#475569' }}>
            {discountLabel}
          </span>
          {offer.couponCode && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-dashed border-slate-300" style={{ letterSpacing: '0.5px' }}>
              {offer.couponCode}
            </span>
          )}
          {isExpired && <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-500">EXPIRED</span>}
          {offer.conditions?.firstTimeUserOnly && <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-600">1ST ORDER</span>}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
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
function OfferFormModal({ offer, submitting, onSubmit, onClose }) {
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
  });

  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const updateCond = (key, value) => setForm((p) => ({ ...p, conditions: { ...p.conditions, [key]: value } }));

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
            <label className="text-xs font-bold text-slate-500 mb-2 block">Offer Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ADMIN_OFFER_TYPES.map((t) => (
                <button
                  key={t.value} type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${form.type === t.value ? 'shadow-sm' : 'border-slate-100'}`}
                  style={{
                    borderColor: form.type === t.value ? t.color : undefined,
                    background: form.type === t.value ? t.bg : '#fff',
                  }}
                >
                  <t.icon size={18} color={t.color} />
                  <div>
                    <div className="text-xs font-bold text-slate-700">{t.label}</div>
                    <div className="text-[10px] text-slate-400">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Title *</label>
            <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Get ₹150 OFF on first order" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200" required />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Description</label>
            <input value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Additional details for customers" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          {/* Discount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Type</label>
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

          {/* Cart Value condition */}
          {(form.type === 'CART_VALUE' || form.type === 'CATEGORY') && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Min Cart Value (₹)</label>
              <input type="number" value={form.conditions.minCartValue} onChange={(e) => updateCond('minCartValue', Number(e.target.value))} min={0} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50" />
            </div>
          )}

          {/* Gender filter for CATEGORY */}
          {form.type === 'CATEGORY' && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Gender Filter (optional)</label>
              <div className="flex gap-2">
                {['MEN', 'WOMEN', 'KIDS'].map((g) => (
                  <button
                    key={g} type="button"
                    onClick={() => {
                      const genders = form.conditions.genders || [];
                      updateCond('genders', genders.includes(g) ? genders.filter((x) => x !== g) : [...genders, g]);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${(form.conditions.genders || []).includes(g) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Range */}
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

          {/* Coupon and Free Delivery */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Coupon Code</label>
              <input value={form.couponCode} onChange={(e) => update('couponCode', e.target.value.toUpperCase())} placeholder="Optional" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 tracking-wider" />
            </div>
            <div className="flex flex-col gap-2 py-2">
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={form.requiresCoupon} onChange={(e) => update('requiresCoupon', e.target.checked)} className="rounded" />
                <span className="text-xs font-semibold text-slate-500">Requires code</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={form.freeDelivery} onChange={(e) => update('freeDelivery', e.target.checked)} className="rounded" />
                <span className="text-xs font-semibold text-slate-500">Free Delivery Included</span>
              </label>
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Max Total Uses</label>
              <input type="number" value={form.maxUsageTotal} onChange={(e) => update('maxUsageTotal', e.target.value)} min={1} placeholder="Unlimited" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Per User Max</label>
              <input type="number" value={form.maxUsagePerUser} onChange={(e) => update('maxUsagePerUser', Number(e.target.value))} min={1} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50" />
            </div>
          </div>

          <button
            type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-extrabold text-white transition-all"
            style={{ background: submitting ? '#94A3B8' : 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
          >
            {submitting ? 'Saving...' : offer ? 'Update Offer' : 'Create Offer'}
          </button>
        </form>
      </div>
    </div>
  );
}
