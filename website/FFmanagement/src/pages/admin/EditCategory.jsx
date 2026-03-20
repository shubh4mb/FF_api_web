import { useState, useEffect } from 'react';
import { Upload, X, Loader2, AlertCircle, Check } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { getCategoryById, getCategories, updateCategory } from '../../api/categories';
import CropperModal from '../../components/CropperModal';

export default function EditCategoryPage() {
  const { categoryId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [allCategories, setAllCategories] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    parentId: '',
    level: 0,
    allowedGenders: ['MEN', 'WOMEN'],
    isActive: true,
    isTriable: false,
    sortOrder: 0,
    commissionPercentage: 0,
  });

  const [parentCategoryName, setParentCategoryName] = useState('');

  const [images, setImages] = useState({
    image: { preview: '', file: null, existing: null },
    logo: { preview: '', file: null, existing: null },
  });

  // titleBanners state holds array of: { id, preview, file, existing }
  const [titleBanners, setTitleBanners] = useState([]);

  const [showCropper, setShowCropper] = useState({ image: false, logo: false, title_banners: false });
  const [tempImageSrc, setTempImageSrc] = useState({ image: '', logo: '', title_banners: '' });

  useEffect(() => {
    loadCategory();
    loadCategories();
  }, [categoryId]);

  const loadCategory = async () => {
    try {
      setLoading(true);
      const res = await getCategoryById(categoryId);
      const data = res.category || res;

      setFormData({
        name: data.name || '',
        slug: data.slug || '',
        parentId: data.parentId || '',
        level: data.level || 0,
        allowedGenders: data.allowedGenders || ['MEN', 'WOMEN'],
        isActive: data.isActive !== undefined ? data.isActive : true,
        isTriable: data.isTriable !== undefined ? data.isTriable : false,
        sortOrder: data.sortOrder || 0,
        commissionPercentage: data.commissionPercentage || 0,
      });

      setImages({
        image: {
          preview: data.image?.url || '',
          file: null,
          existing: data.image
        },
        logo: {
          preview: data.logo?.url || '',
          file: null,
          existing: data.logo
        }
      });

      // Load existing array of banners
      const existingBanners = data.title_banners || [];
      const formattedBanners = existingBanners.map((b, i) => ({
        id: b.public_id || `existing-${i}`,
        preview: b.url,
        file: null,
        existing: b
      }));
      setTitleBanners(formattedBanners);

      setError('');
    } catch (err) {
      setError('Failed to load category data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await getCategories();
      setAllCategories(response.categories || []);
    } catch (err) {
      console.error('Failed to load categories');
    }
  };

  useEffect(() => {
    if (formData.parentId && allCategories.length > 0) {
      const parent = allCategories.find(cat => cat._id === formData.parentId);
      setParentCategoryName(parent?.name || 'Unknown Category');
    } else {
      setParentCategoryName('None (Top Level)');
    }
  }, [formData.parentId, allCategories]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'sortOrder') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) }));
    } else if (name === 'commissionPercentage') {
      setFormData(prev => ({ ...prev, [name]: value === "" ? "" : parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (name === 'name') {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  const handleImageChange = (e, imageType) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageSrc(prev => ({ ...prev, [imageType]: reader.result }));
        setShowCropper(prev => ({ ...prev, [imageType]: true }));
      };
      reader.readAsDataURL(file);
    }
    e.target.value = null; // reset to allow repeated selection
  };

  const handleCropComplete = (blob, imageType) => {
    if (imageType === 'title_banners') {
      const newItem = {
        id: Date.now().toString(),
        preview: URL.createObjectURL(blob),
        file: blob,
        existing: null
      };
      setTitleBanners(prev => [...prev, newItem]);
    } else {
      setImages(prev => ({
        ...prev,
        [imageType]: {
          preview: URL.createObjectURL(blob),
          file: blob,
          existing: prev[imageType].existing
        }
      }));
    }
    setShowCropper(prev => ({ ...prev, [imageType]: false }));
  };

  const removeImage = (imageType) => {
    setImages(prev => ({
      ...prev,
      [imageType]: { preview: '', file: null, existing: null }
    }));
  };

  const removeTitleBanner = (idToRemove) => {
    setTitleBanners(prev => prev.filter(b => b.id !== idToRemove));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug) {
      setError('Name and slug are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess(false);

      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('slug', formData.slug);
      
      submitData.append('allowedGenders', JSON.stringify(formData.allowedGenders));
      
      submitData.append('isActive', formData.isActive);
      submitData.append('isTriable', formData.isTriable);
      submitData.append('sortOrder', formData.sortOrder);

      if (formData.level === 1) {
        submitData.append('commissionPercentage', formData.commissionPercentage);
      }

      if (images.image.file) {
        submitData.append('image', images.image.file);
      }
      if (images.logo.file) {
        submitData.append('logo', images.logo.file);
      }

      // Existing Banners Retained (sent as JSON text block)
      const existingBannersToKeep = titleBanners
        .filter(b => b.existing)
        .map(b => b.existing);
      submitData.append('existing_title_banners', JSON.stringify(existingBannersToKeep));

      // New Banner Files
      titleBanners.forEach(b => {
        if (b.file) {
          submitData.append('title_banners', b.file);
        }
      });

      await updateCategory(categoryId, submitData);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Reload the data to sync with backend 
      loadCategory();

    } catch (err) {
      setError(err.message || 'Failed to update category');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Category</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-green-800">Category updated successfully!</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Level - Read Only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Level
              </label>
              <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
              {formData.level === 0 ? 'Main Category' : 'Sub Category'}
              </div>
            </div>

            {/* Parent Category - Read Only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Category
              </label>
              <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                {parentCategoryName}
              </div>
            </div>

            {/* Commission Percentage (Level 1 - leaf) */}
            {formData.level === 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Percentage (%) *
                </label>
                <input
                  type="number"
                  name="commissionPercentage"
                  value={formData.commissionPercentage}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">Used to calculate platform fee on product sales in this category.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slug *
              </label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-sm text-gray-500">URL-friendly version of the name</p>
            </div>

            {/* Allowed Genders */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allowed Genders
              </label>
              <div className="flex gap-4">
                {['MEN', 'WOMEN', 'KIDS'].map(g => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedGenders.includes(g)}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          allowedGenders: e.target.checked
                            ? [...prev.allowedGenders, g]
                            : prev.allowedGenders.filter(x => x !== g)
                        }));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{g}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort Order
              </label>
              <input
                type="number"
                name="sortOrder"
                value={formData.sortOrder}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Is Active
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isTriable"
                  checked={formData.isTriable}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Is Triable
                </label>
              </div>
            </div>

            {/* Category Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Image
              </label>
              {images.image.preview ? (
                <div className="relative inline-block">
                  <img
                    src={images.image.preview}
                    alt="Category"
                    className="w-full max-w-md h-48 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage('image')}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'image')}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo
              </label>
              {images.logo.preview ? (
                <div className="relative inline-block w-full">
                  <img
                    src={images.logo.preview}
                    alt="Logo"
                    className="w-full h-32 object-contain rounded-lg border border-gray-300 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage('logo')}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'logo')}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Title Banners Upload (Array) */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title Banners (Max 5)
              </label>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {titleBanners.map((banner) => (
                  <div key={banner.id} className="relative group border border-gray-200 rounded bg-white flex flex-col items-center p-2 shadow-sm">
                    <img
                      src={banner.preview}
                      alt="Banner"
                      className="h-24 object-cover rounded mb-2 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => removeTitleBanner(banner.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove banner"
                    >
                      <X size={14} />
                    </button>
                    {/* Tiny badge indicating type */}
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black bg-opacity-50 text-white px-1.5 py-0.5 rounded">
                      {banner.existing ? 'Existing' : 'New'}
                    </span>
                  </div>
                ))}

                {titleBanners.length < 5 && (
                  <label className="flex flex-col items-center justify-center h-[120px] border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 min-h-24">
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500 font-medium">Add Banner</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange(e, 'title_banners')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Shared Cropper Modal */}
            {['image', 'logo', 'title_banners'].map((type) => (
              showCropper[type] && tempImageSrc[type] && (
                <div key={type} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-4 rounded-lg w-full max-w-2xl">
                    <CropperModal
                      imageSrc={tempImageSrc[type]}
                      onClose={() => setShowCropper(prev => ({ ...prev, [type]: false }))}
                      onCropComplete={(blob) => handleCropComplete(blob, type)}
                    />
                  </div>
                </div>
              )
            ))}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Updating...' : 'Update Category'}
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}