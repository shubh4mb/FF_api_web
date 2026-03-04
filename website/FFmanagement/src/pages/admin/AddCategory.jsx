import React, { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
import { getCategories, addCategory } from "../../api/categories"; // ✅ Adjust path as needed
import CropperModal from "../../components/CropperModal";
const AddCategory = () => {
  // const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    level: 0,
    parentId: null,
    gender: "unisex",
    isActive: true,
    sortOrder: 0,
    image: null,
    logo: null,
    title_banner: null,
  });
  const [previewUrls, setPreviewUrls] = useState({ image: null, logo: null, title_banner: null });
  const [croppedImages, setCroppedImages] = useState({ image: null, logo: null, title_banner: null });
  const [showCropper, setShowCropper] = useState({ image: false, logo: false, title_banner: false });
  const [currentCropType, setCurrentCropType] = useState(null);

  const [allCategories, setAllCategories] = useState([]);
  const [selectedTopCategory, setSelectedTopCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");

  // 🔄 Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        console.log(response, "dsfdsf")

        setAllCategories(response.categories || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "level" || name === "sortOrder") {
      setFormData((prev) => ({ ...prev, [name]: parseInt(value) }));
    } else if (type === "file") {
      const file = files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrls((prev) => ({ ...prev, [name]: reader.result }));
          setCurrentCropType(name);
          setShowCropper((prev) => ({ ...prev, [name]: true }));
        };
        reader.readAsDataURL(file);
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCropComplete = (blob) => {
    if (!currentCropType) return;
    setCroppedImages((prev) => ({ ...prev, [currentCropType]: blob }));
    setFormData((prev) => ({ ...prev, [currentCropType]: blob }));
    setShowCropper((prev) => ({ ...prev, [currentCropType]: false }));
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
    } else {
      setSelectedSubCategory("");
    }
  };

  const handleSubCategoryChange = (e) => {
    const subId = e.target.value;
    setSelectedSubCategory(subId);

    if (formData.level === 2) {
      setFormData((prev) => ({ ...prev, parentId: subId }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const submissionData = new FormData();
    for (let key in formData) {
      if (formData[key] !== null) {
        submissionData.append(key, formData[key]);
      }
    }

    console.log("Submitting Form:", Object.fromEntries(submissionData.entries()));
    // Replace this with your API call to submit the form
    // navigate("/admin/categories");
    try {
      const response = await addCategory(submissionData);
      console.log("Category added successfully:", response);
      alert("Category added successfully");
    } catch (error) {
      alert(error.message)
      console.error("Error adding category:", error);
    }
  };

  const topCategories = allCategories.filter((cat) => cat.level === 0);
  const subCategories = allCategories.filter(
    (cat) => cat.level === 1 && cat.parentId === selectedTopCategory
  );

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Add New Category</h2>
      <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4">

        {/* Level */}
        <div className="flex flex-col">
          <label>Category Level</label>
          <select name="level" value={formData.level} onChange={handleLevelChange} className="border p-2 rounded">
            <option value={0}>Top Level</option>
            <option value={1}>Sub Category</option>
            <option value={2}>Sub-Sub Category</option>
          </select>
        </div>

        {/* Top Category (for sub & sub-sub) */}
        {formData.level > 0 && (
          <div className="flex flex-col">
            <label>Top Category</label>
            <select value={selectedTopCategory} onChange={handleTopCategoryChange} className="border p-2 rounded">
              <option value="">Select Top Category</option>
              {topCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sub Category (only if adding sub-sub) */}
        {formData.level === 2 && selectedTopCategory && (
          <div className="flex flex-col">
            <label>Sub Category</label>
            <select value={selectedSubCategory} onChange={handleSubCategoryChange} className="border p-2 rounded">
              <option value="">Select Sub Category</option>
              {subCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Name and Slug */}
        <input type="text" name="name" placeholder="Category Name" value={formData.name} onChange={handleChange} className="border p-2 rounded w-full" required />
        <input type="text" name="slug" placeholder="Slug" value={formData.slug} onChange={handleChange} className="border p-2 rounded w-full" required />

        {/* Gender */}
        <select name="gender" value={formData.gender} onChange={handleChange} className="border p-2 rounded w-full">
          <option value="unisex">Unisex</option>
          <option value="men">Men</option>
          <option value="women">Women</option>
          <option value="boys">Boys</option>
          <option value="girls">Girls</option>
          <option value="babies">Babies</option>
        </select>

        {/* Is Active */}
        <div className="flex items-center gap-2">
          <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} />
          <label>Is Active</label>
        </div>

        {/* Sort Order */}
        <input type="number" name="sortOrder" value={formData.sortOrder} onChange={handleChange} className="border p-2 rounded w-full" placeholder="Sort Order" />

        {/* File Uploads */}
        {['image', 'logo', 'title_banner'].map((type) => (
          <div key={type} className="flex flex-col border p-4 rounded bg-gray-50">
            <label htmlFor={type} className="mb-2 font-semibold capitalize">
              Upload {type.replace('_', ' ')}
            </label>
            <input
              type="file"
              accept="image/*"
              name={type}
              onChange={handleChange}
              className="border p-2 rounded mb-2 bg-white"
            />
            {previewUrls[type] && !showCropper[type] && !croppedImages[type] && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">Selected {type.replace('_', ' ')}:</p>
                <img src={previewUrls[type]} alt="Preview" className="h-24 rounded" />
              </div>
            )}
            {croppedImages[type] && !showCropper[type] && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">Cropped {type.replace('_', ' ')} Preview:</p>
                <img
                  src={URL.createObjectURL(croppedImages[type])}
                  alt="Cropped"
                  className="h-24 rounded border"
                />
              </div>
            )}
          </div>
        ))}

        {currentCropType && showCropper[currentCropType] && previewUrls[currentCropType] && (
          <CropperModal
            imageSrc={previewUrls[currentCropType]}
            onClose={() => setShowCropper((prev) => ({ ...prev, [currentCropType]: false }))}
            onCropComplete={handleCropComplete}
          />
        )}

        {/* Submit */}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Add Category
        </button>
      </form>
    </div>
  );
};

export default AddCategory;
