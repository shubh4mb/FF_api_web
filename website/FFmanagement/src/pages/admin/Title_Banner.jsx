import { useState, useEffect } from 'react';
import axios from 'axios';
import CropperModal from '@/components/CropperModal';
import { getCategories } from '../../api/categories';
import { addTitleBanner } from '../../api/title_banner';

const Title_Banner = () => {
  const [showCropper, setShowCropper] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);

  const [categories, setCategories] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    type: 'custom',
    categoryId: '',
    isActive: true,
    image: null,
  });

  const [level1Options, setLevel1Options] = useState([]);
  const [level2Options, setLevel2Options] = useState([]);

  useEffect(() => {
    const loadCategories = async () => {
      const data = await getCategories();
      console.log(data);
      
      setCategories(data.categories);
      
    };
    loadCategories();
    console.log(categories);
    
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (blob) => {
    setCroppedImage(blob);
    setFormData({ ...formData, image: blob });
  };

  const handleLevelChange = (e) => {
    const level = parseInt(e.target.value);
    setFormData((prev) => ({ ...prev, level, categoryId: '' }));
  };

  const handleCategoryChange = (e, level) => {
    const selectedId = e.target.value;

    if (level === 0) {
      const children = categories.filter((cat) => cat.parentId === selectedId && cat.level === 1);
      setLevel1Options(children);
      setLevel2Options([]);
      setFormData((prev) => ({ ...prev, categoryId: selectedId }));
    }

    if (level === 1) {
      const children = categories.filter((cat) => cat.parentId === selectedId && cat.level === 2);
      setLevel2Options(children);
      setFormData((prev) => ({ ...prev, categoryId: selectedId }));
    }

    if (level === 2) {
      setFormData((prev) => ({ ...prev, categoryId: selectedId }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.image || (formData.type === 'category' && !formData.categoryId)) return;

    setUploading(true);
    const payload = new FormData();
    payload.append('title', formData.title);
    payload.append('type', formData.type);
    if (formData.type === 'category') {
      payload.append('category', formData.categoryId);
    } else if (formData.type === 'custom') {
      // payload.append('filter', formData.filter);
    }
    // payload.append('priority', formData.priority.toString());
    payload.append('isActive', formData.isActive.toString());
    payload.append('image', formData.image);
    
    try {
      for (let [key, value] of payload.entries()) {
        console.log(`${key}:`, value);
      }
      
      
      await addTitleBanner(payload);
      alert('✅ Banner added successfully!');
      // setPreviewUrl(null);
      // setCroppedImage(null);
    } catch (err) {
      console.error(err);
      alert('❌ Failed to add banner.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Add Title Banner</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full p-3 border rounded"
        />

        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full p-3 border rounded"
        >
          <option value="custom">Custom (e.g. New Arrivals)</option>
          <option value="category">Category</option>
        </select>

        {formData.type === 'category' && (
          <>
            <select
              value={formData.level}
              onChange={handleLevelChange}
              className="w-full p-3 border rounded"
            >
              <option value={0}>Top Level</option>
              <option value={1}>Sub Category</option>
              <option value={2}>Sub-Sub Category</option>
            </select>

            <select
              onChange={(e) => handleCategoryChange(e, 0)}
              className="w-full p-3 border rounded"
            >
              <option value="">Select Top Level</option>
              {categories.filter(cat => cat.level === 0).map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>

            {formData.level >= 1 && (
              <select
                onChange={(e) => handleCategoryChange(e, 1)}
                className="w-full p-3 border rounded"
              >
                <option value="">Select Sub Category</option>
                {level1Options.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            )}

            {formData.level === 2 && (
              <select
                onChange={(e) => handleCategoryChange(e, 2)}
                className="w-full p-3 border rounded"
              >
                <option value="">Select Sub-Sub Category</option>
                {level2Options.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            )}
          </>
        )}


        {showCropper && previewUrl && (
          <CropperModal
            imageSrc={previewUrl}
            onClose={() => setShowCropper(false)}
            onCropComplete={handleCropComplete}
          />
        )}

        <div className="flex flex-col">
          <label htmlFor="image" className="mb-1">Upload Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="border p-2 rounded"
          />
        </div>

        {previewUrl && !showCropper && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">Selected Image:</p>
            <img src={previewUrl} alt="Preview" className="h-24 rounded" />
          </div>
        )}

        {croppedImage && !showCropper && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">Cropped Image Preview:</p>
            <img
              src={URL.createObjectURL(croppedImage)}
              alt="Cropped"
              className="h-24 rounded border"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-black text-white py-3 rounded hover:opacity-90"
        >
          {uploading ? 'Uploading...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default Title_Banner;
