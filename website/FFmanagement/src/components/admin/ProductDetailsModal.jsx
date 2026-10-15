import React, { useState, useEffect } from 'react';
import { 
  X, Check, Copy, ExternalLink, Package, Tag, Layers, 
  Store, ShieldCheck, ShieldAlert, Sparkles, AlertCircle,
  Eye, CheckCircle2, XCircle, ArrowUpRight, Barcode, Trash2
} from 'lucide-react';
import { getBaseProductById } from '@/api/products';
import { useNavigate } from 'react-router-dom';

export default function ProductDetailsModal({ isOpen, onClose, product, onToggleStatus, onToggleVerification, onDelete }) {
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const productId = product?._id || product?.id || product?.styleGroupId;

  useEffect(() => {
    if (!isOpen || !productId) {
      setDetails(null);
      return;
    }

    const fetchFullDetails = async () => {
      try {
        setLoading(true);
        const res = await getBaseProductById(productId);
        const fetchedData = res?.data || res?.product || res || product;
        setDetails(fetchedData);
        setSelectedColorIndex(0);
        setActiveImageIndex(0);
      } catch (err) {
        console.error("Failed to load complete product details:", err);
        // Fallback to row product data
        setDetails(product);
      } finally {
        setLoading(false);
      }
    };

    fetchFullDetails();
  }, [isOpen, productId, product]);

  if (!isOpen) return null;

  const currentData = details || product || {};
  
  // Extract variants array or construct from flat fields
  const variants = currentData.variants && currentData.variants.length > 0
    ? currentData.variants
    : [
        {
          _id: currentData._id,
          color: currentData.color || { name: 'Default', hex: '#64748b' },
          price: currentData.price || 0,
          mrp: currentData.mrp || currentData.price || 0,
          discount: currentData.discount || 0,
          images: currentData.images || [],
          sizes: currentData.sizes || []
        }
      ];

  const currentVariant = variants[selectedColorIndex] || variants[0] || {};
  const currentImages = (currentVariant.images && currentVariant.images.length > 0)
    ? currentVariant.images
    : (currentData.images && currentData.images.length > 0 ? currentData.images : []);

  const activeImage = currentImages[activeImageIndex]?.url || currentImages[0]?.url || "https://placehold.co/400x500?text=No+Image";

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const brandName = typeof currentData.brandId === 'object' ? currentData.brandId?.name : (currentData.brand || currentData.soldBy || 'No Brand');
  const categoryName = typeof currentData.categoryId === 'object' ? currentData.categoryId?.name : (currentData.category || 'General');
  const subCategoryName = typeof currentData.subCategoryId === 'object' ? currentData.subCategoryId?.name : currentData.subCategory;
  const merchantName = currentData.merchantId?.shopName || currentData.merchantId?.name || currentData.merchant?.shopName || currentData.soldBy || 'Default Merchant';
  const merchantEmail = currentData.merchantId?.email || currentData.merchant?.email || '';

  // Calculate total inventory
  const totalStock = variants.reduce((sum, v) => {
    return sum + (v.sizes || []).reduce((sSum, sz) => sSum + (Number(sz.stock) || 0), 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-800 truncate" title={currentData.name}>
                  {currentData.name || 'Product Details'}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                    currentData.isActive 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-rose-50 text-rose-600 border-rose-200'
                  }`}>
                    {currentData.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                    currentData.isVerified 
                      ? 'bg-sky-50 text-sky-700 border-sky-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {currentData.isVerified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono">ID: {productId}</span>
                <button 
                  onClick={() => handleCopy(productId)}
                  className="hover:text-slate-600 transition-colors p-0.5"
                  title="Copy Product ID"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {currentData.productCode && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-slate-500">Code: {currentData.productCode}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading full product details...</p>
            </div>
          ) : (
            <>
              {/* Top Section: Media & Commercials Overview */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Media Gallery (5 cols) */}
                <div className="md:col-span-5 space-y-3">
                  <div className="relative aspect-[4/5] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                    <img 
                      src={activeImage} 
                      alt={currentData.name} 
                      className="w-full h-full object-cover"
                    />
                    {currentVariant.discount > 0 && (
                      <span className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-rose-500 text-white rounded-lg shadow-sm">
                        {currentVariant.discount}% OFF
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Row */}
                  {currentImages.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {currentImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                            activeImageIndex === idx 
                              ? 'border-sky-500 shadow-sm scale-105' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Color Variants Switcher */}
                  {variants.length > 1 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="text-xs font-semibold text-slate-600 block mb-2">
                        Color Variants ({variants.length})
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {variants.map((v, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setSelectedColorIndex(i);
                              setActiveImageIndex(0);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              selectedColorIndex === i
                                ? 'bg-white border-sky-500 text-sky-700 shadow-sm ring-2 ring-sky-500/20'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span 
                              className="w-3 h-3 rounded-full border border-slate-300 shrink-0" 
                              style={{ backgroundColor: v.color?.hex || '#CBD5E1' }}
                            />
                            <span>{v.color?.name || `Color ${i + 1}`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Key Commercials & Metadata (7 cols) */}
                <div className="md:col-span-7 space-y-4">
                  {/* Pricing Card */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-medium">Selling Price</span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-extrabold text-slate-900">
                          ₹{currentVariant.price ?? currentData.price ?? 0}
                        </span>
                        {(currentVariant.mrp || currentData.mrp) && (currentVariant.mrp > currentVariant.price || currentData.mrp > currentData.price) && (
                          <span className="text-sm text-slate-400 line-through">
                            ₹{currentVariant.mrp || currentData.mrp}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-medium">Total Available Stock</span>
                      <p className="text-lg font-bold text-slate-800 mt-0.5">
                        {totalStock} units
                      </p>
                    </div>
                  </div>

                  {/* Core Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <span className="text-slate-400 font-medium block">Brand</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">{brandName}</span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <span className="text-slate-400 font-medium block">Category</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">
                        {categoryName} {subCategoryName ? `› ${subCategoryName}` : ''}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <span className="text-slate-400 font-medium block">Gender</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">
                        {Array.isArray(currentData.gender) ? currentData.gender.join(', ') : (currentData.gender || 'Unisex')}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <span className="text-slate-400 font-medium block">Try at Home</span>
                      <span className={`font-semibold mt-0.5 inline-flex items-center gap-1 ${currentData.isTriable ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {currentData.isTriable ? 'Eligible' : 'Not Eligible'}
                      </span>
                    </div>

                    <div className="col-span-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 font-medium block">Merchant / Sold By</span>
                        <span className="font-semibold text-slate-700 mt-0.5 block">{merchantName}</span>
                      </div>
                      {merchantEmail && (
                        <span className="text-slate-400 text-xs font-mono">{merchantEmail}</span>
                      )}
                    </div>
                  </div>

                  {/* Sizes & Stock for Active Color */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Sizes & Inventory ({currentVariant.color?.name || 'Selected Color'})
                      </h4>
                      <span className="text-xs text-slate-400 font-medium">
                        {(currentVariant.sizes || []).length} size variant(s)
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                          <tr>
                            <th className="px-3 py-2">Size</th>
                            <th className="px-3 py-2">Merchant Code</th>
                            <th className="px-3 py-2">Stock Level</th>
                            <th className="px-3 py-2 text-right">SKU Code</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {(currentVariant.sizes || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-slate-400 italic">
                                No size configurations found for this color.
                              </td>
                            </tr>
                          ) : (
                            currentVariant.sizes.map((sz, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-bold text-slate-800">{sz.size}</td>
                                <td className="px-3 py-2 text-slate-600">{sz.merchantSizeCode || '—'}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                    Number(sz.stock) > 5
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : Number(sz.stock) > 0
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {Number(sz.stock) > 0 ? `${sz.stock} in stock` : 'Out of stock'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-500">
                                  {sz.productCode || '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Category Attributes */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-500" />
                  Category Attributes & Specifications
                </h4>

                {(!currentData.attributes || currentData.attributes.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No specific category attributes mapped for this product.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {currentData.attributes.map((attr, idx) => {
                      const label = attr.name || attr.attributeId?.name || (attr.attributeId && typeof attr.attributeId === 'object' ? attr.attributeId.name : null) || 'Attribute';
                      const val = Array.isArray(attr.value) ? attr.value.join(', ') : String(attr.value ?? '—');
                      return (
                        <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                          <span className="text-[11px] text-slate-400 font-medium block truncate" title={label}>
                            {label}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 mt-0.5 block truncate" title={val}>
                            {val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Description & Search Tags */}
              <div className="space-y-3">
                {currentData.description && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Description
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 whitespace-pre-line">
                      {currentData.description}
                    </p>
                  </div>
                )}

                {currentData.tags && currentData.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400" /> Tags
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {currentData.tags.map((t, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate(`/admin/variants/${productId}`);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-sky-500" />
              Manage Variants
            </button>
            <button
              onClick={() => {
                onClose();
                navigate(`/admin/matching-products/${productId}`, { state: { merchantId: currentData.merchantId?._id || currentData.merchantId } });
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Matching Products
            </button>
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(currentData);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                Delete
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
