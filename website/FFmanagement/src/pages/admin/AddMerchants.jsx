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
    logo:null,
    category:"All"
  });

    const [previewUrl, setPreviewUrl] = useState(null); // base64 preview
  const [croppedImage, setCroppedImage] = useState(null); // blob
  const [showCropper, setShowCropper] = useState(false);

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImage=(e)=>{
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);  // base64
      setShowCropper(true);          // open cropper modal
    };
    reader.readAsDataURL(file);
  }

  const handleCropComplete = (blob) => {
    setCroppedImage(blob);
    setForm((prev) => ({ ...prev, logo: blob }));
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
          category:""
        });
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

        {/* image */}
        <div className="flex flex-col">
  <label htmlFor="image" className="mb-1">Upload Image</label>
  <input
    type="file"
    accept="image/*"
    name="image"
    onChange={handleImage}
    className="border p-2 rounded"
  />
</div>
{showCropper && previewUrl && (
  <CropperModal
    imageSrc={previewUrl}
    onClose={() => setShowCropper(false)}
    onCropComplete={handleCropComplete}
  />
)}

        {previewUrl && !showCropper && (
  <div className="mt-2">
    <p className="text-sm text-gray-600">Selected Image:</p>
    <img src={previewUrl} alt="Preview" className="h-24 rounded" />
  </div>
)}

{/* Cropped Image Preview */}
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
