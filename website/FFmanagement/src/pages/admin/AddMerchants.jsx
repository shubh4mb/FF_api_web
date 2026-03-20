// src/pages/AddMerchant.jsx
import {addMerchant} from "../../api/merchants";
import CropperModal from "../../components/CropperModal";

import { useState } from "react";

const AddMerchants = () => {
  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    email: "",
    phoneNumber: "",
    password: "",
    logo: null,
    backgroundImage: null,
    category:"All"
  });

  const [previewUrl, setPreviewUrl] = useState(null); // base64 preview
  const [croppedImage, setCroppedImage] = useState(null); // blob
  const [activeCropField, setActiveCropField] = useState(null); // 'logo' or 'backgroundImage'
  const [showCropper, setShowCropper] = useState(false);

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImage = (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);  // base64
      setActiveCropField(fieldName); // determine which field is cropping
      setShowCropper(true);          // open cropper modal
    };
    reader.readAsDataURL(file);
  }

  const handleCropComplete = (blob) => {
    if (activeCropField === 'logo') {
      setCroppedImage(blob); // kept for backward compatibility if needed
      setForm((prev) => ({ ...prev, logo: blob }));
    } else if (activeCropField === 'backgroundImage') {
      setForm((prev) => ({ ...prev, backgroundImage: blob }));
    }
    setActiveCropField(null);
    setShowCropper(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Submitting...");

    try {
      const res = await addMerchant(form);
          if (res.ok) {
        setMessage("Merchant added successfully.");
        setForm({
          shopName: "",
          ownerName: "",
          email: "",
          phoneNumber: "",
          password: "",
          logo: null,
          backgroundImage: null,
          category:"All"
        });
        setPreviewUrl(null);
        setCroppedImage(null);
      } else {
        setMessage(`Error: ${res.message || "Something went wrong"}`);
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      setMessage("Error connecting to server.");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Add Merchant</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="shopName"
          placeholder="Shop Name"
          value={form.shopName}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="text"
          name="ownerName"
          placeholder="Owner Name"
          value={form.ownerName}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="tel"
          name="phoneNumber"
          placeholder="Phone Number"
          value={form.phoneNumber}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
  <select
  name="category"
  value={form.category}
  onChange={handleChange}
  className="w-full p-2 border rounded"
  required
>
  <option value="">Select Category</option>
  <option value="All">All</option>
  <option value="Men">Men</option>
  <option value="Women">Women</option>
  <option value="Kids">Kids</option>
</select>

        {/* Logo Image */}
        <div className="flex flex-col">
          <label htmlFor="logo" className="mb-1">Upload Logo</label>
          <input
            type="file"
            accept="image/*"
            name="logo"
            onChange={(e) => handleImage(e, 'logo')}
            className="border p-2 rounded"
          />
        </div>

        {form.logo && !showCropper && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">Cropped Logo Preview:</p>
            <img
              src={URL.createObjectURL(form.logo)}
              alt="Cropped Logo"
              className="h-24 rounded border"
            />
          </div>
        )}

        {/* Background Image */}
        <div className="flex flex-col">
          <label htmlFor="backgroundImage" className="mb-1">Upload Background Image</label>
          <input
            type="file"
            accept="image/*"
            name="backgroundImage"
            onChange={(e) => handleImage(e, 'backgroundImage')}
            className="border p-2 rounded"
          />
        </div>

        {form.backgroundImage && !showCropper && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">Cropped Background Image Preview:</p>
            <img
              src={URL.createObjectURL(form.backgroundImage)}
              alt="Cropped Background"
              className="h-24 rounded border"
            />
          </div>
        )}

        {showCropper && previewUrl && (
          <CropperModal
            imageSrc={previewUrl}
            onClose={() => setShowCropper(false)}
            onCropComplete={handleCropComplete}
          />
        )}
        
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add Merchant
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
    </div>
  );
};

export default AddMerchants;
