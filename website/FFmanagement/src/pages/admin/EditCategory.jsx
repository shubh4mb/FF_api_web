import { useState, useEffect } from 'react';
import { Upload, X, Loader2, AlertCircle, Check } from 'lucide-react';
import { useParams } from 'react-router-dom';
// import { getCategoryById, getCategories, updateCategory } from '../../api/categories';
// import CropperModal from '../../components/CropperModal';

export default function EditCategoryPage() {
  const { categoryId } = useParams();
//   const id = 'REPLACE_WITH_YOUR_ROUTER_PARAM'; // Replace with useParams() or your routing solution
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
    gender: 'unisex',
    isActive: true,
    sortOrder: 0,
  });
  
  const [parentCategoryName, setParentCategoryName] = useState('');
  
  const [images, setImages] = useState({
    image: { preview: '', file: null, existing: null },
    title_banner: { preview: '', file: null, existing: null }
  });

  const [showCropper, setShowCropper] = useState({ image: false, title_banner: false });
  const [tempImageSrc, setTempImageSrc] = useState({ image: '', title_banner: '' });

  useEffect(() => {
    loadCategory();
    loadCategories();
  }, [categoryId]);

  const loadCategory = async () => {
    try {
      setLoading(true);
      // Uncomment and use your actual import
      // const data = await getCategoryById(id);
      
      // Mock data - remove this when using real API
      const data = {
        _id: '123',
        name: 'Electronics',
        slug: 'electronics',
        parentId: '1',
        level: 1,
        gender: 'unisex',
        isActive: true,
        sortOrder: 0,
        image: {
          public_id: 'sample_image',
          url: 'https://via.placeholder.com/400x300?text=Category+Image'
        },
        title_banner: {
          public_id: 'sample_banner',
          url: 'https://via.placeholder.com/1200x300?text=Title+Banner'
        }
      };
      
      setFormData({
        name: data.name,
        slug: data.slug,
        parentId: data.parentId || '',
        level: data.level,
        gender: data.gender || 'unisex',
        isActive: data.isActive,
        sortOrder: data.sortOrder || 0,
      });
      
      setImages({
        image: { 
          preview: data.image?.url || '', 
          file: null, 
          existing: data.image 
        },
        title_banner: { 
          preview: data.title_banner?.url || '', 
          file: null, 
          existing: data.title_banner 
        }
      });
      
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
      // Uncomment and use your actual import
      // const response = await getCategories();
      
      // Mock data - remove this when using real API
      const response = {
        categories: [
          { _id: '1', name: 'Top Level Category 1', level: 0 },
          { _id: '2', name: 'Top Level Category 2', level: 0 },
          { _id: '3', name: 'Sub Category 1', level: 1, parentId: '1' }
        ]
      };
      
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
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Auto-generate slug from name
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
  };

  const handleCropComplete = (blob, imageType) => {
    setImages(prev => ({
      ...prev,
      [imageType]: {
        preview: URL.createObjectURL(blob),
        file: blob,
        existing: prev[imageType].existing
      }
    }));
    setShowCropper(prev => ({ ...prev, [imageType]: false }));
  };

  const removeImage = (imageType) => {
    setImages(prev => ({
      ...prev,
      [imageType]: { preview: '', file: null, existing: null }
    }));
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
      submitData.append('gender', formData.gender);
      submitData.append('isActive', formData.isActive);
      submitData.append('sortOrder', formData.sortOrder);
      
      if (images.image.file) {
        submitData.append('image', images.image.file);
      }
      if (images.title_banner.file) {
        submitData.append('title_banner', images.title_banner.file);
      }
      
      // Uncomment and use your actual import
      // await updateCategory(id, submitData);
      
      // Mock API call - remove this when using real API
      console.log('Submitting:', Object.fromEntries(submitData.entries()));
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
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
                {formData.level === 0 ? 'Top Level' : formData.level === 1 ? 'Sub Category' : 'Sub-Sub Category'}
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

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="unisex">Unisex</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="babies">Babies</option>
              </select>
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
            
            {/* Title Banner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title Banner
              </label>
              {images.title_banner.preview ? (
                <div className="relative inline-block w-full">
                  <img
                    src={images.title_banner.preview}
                    alt="Banner"
                    className="w-full h-32 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage('title_banner')}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload banner</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'title_banner')}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Cropper Modals */}
            {showCropper.image && tempImageSrc.image && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-4 rounded-lg">
                  <p>CropperModal component goes here</p>
                  <p className="text-sm text-gray-500">Import your CropperModal component</p>
                  <button
                    onClick={() => setShowCropper(prev => ({ ...prev, image: false }))}
                    className="mt-2 px-4 py-2 bg-gray-200 rounded"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {showCropper.title_banner && tempImageSrc.title_banner && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-4 rounded-lg">
                  <p>CropperModal component goes here</p>
                  <p className="text-sm text-gray-500">Import your CropperModal component</p>
                  <button
                    onClick={() => setShowCropper(prev => ({ ...prev, title_banner: false }))}
                    className="mt-2 px-4 py-2 bg-gray-200 rounded"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
            
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