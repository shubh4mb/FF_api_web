import React, { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
import { getCategories, addCategory } from "../../api/categories"; // ✅ Adjust path as needed
import CropperModal from "../../components/CropperModal";
import { X, Upload, Loader2 } from "lucide-react";

const AddCategory = () => {
  // const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    level: 0,
    parentId: null,
    allowedGenders: ["MEN", "WOMEN"],
    isActive: true,
    isTriable: false,
    sortOrder: 0,
    commissionPercentage: 0,
  });

  const [images, setImages] = useState({
    image: { preview: '', file: null },
    logo: { preview: '', file: null },
    logo_MEN: { preview: '', file: null },
    logo_WOMEN: { preview: '', file: null },
    logo_KIDS: { preview: '', file: null },
  });

  const [titleBanners, setTitleBanners] = useState([]);

  const [showCropper, setShowCropper] = useState({ 
    image: false, 
    logo: false, 
    logo_MEN: false, 
    logo_WOMEN: false, 
    logo_KIDS: false, 
    title_banners: false 
  });
  const [tempImageSrc, setTempImageSrc] = useState({ 
    image: '', 
    logo: '', 
    logo_MEN: '', 
    logo_WOMEN: '', 
    logo_KIDS: '', 
    title_banners: '' 
  });

  const [allCategories, setAllCategories] = useState([]);
  const [selectedTopCategory, setSelectedTopCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        setAllCategories(response.categories || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "level" || name === "sortOrder") {
      setFormData((prev) => ({ ...prev, [name]: parseInt(value) }));
    } else if (name === "commissionPercentage") {
      setFormData((prev) => ({ ...prev, [name]: value === "" ? "" : parseFloat(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (name === 'name') {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  const handleImageChange = (e, imageType) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size should be less than 10MB');
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
        file: blob
      };
      setTitleBanners(prev => [...prev, newItem]);
    } else {
      setImages(prev => ({
        ...prev,
        [imageType]: {
          preview: URL.createObjectURL(blob),
          file: blob
        }
      }));
    }
    setShowCropper(prev => ({ ...prev, [imageType]: false }));
  };

  const removeImage = (imageType) => {
    setImages(prev => ({
      ...prev,
      [imageType]: { preview: '', file: null }
    }));
  };

  const removeTitleBanner = (idToRemove) => {
    setTitleBanners(prev => prev.filter(b => b.id !== idToRemove));
  };


  const handleLevelChange = (e) => {
    const level = parseInt(e.target.value);
    setFormData((prev) => ({
      ...prev,
      level,
      parentId: null,
    }));
    setSelectedTopCategory("");
    setSelectedSubCategory("");
  };

  const handleTopCategoryChange = (e) => {
    const topId = e.target.value;
    setSelectedTopCategory(topId);
    if (formData.level === 1) {
      setFormData((prev) => ({ ...prev, parentId: topId }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      alert('Name and slug are required');
      return;
    }

    try {
      setSaving(true);
      const submissionData = new FormData();

      submissionData.append('name', formData.name);
      submissionData.append('slug', formData.slug);
      
      // Send allowedGenders as JSON array
      submissionData.append('allowedGenders', JSON.stringify(formData.allowedGenders));
      
      submissionData.append('isActive', formData.isActive);
      submissionData.append('isTriable', formData.isTriable);
      submissionData.append('sortOrder', formData.sortOrder);
      submissionData.append('level', formData.level);

      if (formData.parentId) {
        submissionData.append('parentId', formData.parentId);
      }

      if (formData.level === 1) {
        submissionData.append('commissionPercentage', formData.commissionPercentage);
      }

      if (images.image.file) {
        submissionData.append('image', images.image.file);
      }
      if (images.logo.file) {
        submissionData.append('logo', images.logo.file);
      }

      // Add gender-specific logos
      formData.allowedGenders.forEach(gender => {
        const logo = images[`logo_${gender}`];
        if (logo && logo.file) {
          submissionData.append(`logo_${gender}`, logo.file);
        }
      });

      titleBanners.forEach(b => {
        if (b.file) {
          submissionData.append('title_banners', b.file);
        }
      });

      console.log("Submitting Form");
      const response = await addCategory(submissionData);
      console.log("Category added successfully:", response);
      alert("Category added successfully");

      // Optionally reset form here
    } catch (error) {
      alert(error.message)
      console.error("Error adding category:", error);
    } finally {
      setSaving(false);
    }
  };

  const topCategories = allCategories.filter((cat) => cat.level === 0);

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Add New Category</h2>
      <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4">

        {/* Level */}
        <div className="flex flex-col">
          <label>Category Level</label>
          <select name="level" value={formData.level} onChange={handleLevelChange} className="border p-2 rounded">
            <option value={0}>Main Category (e.g. Topwear)</option>
            <option value={1}>Sub Category (e.g. T-Shirt)</option>
          </select>
        </div>

        {/* Commission Percentage (only if Level 1 - leaf) */}
        {formData.level === 1 && (
          <div className="flex flex-col">
            <label className="font-semibold text-gray-700 mb-1">Commission Percentage (%)</label>
            <input
              type="number"
              name="commissionPercentage"
              placeholder="e.g. 15"
              value={formData.commissionPercentage}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.01"
              className="border p-2 rounded w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used to calculate platform fee on product sales in this category.
            </p>
          </div>
        )}

        {/* Top Category (for sub) */}
        {formData.level === 1 && (
          <div className="flex flex-col">
            <label>Parent Category</label>
            <select value={selectedTopCategory} onChange={handleTopCategoryChange} className="border p-2 rounded">
              <option value="">Select Parent Category</option>
              {topCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Name and Slug */}
        <input type="text" name="name" placeholder="Category Name" value={formData.name} onChange={handleChange} className="border p-2 rounded w-full" required />
        <input type="text" name="slug" placeholder="Slug" value={formData.slug} onChange={handleChange} className="border p-2 rounded w-full" required />

        {/* Allowed Genders */}
        <div className="flex flex-col">
          <label className="font-semibold text-gray-700 mb-2">Allowed Genders</label>
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
                  className="w-4 h-4"
                />
                <span>{g}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Is Active and Is Triable */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} />
            <label>Is Active</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="isTriable" checked={formData.isTriable} onChange={handleChange} />
            <label className="font-medium text-gray-700">Is Triable</label>
          </div>
        </div>

        {/* Sort Order */}
        <input type="number" name="sortOrder" value={formData.sortOrder} onChange={handleChange} className="border p-2 rounded w-full" placeholder="Sort Order" />

        {/* Image Input */}
        <div className="flex flex-col border p-4 rounded bg-gray-50">
          <label className="mb-2 font-semibold capitalize">Upload image</label>
          {images.image.preview ? (
            <div className="relative inline-block w-48 mx-auto">
              <img src={images.image.preview} alt="Category" className="w-full h-48 object-cover rounded-lg border border-gray-300" />
              <button
                type="button"
                onClick={() => removeImage('image')}
                className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Click to upload image</span>
              <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'image')} className="hidden" />
            </label>
          )}
        </div>

        {/* Gender Specific Logos */}
        {formData.allowedGenders.map(gender => (
          <div key={gender} className="flex flex-col border p-4 rounded bg-gray-50">
            <label className="mb-2 font-semibold capitalize">Upload logo for {gender}</label>
            {images[`logo_${gender}`].preview ? (
              <div className="relative inline-block w-48 mx-auto w-full">
                <img src={images[`logo_${gender}`].preview} alt={`Logo ${gender}`} className="w-full h-32 object-contain rounded-lg border border-gray-300 bg-gray-50" />
                <button
                  type="button"
                  onClick={() => removeImage(`logo_${gender}`)}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to upload logo for {gender}</span>
                <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, `logo_${gender}`)} className="hidden" />
              </label>
            )}
          </div>
        ))}

        {/* Title Banners Upload (Array) */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title Banners (Max 5)
          </label>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {titleBanners.map((banner) => (
              <div key={banner.id} className="relative group border border-gray-200 rounded bg-white flex flex-col items-center p-2 shadow-sm">
                <img src={banner.preview} alt="Banner" className="h-24 object-cover rounded mb-2 w-full" />
                <button
                  type="button"
                  onClick={() => removeTitleBanner(banner.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove banner"
                >
                  <X size={14} />
                </button>
                <span className="absolute bottom-1 left-1 text-[10px] bg-black bg-opacity-50 text-white px-1.5 py-0.5 rounded">New</span>
              </div>
            ))}

            {titleBanners.length < 5 && (
              <label className="flex flex-col items-center justify-center h-[120px] border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 min-h-24">
                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500 font-medium">Add Banner</span>
                <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'title_banners')} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Shared Cropper Modal */}
        {['image', 'logo', 'logo_MEN', 'logo_WOMEN', 'logo_KIDS', 'title_banners'].map((type) => (
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

        {/* Submit */}
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Add Category'}
        </button>
      </form>
    </div>
  );
};

export default AddCategory;
