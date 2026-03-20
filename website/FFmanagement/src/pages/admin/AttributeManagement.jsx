import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, PlusCircle, AlertCircle, Loader2, Filter, Tag } from 'lucide-react';
import { getAttributes, createAttribute, updateAttribute, deleteAttribute } from '../../api/attributes';
import { getCategories } from '../../api/categories';

const INPUT_TYPE_LABELS = {
    select: 'Dropdown Select',
    multiselect: 'Multi-Select',
    text: 'Free Text',
    number: 'Numeric',
    boolean: 'True / False',
};

const INPUT_TYPE_COLORS = {
    select: 'bg-blue-100 text-blue-700',
    multiselect: 'bg-purple-100 text-purple-700',
    text: 'bg-amber-100 text-amber-700',
    number: 'bg-emerald-100 text-emerald-700',
    boolean: 'bg-pink-100 text-pink-700',
};

// ─── Attribute Form Modal ───
const AttributeFormModal = ({ isOpen, onClose, onSubmit, editingAttribute, categories, saving, error }) => {
    const initialFormData = {
        name: '',
        categoryId: '',
        inputType: 'select',
        isFilterable: false,
        isRequired: false,
        values: [{ label: '', value: '' }]
    };

    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        if (isOpen) {
            if (editingAttribute) {
                setFormData({
                    name: editingAttribute.name || '',
                    categoryId: editingAttribute.categoryId?._id || editingAttribute.categoryId || '',
                    inputType: editingAttribute.inputType || 'select',
                    isFilterable: editingAttribute.isFilterable || false,
                    isRequired: editingAttribute.isRequired || false,
                    values: editingAttribute.values && editingAttribute.values.length > 0
                        ? editingAttribute.values.map(v => ({ label: v.label, value: v.value }))
                        : [{ label: '', value: '' }]
                });
            } else {
                setFormData(initialFormData);
            }
        }
    }, [editingAttribute, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'inputType' && ['text', 'number', 'boolean'].includes(value)) {
            setFormData(prev => ({ ...prev, [name]: value, values: [] }));
        } else if (name === 'inputType' && ['select', 'multiselect'].includes(value) && formData.values.length === 0) {
            setFormData(prev => ({ ...prev, [name]: value, values: [{ label: '', value: '' }] }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const addValueRow = () => {
        setFormData(prev => ({ ...prev, values: [...prev.values, { label: '', value: '' }] }));
    };

    const removeValueRow = (index) => {
        setFormData(prev => {
            const newValues = prev.values.filter((_, i) => i !== index);
            return { ...prev, values: newValues.length > 0 ? newValues : [{ label: '', value: '' }] };
        });
    };

    const handleValueChange = (index, field, val) => {
        setFormData(prev => {
            const newValues = [...prev.values];
            newValues[index] = { ...newValues[index], [field]: val };
            if (field === 'label') {
                newValues[index].value = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
            }
            return { ...prev, values: newValues };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanedValues = formData.values.filter(v => v.label.trim() && v.value.trim());
        const payload = {
            ...formData,
            values: ['select', 'multiselect'].includes(formData.inputType) ? cleanedValues : undefined
        };
        onSubmit(payload);
    };

    const showValues = ['select', 'multiselect'].includes(formData.inputType);
    const level2Categories = categories.filter(cat => cat.level === 1);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-gray-800">
                        {editingAttribute ? 'Edit Attribute' : 'New Attribute'}
                    </h2>
                    <button type="button" onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Attribute Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    required
                                    placeholder="e.g. Fit, Material, Style"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                                <select
                                    name="categoryId"
                                    value={formData.categoryId}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    required
                                >
                                    <option value="">Select a category</option>
                                    {level2Categories.map(cat => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Input Type <span className="text-red-500">*</span></label>
                            <select
                                name="inputType"
                                value={formData.inputType}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                required
                            >
                                {Object.entries(INPUT_TYPE_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input type="checkbox" name="isFilterable" checked={formData.isFilterable} onChange={handleChange} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                <span className="text-sm text-gray-700">Filterable</span>
                            </label>
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input type="checkbox" name="isRequired" checked={formData.isRequired} onChange={handleChange} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                <span className="text-sm text-gray-700">Required</span>
                            </label>
                        </div>

                        {showValues && (
                            <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-700">Options <span className="text-red-500">*</span></label>
                                    <button type="button" onClick={addValueRow} className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-blue-700 transition">
                                        <PlusCircle className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>
                                <div className="flex gap-2 px-1">
                                    <span className="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Label</span>
                                    <span className="flex-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Value (auto)</span>
                                    <span className="w-8"></span>
                                </div>
                                <div className="space-y-2">
                                    {formData.values.map((val, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input type="text" placeholder="Slim" value={val.label} onChange={(e) => handleValueChange(idx, 'label', e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                            <input type="text" placeholder="slim" value={val.value} readOnly className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" />
                                            <button type="button" onClick={() => removeValueRow(idx)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 transition">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {saving ? 'Saving...' : (editingAttribute ? 'Update' : 'Create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Main Page ───
const AttributeManagement = () => {
    const [attributes, setAttributes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    const [success, setSuccess] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAttribute, setEditingAttribute] = useState(null);
    const [filterCategory, setFilterCategory] = useState('');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [attrRes, catRes] = await Promise.all([getAttributes(), getCategories()]);

            // Handle different possible response structures from attrRes (Axios returning response.data)
            // It might be attrRes.data.attributes or just attrRes.attributes based on how the backend sends it
            const attrs = attrRes?.data?.attributes || attrRes?.attributes || [];
            setAttributes(attrs);

            // Handle categories response
            const cats = catRes?.data?.categories || catRes?.categories || [];
            setCategories(cats);
        } catch (err) {
            setError('Failed to load data. Please refresh.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (attribute = null) => {
        setEditingAttribute(attribute);
        setModalError('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingAttribute(null);
        setModalError('');
    };

    const handleSubmit = async (payload) => {
        setModalError('');
        try {
            setSaving(true);
            if (editingAttribute) {
                await updateAttribute(editingAttribute._id, payload);
                setSuccess('Attribute updated!');
            } else {
                await createAttribute(payload);
                setSuccess('Attribute created!');
            }
            closeModal();
            fetchData();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setModalError(err.message || 'Failed to save attribute');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await deleteAttribute(id);
            setSuccess('Attribute deleted!');
            fetchData();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Failed to delete');
        }
    };

    const filteredAttributes = filterCategory
        ? attributes.filter(a => (a.categoryId?._id || a.categoryId) === filterCategory)
        : attributes;

    const level2Categories = categories.filter(c => c.level === 1);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full min-h-[400px] gap-3">
                <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                <p className="text-sm text-gray-500">Loading attributes...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Product Attributes</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage attributes like Fit, Material, Size for your categories</p>
                </div>
                <button onClick={() => openModal()} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition text-sm font-medium shadow-sm">
                    <Plus className="w-4 h-4" /> Add Attribute
                </button>
            </div>

            {/* Alerts */}
            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center justify-between text-sm">
                    <span>✓ {success}</span>
                    <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
                </div>
            )}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>
                    <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="mb-4 flex items-center gap-3">
                <Filter className="w-4 h-4 text-gray-400" />
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">All Categories</option>
                    {level2Categories.map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                </select>
                <span className="text-xs text-gray-500">{filteredAttributes.length} attribute(s)</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Options</th>
                            <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Flags</th>
                            <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredAttributes.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-5 py-12 text-center">
                                    <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No attributes found</p>
                                    <p className="text-gray-400 text-sm mt-1">Click "Add Attribute" to create one</p>
                                </td>
                            </tr>
                        ) : (
                            filteredAttributes.map((attr) => (
                                <tr key={attr._id} className="hover:bg-blue-50/30 transition">
                                    <td className="px-5 py-4">
                                        <span className="font-medium text-gray-900">{attr.name}</span>
                                        <span className="block text-xs text-gray-400 mt-0.5">{attr.slug}</span>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-600">{attr.categoryId?.name || '—'}</td>
                                    <td className="px-5 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${INPUT_TYPE_COLORS[attr.inputType] || 'bg-gray-100 text-gray-600'}`}>
                                            {INPUT_TYPE_LABELS[attr.inputType] || attr.inputType}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        {attr.values && attr.values.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {attr.values.slice(0, 4).map((v, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">{v.label}</span>
                                                ))}
                                                {attr.values.length > 4 && (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs border border-gray-200">+{attr.values.length - 4}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs italic">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex gap-1.5">
                                            {attr.isFilterable && <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium">Filter</span>}
                                            {attr.isRequired && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs font-medium">Required</span>}
                                            {!attr.isFilterable && !attr.isRequired && <span className="text-gray-400 text-xs">—</span>}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openModal(attr)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(attr._id, attr.name)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <AttributeFormModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onSubmit={handleSubmit}
                editingAttribute={editingAttribute}
                categories={categories}
                saving={saving}
                error={modalError}
            />
        </div>
    );
};

export default AttributeManagement;
