import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  PencilLine, FileText, Image as ImageIcon, AlertCircle, CheckCircle, X,
  Upload, Scissors
} from 'lucide-react';
import { getCollections, createCollection, updateCollection, deleteCollection } from '../../api/collections';
import ImageCropper from '../../components/common/ImageCropper';

export default function CollectionManagement() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await getCollections();
      setCollections(res?.collections || []);
    } catch (err) {
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
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
      formData.append('description', data.description);
      formData.append('priority', data.priority);
      formData.append('isActive', data.isActive);
      
      if (data.bannerImageFile) {
        formData.append('bannerImage', data.bannerImageFile);
      }

      if (editingCollection) {
        await updateCollection(editingCollection._id, formData);
        setSuccess('Collection updated successfully');
      } else {
        await createCollection(formData);
        setSuccess('Collection created successfully');
      }
      setShowForm(false);
      setEditingCollection(null);
      await fetchCollections();
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
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Collections</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage admin-defined curated collections for discovery</p>
        </div>
        <button
          onClick={() => { setEditingCollection(null); setShowForm(true); }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-95 shadow-blue-500/20"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #2563EB)' }}
        >
          <Plus size={18} /> Create Collection
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold mb-6 animate-in slide-in-from-top-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-100 text-green-600 text-sm font-semibold mb-6 animate-in slide-in-from-top-2">
          <CheckCircle size={18} /> {success}
        </div>
      )}

      {/* Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="font-medium">Loading collections...</span>
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
          <Tag size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600 mb-1">No Collections Found</h3>
          <p className="text-sm text-slate-400 mb-6 font-medium">Start by creating your first curated collection</p>
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
            <CollectionCard
              key={collection._id}
              collection={collection}
              onToggle={() => handleToggle(collection)}
              onEdit={(c) => { setEditingCollection(c); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <CollectionFormModal
          collection={editingCollection}
          submitting={submitting}
          onSubmit={handleFormSubmit}
          onClose={() => { setShowForm(false); setEditingCollection(null); }}
        />
      )}
    </div>
  );
}

function CollectionCard({ collection, onToggle, onEdit, onDelete }) {
  return (
    <div className={`group bg-white rounded-[32px] border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden h-full flex flex-col ${collection.isActive ? 'border-slate-100 shadow-xl shadow-slate-200/50' : 'border-slate-100 opacity-80 grayscale-[0.3]'}`}>
      <div className="aspect-[21/9] w-full bg-slate-100 relative overflow-hidden">
        {collection.bannerImage?.url ? (
          <img src={collection.bannerImage.url} alt={collection.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon size={32} />
          </div>
        )}
        <div className="absolute top-4 right-4">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg backdrop-blur-md ${collection.isActive ? 'bg-green-500/90 text-white' : 'bg-slate-700/90 text-white'}`}>
                {collection.isActive ? 'Active' : 'Hidden'}
            </span>
        </div>
      </div>
      
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight group-hover:text-blue-600 transition-colors uppercase">{collection.name}</h3>
          <span className="text-[10px] font-black tracking-wider text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full uppercase">Priority {collection.priority}</span>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed font-medium mb-8 line-clamp-3 flex-1 italic">
          {collection.description || 'No description provided for this collection.'}
        </p>

        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto">
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(collection)} className="p-3 rounded-2xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100">
              <Pencil size={18} />
            </button>
            <button onClick={() => onDelete(collection._id)} className="p-3 rounded-2xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100">
              <Trash2 size={18} />
            </button>
          </div>
          
          <button 
            onClick={onToggle}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black tracking-wide uppercase transition-all ${collection.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:scale-105'}`}
          >
            {collection.isActive ? <><ToggleRight size={18} className="text-green-500" /> Live</> : <><ToggleLeft size={18} /> Activate</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function CollectionFormModal({ collection, submitting, onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: collection?.name || '',
    description: collection?.description || '',
    priority: collection?.priority || 0,
    isActive: collection?.isActive !== undefined ? collection.isActive : true,
    bannerImageFile: null,
    bannerImagePreview: collection?.bannerImage?.url || null
  });

  const [selectFile, setSelectFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

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

  const cancelCrop = () => {
    setShowCropper(false);
    setSelectFile(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) return;
    onSubmit(form);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto scrollbar-hide">
          <div className="p-10">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">
                  {collection ? 'Edit Selection' : 'New Collection'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <span className="w-8 h-1 bg-blue-500 rounded-full"></span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Curated Discovery</p>
                </div>
              </div>
              <button onClick={onClose} className="p-3 rounded-2xl hover:bg-slate-100 transition-colors group">
                <X size={20} className="text-slate-400 group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Collection Name *</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <PencilLine size={20} />
                    </div>
                    <input 
                      value={form.name} 
                      onChange={(e) => setForm({...form, name: e.target.value})} 
                      placeholder="e.g. SUMMER ESSENTIALS 2026" 
                      className="w-full pl-14 pr-6 py-4.5 rounded-[20px] border border-slate-100 bg-slate-50/50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300 placeholder:italic"
                      required 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Curator's Description</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-5 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <FileText size={20} />
                    </div>
                    <textarea 
                      value={form.description} 
                      onChange={(e) => setForm({...form, description: e.target.value})} 
                      placeholder="Share the vibe of this collection..." 
                      className="w-full pl-14 pr-6 py-5 rounded-[20px] border border-slate-100 bg-slate-50/50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[120px] placeholder:text-slate-300 placeholder:italic"
                      rows={4}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Global Priority</label>
                    <input 
                      type="number" 
                      value={form.priority} 
                      onChange={(e) => setForm({...form, priority: Number(e.target.value)})} 
                      placeholder="0"
                      className="w-full px-6 py-4.5 rounded-[20px] border border-slate-100 bg-slate-50/50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Visibility</label>
                    <button
                      type="button"
                      onClick={() => setForm({...form, isActive: !form.isActive})}
                      className={`w-full py-4.5 rounded-[20px] border flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest transition-all ${form.isActive ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {form.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      {form.isActive ? 'Live' : 'Draft'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">Discovery Banner (21:9)</label>
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
                      className="w-full aspect-[21/9] rounded-[24px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group relative overflow-hidden"
                    >
                        {form.bannerImagePreview ? (
                            <>
                                <img src={form.bannerImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                                    <div className="p-3 bg-white/20 rounded-full backdrop-blur-md">
                                        <Scissors size={20} />
                                    </div>
                                    <span className="font-black text-[10px] uppercase tracking-widest">Update Banner</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all border border-slate-100">
                                    <Upload size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Banner</p>
                                    <p className="text-[9px] font-bold text-slate-300 mt-1 uppercase tracking-tighter">JPG, PNG (MAX 5MB)</p>
                                </div>
                            </>
                        )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-6 rounded-[24px] text-sm font-black text-white hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-3 uppercase tracking-[0.2em]"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}
                >
                  {submitting ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processing</>
                    ) : collection ? 'Save Update' : 'Publish Collection'}
                </button>
                <p className="text-center text-[10px] font-bold text-slate-400 mt-6 uppercase tracking-widest">
                    Changes will be reflect instantly on mobile apps
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {showCropper && (
        <ImageCropper
          image={selectFile}
          onCropComplete={onCropComplete}
          onCancel={cancelCrop}
          aspectRatio={21 / 9}
        />
      )}
    </>
  );
}
