import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  PencilLine, FileText, Image as ImageIcon, AlertCircle, CheckCircle, X,
  Upload, Scissors, Sparkles, Calendar, Layers, Search, Eye, Star,
  ShieldAlert, Gift, Check, Palette, ArrowRight, ExternalLink
} from 'lucide-react';
import { 
  getCollections, 
  createCollection, 
  updateCollection, 
  deleteCollection,
  getCollectionProducts,
  togglePinProduct,
  excludeProduct
} from '../../api/collections';
import { getCategories } from '../../api/categories';
import ImageCropper from '../../components/common/ImageCropper';

const THEME_PRESETS = [
  {
    id: 'onam_gold',
    name: '🌸 Onam Kasavu & Gold',
    primaryColor: '#CA8A04',
    secondaryColor: '#15803D',
    bgGradientStart: '#FEFCE8',
    bgGradientEnd: '#FEF3C7',
    textColor: '#78350F',
    badge: '🌸 ONAM SPECIAL'
  },
  {
    id: 'diwali_glow',
    name: '✨ Diwali Sparkle',
    primaryColor: '#EA580C',
    secondaryColor: '#7C3AED',
    bgGradientStart: '#FFF7ED',
    bgGradientEnd: '#FFEDD5',
    textColor: '#7C2D12',
    badge: '✨ DIWALI DHAMAKA'
  },
  {
    id: 'summer_brights',
    name: '🌴 Summer Brights',
    primaryColor: '#0284C7',
    secondaryColor: '#059669',
    bgGradientStart: '#F0FDF4',
    bgGradientEnd: '#E0F2FE',
    textColor: '#0C4A6E',
    badge: '☀️ SUMMER DROP'
  },
  {
    id: 'midnight_luxe',
    name: '🖤 Midnight Luxe',
    primaryColor: '#F59E0B',
    secondaryColor: '#6366F1',
    bgGradientStart: '#18181B',
    bgGradientEnd: '#09090B',
    textColor: '#F8FAFC',
    badge: '⚡ EXCLUSIVE DROP'
  },
  {
    id: 'default',
    name: '⚡ Flash Standard (Blue)',
    primaryColor: '#0EA5E9',
    secondaryColor: '#2563EB',
    bgGradientStart: '#FFFFFF',
    bgGradientEnd: '#F8FAFC',
    textColor: '#0F172A',
    badge: 'CURATED EDIT'
  }
];

export default function CollectionManagement() {
  const [collections, setCollections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [inspectingCollection, setInspectingCollection] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [colRes, catRes] = await Promise.all([
        getCollections(),
        getCategories().catch(() => ({ categories: [] }))
      ]);
      setCollections(colRes?.collections || []);
      setCategories(catRes?.categories || catRes?.data || []);
    } catch {
      setError('Failed to load collections or categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = async (collection) => {
    try {
      const formData = new FormData();
      formData.append('isActive', !collection.isActive);
      
      await updateCollection(collection._id, formData);
      setCollections((prev) => 
        prev.map((c) => (c._id === collection._id ? { ...c, isActive: !c.isActive } : c))
      );
      setSuccess(`Collection ${collection.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      setError('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this collection permanently? This may affect products tagged with it.')) return;
    try {
      await deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c._id !== id));
      setSuccess('Collection deleted');
    } catch {
      setError('Failed to delete collection');
    }
  };

  const handleFormSubmit = async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('tagline', data.tagline || '');
      formData.append('description', data.description || '');
      formData.append('campaignType', data.campaignType || 'curated');
      formData.append('badgeText', data.badgeText || '');
      formData.append('priority', data.priority || 0);
      formData.append('isActive', data.isActive);
      formData.append('attachedCouponCode', data.attachedCouponCode || '');

      formData.append('theme', JSON.stringify(data.theme));
      formData.append('schedule', JSON.stringify(data.schedule));
      formData.append('smartRules', JSON.stringify(data.smartRules));
      formData.append('subCurations', JSON.stringify(data.subCurations));
      
      if (data.bannerImageFile) {
        formData.append('bannerImage', data.bannerImageFile);
      }

      if (editingCollection) {
        await updateCollection(editingCollection._id, formData);
        setSuccess('Campaign updated successfully');
      } else {
        await createCollection(formData);
        setSuccess('Campaign created successfully');
      }
      setShowForm(false);
      setEditingCollection(null);
      await fetchData();
    } catch (err) {
      setError(err?.message || err?.data?.message || 'Failed to save collection');
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

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Sparkles size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Campaigns & Collections</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">Curate festive drops, seasonal themes, and dynamic smart collections</p>
        </div>
        <button
          onClick={() => { setEditingCollection(null); setShowForm(true); }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-black text-white transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #2563EB)' }}
        >
          <Plus size={18} /> Create Campaign / Drop
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold mb-6 animate-in slide-in-from-top-2">
          <AlertCircle size={20} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-green-50 border border-green-100 text-green-600 text-sm font-bold mb-6 animate-in slide-in-from-top-2">
          <CheckCircle size={20} /> {success}
        </div>
      )}

      {/* Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="font-bold text-sm">Loading campaigns...</span>
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px]">
          <Tag size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">No Collections or Campaigns Found</h3>
          <p className="text-sm text-slate-400 mb-6 font-medium">Create your first Onam festive drop or curated collection</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            Create Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <CampaignCard
              key={collection._id}
              collection={collection}
              onToggle={() => handleToggle(collection)}
              onEdit={(c) => { setEditingCollection(c); setShowForm(true); }}
              onDelete={handleDelete}
              onInspect={(c) => setInspectingCollection(c)}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <CampaignFormModal
          collection={editingCollection}
          categories={categories}
          submitting={submitting}
          onSubmit={handleFormSubmit}
          onClose={() => { setShowForm(false); setEditingCollection(null); }}
        />
      )}

      {/* Product Inspector Modal */}
      {inspectingCollection && (
        <ProductInspectorModal
          collection={inspectingCollection}
          onClose={() => setInspectingCollection(null)}
        />
      )}
    </div>
  );
}

function CampaignCard({ collection, onToggle, onEdit, onDelete, onInspect }) {
  const isFestival = collection.campaignType === 'festival';
  const theme = collection.theme || {};
  const isScheduled = collection.schedule?.isScheduled;

  return (
    <div className={`group bg-white rounded-[32px] border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden h-full flex flex-col ${collection.isActive ? 'border-slate-100 shadow-xl shadow-slate-200/40' : 'border-slate-100 opacity-75 grayscale-[0.3]'}`}>
      
      {/* Banner Preview */}
      <div className="aspect-[21/9] w-full bg-slate-100 relative overflow-hidden">
        {collection.bannerImage?.url ? (
          <img src={collection.bannerImage.url} alt={collection.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center text-slate-400"
            style={{ background: `linear-gradient(135deg, ${theme.bgGradientStart || '#F1F5F9'}, ${theme.bgGradientEnd || '#E2E8F0'})` }}
          >
            <ImageIcon size={32} />
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {collection.badgeText ? (
            <span 
              className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-md"
              style={{ backgroundColor: theme.primaryColor || '#0EA5E9', color: '#FFFFFF' }}
            >
              {collection.badgeText}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900/80 text-white backdrop-blur-md">
              {collection.campaignType || 'curated'}
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase shadow-md backdrop-blur-md ${collection.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}>
            {collection.isActive ? 'Live' : 'Hidden'}
          </span>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-snug group-hover:text-blue-600 transition-colors uppercase">
            {collection.name}
          </h3>
          <span className="text-[10px] font-black tracking-wider text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full uppercase">
            P-{collection.priority}
          </span>
        </div>

        {collection.tagline && (
          <p className="text-xs font-bold text-amber-600 mb-2">{collection.tagline}</p>
        )}

        <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4 line-clamp-2 italic">
          {collection.description || 'No description provided.'}
        </p>

        {/* Campaign Metadata Pills */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {collection.subCurations?.length > 0 && (
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg border border-blue-100 flex items-center gap-1">
              <Layers size={10} /> {collection.subCurations.length} Tabs
            </span>
          )}
          {collection.attachedCouponCode && (
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-lg border border-amber-100 flex items-center gap-1">
              <Gift size={10} /> {collection.attachedCouponCode}
            </span>
          )}
          {isScheduled && (
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-lg border border-purple-100 flex items-center gap-1">
              <Calendar size={10} /> Scheduled
            </span>
          )}
          {collection.smartRules?.tags?.length > 0 && (
            <span className="text-[10px] font-bold bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-100">
              #{collection.smartRules.tags.slice(0, 2).join(', #')}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => onInspect(collection)}
              title="Inspect & Curate Products"
              className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all border border-slate-200 flex items-center gap-1.5 text-xs font-bold"
            >
              <Eye size={16} /> Products
            </button>
            <button 
              onClick={() => onEdit(collection)} 
              title="Edit Campaign"
              className="p-2.5 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
            >
              <Pencil size={16} />
            </button>
            <button 
              onClick={() => onDelete(collection._id)} 
              title="Delete"
              className="p-2.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
            >
              <Trash2 size={16} />
            </button>
          </div>
          
          <button 
            onClick={onToggle}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all ${collection.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700'}`}
          >
            {collection.isActive ? <><ToggleRight size={16} className="text-emerald-500" /> Live</> : <><ToggleLeft size={16} /> Activate</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignFormModal({ collection, categories, submitting, onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: collection?.name || '',
    tagline: collection?.tagline || '',
    description: collection?.description || '',
    campaignType: collection?.campaignType || 'festival',
    badgeText: collection?.badgeText || '🌸 ONAM SPECIAL',
    priority: collection?.priority || 0,
    isActive: collection?.isActive !== undefined ? collection.isActive : true,
    attachedCouponCode: collection?.attachedCouponCode || '',
    theme: collection?.theme || {
      primaryColor: '#CA8A04',
      secondaryColor: '#15803D',
      bgGradientStart: '#FEFCE8',
      bgGradientEnd: '#FEF3C7',
      textColor: '#78350F',
      presetName: 'onam_gold'
    },
    schedule: collection?.schedule || {
      isScheduled: false,
      startDate: '',
      endDate: ''
    },
    smartRules: {
      categoryIds: collection?.smartRules?.categoryIds?.map(c => c._id || c) || [],
      tags: collection?.smartRules?.tags || ['onam', 'kasavu', 'traditional', 'festive'],
      keywords: collection?.smartRules?.keywords || ['kasavu', 'kerala', 'mundu', 'festive'],
      colorKeywords: collection?.smartRules?.colorKeywords || ['Cream', 'Off-White', 'Gold'],
      maxPrice: collection?.smartRules?.maxPrice || ''
    },
    subCurations: collection?.subCurations || [
      { id: 'kasavu_sarees', label: 'Kasavu & Sarees', filterTag: 'kasavu' },
      { id: 'men_traditional', label: "Men's Festive & Mundu", filterTag: 'mundu' },
      { id: 'budget_picks', label: 'Under ₹999', maxPrice: 999 }
    ],
    bannerImageFile: null,
    bannerImagePreview: collection?.bannerImage?.url || null
  });

  const [activeTab, setActiveTab] = useState('general'); // general | theme | rules | subcurations
  const [selectFile, setSelectFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  // New subcuration draft
  const [newSubLabel, setNewSubLabel] = useState('');
  const [newSubTag, setNewSubTag] = useState('');
  const [newSubMaxPrice, setNewSubMaxPrice] = useState('');

  // Rules tag inputs
  const [tagInput, setTagInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const applyPresetTheme = (preset) => {
    setForm({
      ...form,
      badgeText: form.badgeText || preset.badge,
      theme: {
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        bgGradientStart: preset.bgGradientStart,
        bgGradientEnd: preset.bgGradientEnd,
        textColor: preset.textColor,
        presetName: preset.id
      }
    });
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectFile(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onCropComplete = (croppedFile) => {
    setForm({
      ...form,
      bannerImageFile: croppedFile,
      bannerImagePreview: URL.createObjectURL(croppedFile)
    });
    setShowCropper(false);
    setSelectFile(null);
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    const cleanTag = tagInput.trim().toLowerCase();
    if (!form.smartRules.tags.includes(cleanTag)) {
      setForm({
        ...form,
        smartRules: {
          ...form.smartRules,
          tags: [...form.smartRules.tags, cleanTag]
        }
      });
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    setForm({
      ...form,
      smartRules: {
        ...form.smartRules,
        tags: form.smartRules.tags.filter(t => t !== tag)
      }
    });
  };

  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    const cleanKw = keywordInput.trim().toLowerCase();
    if (!form.smartRules.keywords.includes(cleanKw)) {
      setForm({
        ...form,
        smartRules: {
          ...form.smartRules,
          keywords: [...form.smartRules.keywords, cleanKw]
        }
      });
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw) => {
    setForm({
      ...form,
      smartRules: {
        ...form.smartRules,
        keywords: form.smartRules.keywords.filter(k => k !== kw)
      }
    });
  };

  const toggleCategory = (catId) => {
    const isSelected = form.smartRules.categoryIds.includes(catId);
    setForm({
      ...form,
      smartRules: {
        ...form.smartRules,
        categoryIds: isSelected 
          ? form.smartRules.categoryIds.filter(id => id !== catId)
          : [...form.smartRules.categoryIds, catId]
      }
    });
  };

  const addSubCuration = () => {
    if (!newSubLabel.trim()) return;
    const id = newSubLabel.toLowerCase().replace(/ /g, '_').replace(/[^\w-]+/g, '');
    const newSub = {
      id,
      label: newSubLabel.trim(),
      filterTag: newSubTag.trim() || undefined,
      maxPrice: newSubMaxPrice ? Number(newSubMaxPrice) : undefined
    };

    setForm({
      ...form,
      subCurations: [...form.subCurations, newSub]
    });
    setNewSubLabel('');
    setNewSubTag('');
    setNewSubMaxPrice('');
  };

  const removeSubCuration = (idx) => {
    setForm({
      ...form,
      subCurations: form.subCurations.filter((_, i) => i !== idx)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) return;
    onSubmit(form);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[36px] w-full max-w-3xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto flex flex-col">
          
          {/* Modal Header */}
          <div className="p-8 pb-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <Sparkles size={18} />
                </span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
                  {collection ? 'Edit Campaign / Drop' : 'Create Campaign / Festive Drop'}
                </h2>
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-1">Configure theme, auto-matching rules, sub-tabs & schedules</p>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-2xl hover:bg-slate-100 transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-8 pt-4 border-b border-slate-100 flex gap-2 bg-slate-50/50">
            {[
              { id: 'general', label: '1. General & Schedule' },
              { id: 'theme', label: '2. Festive Theme & Banner' },
              { id: 'rules', label: '3. Auto-Match Rules' },
              { id: 'subcurations', label: '4. Sub-Tabs & Curations' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1">
            
            {/* TAB 1: GENERAL & SCHEDULE */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Campaign Name *</label>
                    <input 
                      value={form.name} 
                      onChange={(e) => setForm({...form, name: e.target.value})} 
                      placeholder="e.g. Onam 2026 Festive Drop" 
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      required 
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Campaign Type</label>
                    <select
                      value={form.campaignType}
                      onChange={(e) => setForm({...form, campaignType: e.target.value})}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="festival">🌸 Festival Campaign (Onam, Diwali, Eid)</option>
                      <option value="seasonal">🌴 Seasonal Drop (Summer, Monsoon, Winter)</option>
                      <option value="flash_drop">⚡ Flash Drop / Weekend Edit</option>
                      <option value="curated">🏷️ Standard Curated Collection</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Festival Tagline / Greeting</label>
                    <input 
                      value={form.tagline} 
                      onChange={(e) => setForm({...form, tagline: e.target.value})} 
                      placeholder="e.g. Celebrate in Style — 15 Min Delivery" 
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Badge Text</label>
                    <input 
                      value={form.badgeText} 
                      onChange={(e) => setForm({...form, badgeText: e.target.value})} 
                      placeholder="e.g. 🌸 ONAM SPECIAL" 
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Description</label>
                  <textarea 
                    value={form.description} 
                    onChange={(e) => setForm({...form, description: e.target.value})} 
                    placeholder="Describe the occasion, curated styles, and special discounts..." 
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Attached Promo Coupon (Optional)</label>
                    <input 
                      value={form.attachedCouponCode} 
                      onChange={(e) => setForm({...form, attachedCouponCode: e.target.value.toUpperCase()})} 
                      placeholder="e.g. ONAM2026 (1-tap apply on campaign page)" 
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Global Priority (Higher = Top of Home)</label>
                    <input 
                      type="number" 
                      value={form.priority} 
                      onChange={(e) => setForm({...form, priority: Number(e.target.value)})} 
                      placeholder="0"
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Scheduling Box */}
                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-purple-600" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Auto-Schedule Dates</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={form.schedule.isScheduled}
                        onChange={(e) => setForm({
                          ...form,
                          schedule: { ...form.schedule, isScheduled: e.target.checked }
                        })}
                        className="rounded text-purple-600 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-600">Enable Schedule Window</span>
                    </label>
                  </div>

                  {form.schedule.isScheduled && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Start Date</label>
                        <input 
                          type="datetime-local"
                          value={form.schedule.startDate ? new Date(form.schedule.startDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setForm({
                            ...form,
                            schedule: { ...form.schedule, startDate: e.target.value ? new Date(e.target.value) : null }
                          })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">End Date (Auto-expire)</label>
                        <input 
                          type="datetime-local"
                          value={form.schedule.endDate ? new Date(form.schedule.endDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setForm({
                            ...form,
                            schedule: { ...form.schedule, endDate: e.target.value ? new Date(e.target.value) : null }
                          })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: THEME & BANNER */}
            {activeTab === 'theme' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-3 block">Preset Festival Themes</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPresetTheme(preset)}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-24 ${form.theme.presetName === preset.id ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                        style={{ background: `linear-gradient(135deg, ${preset.bgGradientStart}, ${preset.bgGradientEnd})` }}
                      >
                        <span className="text-xs font-black" style={{ color: preset.textColor }}>{preset.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full border border-white/40 shadow-sm" style={{ backgroundColor: preset.primaryColor }}></span>
                          <span className="w-4 h-4 rounded-full border border-white/40 shadow-sm" style={{ backgroundColor: preset.secondaryColor }}></span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={form.theme.primaryColor || '#CA8A04'} 
                        onChange={(e) => setForm({...form, theme: {...form.theme, primaryColor: e.target.value, presetName: 'custom'}})} 
                        className="w-8 h-8 rounded-lg cursor-pointer border-0"
                      />
                      <span className="text-xs font-mono font-bold text-slate-700">{form.theme.primaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Secondary Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={form.theme.secondaryColor || '#15803D'} 
                        onChange={(e) => setForm({...form, theme: {...form.theme, secondaryColor: e.target.value, presetName: 'custom'}})} 
                        className="w-8 h-8 rounded-lg cursor-pointer border-0"
                      />
                      <span className="text-xs font-mono font-bold text-slate-700">{form.theme.secondaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Gradient Start</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={form.theme.bgGradientStart || '#FEFCE8'} 
                        onChange={(e) => setForm({...form, theme: {...form.theme, bgGradientStart: e.target.value, presetName: 'custom'}})} 
                        className="w-8 h-8 rounded-lg cursor-pointer border-0"
                      />
                      <span className="text-xs font-mono font-bold text-slate-700">{form.theme.bgGradientStart}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Gradient End</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={form.theme.bgGradientEnd || '#FEF3C7'} 
                        onChange={(e) => setForm({...form, theme: {...form.theme, bgGradientEnd: e.target.value, presetName: 'custom'}})} 
                        className="w-8 h-8 rounded-lg cursor-pointer border-0"
                      />
                      <span className="text-xs font-mono font-bold text-slate-700">{form.theme.bgGradientEnd}</span>
                    </div>
                  </div>
                </div>

                {/* Banner Upload */}
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">Campaign Banner Image (21:9 ratio)</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileSelect}
                      className="hidden" 
                      id="banner-upload"
                    />
                    <label 
                      htmlFor="banner-upload"
                      className="w-full aspect-[21/9] rounded-[24px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden"
                    >
                      {form.bannerImagePreview ? (
                        <>
                          <img src={form.bannerImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1.5">
                            <div className="p-2.5 bg-white/20 rounded-full backdrop-blur-md">
                              <Scissors size={18} />
                            </div>
                            <span className="font-black text-[10px] uppercase tracking-widest">Update Banner</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all border border-slate-100">
                            <Upload size={20} />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-slate-500">Click to upload festival graphic</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG (Recommended 1200x500)</p>
                          </div>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SMART AUTO-RULES */}
            {activeTab === 'rules' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                  <Sparkles size={20} className="text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black text-blue-900 uppercase">How Auto-Matching Works</h4>
                    <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                      Any product from nearby stores matching these categories OR tags/keywords will automatically appear in this campaign without manual tagging! Merchants can also manually nominate edge-case shirts/items.
                    </p>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">
                    Auto-Include Categories (e.g. Ethnic Wear, Sarees, Kurtas)
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    {categories.map((cat) => {
                      const isSel = form.smartRules.categoryIds.includes(cat._id);
                      return (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => toggleCategory(cat._id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isSel ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          {isSel && <Check size={14} />} {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">
                    Auto-Include Tags (e.g. kasavu, onam, traditional, ethnic)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Type tag and press Add..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
                    />
                    <button 
                      type="button" 
                      onClick={addTag}
                      className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900"
                    >
                      Add Tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.smartRules.tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Keywords in Title */}
                <div>
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2 block">
                    Title Keywords (e.g. kasavu, mundu, kerala)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input 
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                      placeholder="Type title keyword and press Add..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
                    />
                    <button 
                      type="button" 
                      onClick={addKeyword}
                      className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900"
                    >
                      Add Keyword
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.smartRules.keywords.map((kw) => (
                      <span key={kw} className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
                        "{kw}"
                        <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SUB-CURATIONS (TABS INSIDE CAMPAIGN) */}
            {activeTab === 'subcurations' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl">
                  <h4 className="text-xs font-black text-purple-900 uppercase">Sub-Curation Filter Tabs</h4>
                  <p className="text-xs text-purple-700 mt-0.5">
                    When the customer opens the Onam campaign on mobile, these tabs appear at the top for easy exploration (e.g., "Kasavu Sarees", "Festive Shirts & Mundu", "Under ₹999").
                  </p>
                </div>

                {/* Sub-Curation list */}
                <div className="space-y-2">
                  {form.subCurations.map((sub, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div>
                        <span className="text-sm font-bold text-slate-800">{sub.label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {sub.filterTag && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Tag: {sub.filterTag}</span>}
                          {sub.maxPrice && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Max Price: ₹{sub.maxPrice}</span>}
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeSubCuration(idx)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new sub curation */}
                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3">
                  <h5 className="text-[11px] font-black text-slate-600 uppercase">Add New Sub-Tab</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input 
                      value={newSubLabel} 
                      onChange={(e) => setNewSubLabel(e.target.value)} 
                      placeholder="Tab Title (e.g. Kids Festive)" 
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                    <input 
                      value={newSubTag} 
                      onChange={(e) => setNewSubTag(e.target.value)} 
                      placeholder="Filter Tag (optional, e.g. kids)" 
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                    <input 
                      type="number"
                      value={newSubMaxPrice} 
                      onChange={(e) => setNewSubMaxPrice(e.target.value)} 
                      placeholder="Max Price Cap (optional)" 
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addSubCuration}
                    className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Sub-Tab
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3.5 rounded-2xl text-sm font-black text-white transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 uppercase tracking-wider disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #2563EB)' }}
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...</>
                ) : collection ? 'Update Campaign' : 'Launch Campaign'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {showCropper && (
        <ImageCropper
          image={selectFile}
          onCropComplete={onCropComplete}
          onCancel={() => { setShowCropper(false); setSelectFile(null); }}
          aspectRatio={21 / 9}
        />
      )}
    </>
  );
}

function ProductInspectorModal({ collection, onClose }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await getCollectionProducts(collection._id, { search });
      setProducts(res?.data?.products || []);
      setTotalCount(res?.data?.totalCount || 0);
    } catch (err) {
      console.error('Failed to load collection products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [collection._id, search]);

  const handleTogglePin = async (productId) => {
    try {
      await togglePinProduct(collection._id, productId);
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, isPinned: !p.isPinned } : p));
    } catch (err) {
      alert('Failed to pin/unpin item');
    }
  };

  const handleExclude = async (productId, styleGroupId) => {
    if (!window.confirm('Remove this product from the campaign? (Mark as spam/irrelevant)')) return;
    try {
      await excludeProduct(collection._id, { productId, styleGroupId });
      setProducts(prev => prev.filter(p => p.styleGroupId !== styleGroupId && p._id !== productId));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      alert('Failed to exclude product');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[36px] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-700">
                {collection.campaignType || 'Campaign'}
              </span>
              <h2 className="text-xl font-black text-slate-800 uppercase">{collection.name} Products</h2>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              {totalCount} total products live (Auto-matched + Merchant-nominated)
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-2xl hover:bg-slate-100">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Search & Filter bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by title..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={fetchProducts} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900">
            Refresh
          </button>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-xs font-bold">Scanning catalog products...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Tag size={36} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-slate-600">No products matching this campaign yet</p>
              <p className="text-xs text-slate-400 mt-1">Products will appear once merchants nominate them or match auto-rules</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((item) => (
                <div key={item.styleGroupId || item._id} className="p-3 bg-white border border-slate-200 rounded-2xl flex gap-3 hover:shadow-md transition-all relative">
                  <div className="w-16 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                    {item.images?.[0]?.url ? (
                      <img src={item.images[0].url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <ImageIcon size={18} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">{item.merchant?.storeName || 'Partner Store'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-black text-slate-900">₹{item.price}</span>
                        {item.mrp > item.price && (
                          <span className="text-[10px] text-slate-400 line-through">₹{item.mrp}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.matchType === 'merchant_nominated' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                        {item.matchType === 'merchant_nominated' ? 'Nominated' : 'Auto-Match'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePin(item._id)}
                          title={item.isPinned ? "Unpin" : "Pin to Top"}
                          className={`p-1.5 rounded-lg transition-colors ${item.isPinned ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-50'}`}
                        >
                          <Star size={14} fill={item.isPinned ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => handleExclude(item._id, item.styleGroupId)}
                          title="Remove from Campaign (Spam)"
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end bg-white">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

