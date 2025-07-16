import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMerchantById, updateMerchantById } from "../../api/merchants";
import CropperModal from "../../components/CropperModal";

const EditMerchant = () => {
  const { merchantId } = useParams();

  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    email: "",
    phoneNumber: "",
    logo: null, // will contain { url, public_id } or cropped blob
  });

  const [loading, setLoading] = useState(true);
  const [showCropper, setShowCropper] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);

  useEffect(() => {
    const fetchMerchant = async () => {
      try {
        const data = await getMerchantById(merchantId);
        console.log("yes reaching api : ",data);
        
        setForm({
          shopName: data.merchant.shopName || "",
          ownerName: data.merchant.ownerName || "",
          email: data.merchant.email || "",
          phoneNumber: data.merchant.phoneNumber || "",
          logo: data.merchant.logo || null,
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch merchant", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMerchant();
  }, [merchantId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (blob) => {
    setCroppedImage(blob);
    setForm({ ...form, logo: blob });
    setShowCropper(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = new FormData();

    payload.append("shopName", form.shopName);
    payload.append("ownerName", form.ownerName);
    payload.append("email", form.email);
    payload.append("phoneNumber", form.phoneNumber);

    if (croppedImage) {
      payload.append("logo", croppedImage);
    }

    try {
      await updateMerchantById(merchantId, payload);
      alert("✅ Merchant updated");
    } catch (err) {
      console.error("Update failed", err);
      alert("❌ Error updating merchant");
    }
  };

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-4">Edit Merchant</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="shopName"
          value={form.shopName}
          onChange={handleChange}
          className="w-full border p-2"
          placeholder="Shop Name"
        />
        <input
          name="ownerName"
          value={form.ownerName}
          onChange={handleChange}
          className="w-full border p-2"
          placeholder="Owner Name"
        />
        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          className="w-full border p-2"
          placeholder="Email"
        />
        <input
          name="phoneNumber"
          value={form.phoneNumber}
          onChange={handleChange}
          className="w-full border p-2"
          placeholder="Phone Number"
        />

        <input type="file" accept="image/*" onChange={handleImageChange} />

        {/* Existing image from DB */}
        {form.logo?.url && !previewUrl && !showCropper && (
          <img src={form.logo.url} alt="Existing Logo" className="h-20 rounded" />
        )}

        {/* Newly selected image before cropping */}
        {previewUrl && !showCropper && (
          <img src={previewUrl} alt="Preview" className="h-20 rounded" />
        )}

        {showCropper && previewUrl && (
          <CropperModal
            imageSrc={previewUrl}
            onCropComplete={handleCropComplete}
            onClose={() => setShowCropper(false)}
          />
        )}

        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Save Changes
        </button>
      </form>
    </div>
  );
};

export default EditMerchant;
