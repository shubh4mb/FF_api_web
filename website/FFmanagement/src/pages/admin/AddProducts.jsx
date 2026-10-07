import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Copy, Check } from 'lucide-react';
import { getCategories } from '@/api/categories';
import { getMerchants } from '@/api/merchants';
import { getBrands } from '@/api/brand';
import { addBaseProduct } from '@/api/products';
import DynaminFeature from '@/components/commmon/DynaminFeature';

export default function AddProductPage() {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    brandId: '',
    categoryId: '',
    subCategoryId: '',
    gender: ['MEN', 'WOMEN'],
    description: '',
    features: {},
    tags: '',
    merchantId: '',
    isTriable:true,
    isActive:true,
  });

  const [categories, setCategories] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [brands, setBrands] = useState([]);
  const [promptCopied, setPromptCopied] = useState(false);

  useEffect(() => {
    // Fetch categories from dummy endpoint or local JSON
    const fetchCategories = async () => {
      try {
        const res = await getCategories();
        const cats = res?.categories || [];
        setCategories(cats);

        const qCatId = searchParams.get('categoryId');
        const qSubCatId = searchParams.get('subCategoryId');
        if (qCatId || qSubCatId) {
          setFormData(prev => ({
            ...prev,
            ...(qCatId && { categoryId: qCatId }),
            ...(qSubCatId && { subCategoryId: qSubCatId }),
          }));
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    const fetchMerchants = async () => {
      try {
        const res = await getMerchants();
        setMerchants(res.merchants);
        // console.log(res);
      } catch (error) {
        console.error('Error fetching merchants:', error);
      }
    };
    const fetchBrands = async () => {
      try {
        const res = await getBrands();
        setBrands(res.brands);
        // console.log(res);
      } catch (error) {
        console.error('Error fetching brands:', error);
      }
    };

    fetchCategories();
    fetchMerchants();
    fetchBrands();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()),
      };
      console.log(payload);
      await addBaseProduct(payload); 
      setMessage('Product created successfully!');
      // Redirect or show link to add variants
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryOptions = (level) => {
    if (level === 0) {
      return categories
        .filter(cat => cat.level === 0)
        .map(cat => (
          <option key={cat._id} value={cat._id}>{cat.name}</option>
        ));
    } else if (level === 1) {
      return categories
        .filter(cat => cat.level === 1 && cat.parentId === formData.categoryId)
        .map(cat => (
          <option key={cat._id} value={cat._id}>{cat.name}</option>
        ));
    }
  };
  

  const activeSubCategory = categories.find(c => c._id === formData.subCategoryId);
  const activeParentCategory = categories.find(c => c._id === formData.categoryId);
  const activeCat = activeSubCategory || activeParentCategory;
  const pFront = (activeSubCategory?.promptFront || activeSubCategory?.prompts?.front || activeParentCategory?.promptFront || activeParentCategory?.prompts?.front || '').trim();
  const pBack = (activeSubCategory?.promptBack || activeSubCategory?.prompts?.back || activeParentCategory?.promptBack || activeParentCategory?.prompts?.back || '').trim();
  const pCloseUp = (activeSubCategory?.promptCloseUp || activeSubCategory?.prompts?.closeUp || activeSubCategory?.prompts?.closeup || activeParentCategory?.promptCloseUp || activeParentCategory?.prompts?.closeUp || '').trim();
  const legacyDesc = (!pFront && !pBack && !pCloseUp) ? (activeSubCategory?.description || activeParentCategory?.description || '').trim() : '';
  const hasPrompts = !!(pFront || pBack || pCloseUp || legacyDesc);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Add New Product</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="name" placeholder="Product Name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" required />
       <select name="brandId" value={formData.brandId} onChange={handleChange} className="w-full p-2 border rounded" required>
          <option value="">Select Brand</option>
          {brands.map(brand => (
            <option key={brand._id} value={brand._id}>{brand.name}</option>
          ))}
        </select>

        <select name="merchantId" value={formData.merchantId} onChange={handleChange} className="w-full p-2 border rounded" required>
          <option value="">Select Merchant</option>
          {merchants.map(merchant => (
            <option key={merchant._id} value={merchant._id}>{merchant.shopName}</option>
          ))}
        </select>

        <select name="categoryId" value={formData.categoryId} onChange={handleChange} className="w-full p-2 border rounded" required>
          <option value="">Select Category</option>
          {renderCategoryOptions(0)}
        </select>

        <select name="subCategoryId" value={formData.subCategoryId} onChange={handleChange} className="w-full p-2 border rounded">
          <option value="">Select Sub Category</option>
          {renderCategoryOptions(1)}
        </select>

        {/* Gender Multi-Checkbox */}
        <div className="border p-3 rounded">
          <label className="block text-sm font-semibold text-gray-800 mb-2">Gender Target</label>
          <div className="flex gap-4">
            {['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'].map(g => (
              <label key={g} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.gender.includes(g)}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      gender: e.target.checked
                        ? [...prev.gender, g]
                        : prev.gender.filter(x => x !== g)
                    }));
                  }}
                  className="w-4 h-4"
                />
                <span>{g}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reusable Category Prompts Helper (Front, Back, Close-Up) */}
        {hasPrompts && (
          <div className="bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-purple-950">
                  Category Prompts Available ({activeCat?.name}):
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const combined = [
                    pFront ? `Front: ${pFront}` : '',
                    pBack ? `Back: ${pBack}` : '',
                    pCloseUp ? `Close-Up: ${pCloseUp}` : '',
                    legacyDesc ? `Prompt: ${legacyDesc}` : '',
                  ].filter(Boolean).join("\n\n");
                  setFormData(prev => ({
                    ...prev,
                    description: prev.description ? `${prev.description}\n\n${combined}` : combined
                  }));
                }}
                className="text-xs font-semibold px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-xs"
              >
                Insert All Prompts
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Front Prompt Chip */}
              {pFront && (
                <div className="bg-white p-3 rounded-xl border border-blue-100 space-y-1.5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Front View
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pFront);
                        setPromptCopied('front');
                        setTimeout(() => setPromptCopied(false), 2000);
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800"
                    >
                      {promptCopied === 'front' ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-slate-700 line-clamp-2 bg-blue-50/40 p-1.5 rounded">
                    {pFront}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        description: prev.description ? `${prev.description}\n\n${pFront}` : pFront
                      }));
                    }}
                    className="w-full text-[11px] font-medium py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition"
                  >
                    + Use Front Prompt
                  </button>
                </div>
              )}

              {/* Back Prompt Chip */}
              {pBack && (
                <div className="bg-white p-3 rounded-xl border border-purple-100 space-y-1.5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Back View
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pBack);
                        setPromptCopied('back');
                        setTimeout(() => setPromptCopied(false), 2000);
                      }}
                      className="text-[10px] text-purple-600 hover:text-purple-800"
                    >
                      {promptCopied === 'back' ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-slate-700 line-clamp-2 bg-purple-50/40 p-1.5 rounded">
                    {pBack}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        description: prev.description ? `${prev.description}\n\n${pBack}` : pBack
                      }));
                    }}
                    className="w-full text-[11px] font-medium py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded transition"
                  >
                    + Use Back Prompt
                  </button>
                </div>
              )}

              {/* Close-Up Prompt Chip */}
              {pCloseUp && (
                <div className="bg-white p-3 rounded-xl border border-amber-100 space-y-1.5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Close-Up View
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pCloseUp);
                        setPromptCopied('closeup');
                        setTimeout(() => setPromptCopied(false), 2000);
                      }}
                      className="text-[10px] text-amber-600 hover:text-amber-800"
                    >
                      {promptCopied === 'closeup' ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-slate-700 line-clamp-2 bg-amber-50/40 p-1.5 rounded">
                    {pCloseUp}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        description: prev.description ? `${prev.description}\n\n${pCloseUp}` : pCloseUp
                      }));
                    }}
                    className="w-full text-[11px] font-medium py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded transition"
                  >
                    + Use Close-Up Prompt
                  </button>
                </div>
              )}

              {/* Legacy description fallback */}
              {legacyDesc && !pFront && !pBack && !pCloseUp && (
                <div className="bg-white p-3 rounded-xl border border-gray-200 col-span-3 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-700">General Prompt</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          description: prev.description ? `${prev.description}\n\n${legacyDesc}` : legacyDesc
                        }));
                      }}
                      className="text-[11px] text-purple-600 font-medium hover:underline"
                    >
                      Use as Description
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-gray-700 bg-gray-50 p-2 rounded">
                    {legacyDesc}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} className="w-full p-2 border rounded" rows={4} />
        {/* <input type="number" name="mrp" placeholder="MRP" value={formData.mrp} onChange={handleChange} className="w-full p-2 border rounded" required />
        <input type="number" name="price" placeholder="Price" value={formData.price } onChange={handleChange} className="w-full p-2 border rounded" required /> */}
        <DynaminFeature
        features={formData.features}
        setFeatures={(updatedFeatures) =>
          setFormData((prev) => ({ ...prev, features: updatedFeatures }))
        }
      />

      <input type="checkbox" name="isTriable" value={formData.isTriable} onChange={handleChange} className="w-full p-2 border rounded" />
      <label htmlFor="isTriable">Trial and Buy Feature</label>

      <input type="checkbox" name="isActive" value={formData.isActive} onChange={handleChange} className="w-full p-2 border rounded" />
      <label htmlFor="isActive">Is Active</label>

        <input type="text" name="tags" placeholder="Tags (comma-separated)" value={formData.tags} onChange={handleChange} className="w-full p-2 border rounded" />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
          {loading ? 'Creating...' : 'Create Product'}
        </button>

        {message && <p className="mt-2 text-center text-sm text-red-600">{message}</p>}
      </form>
    </div>
  );
}
