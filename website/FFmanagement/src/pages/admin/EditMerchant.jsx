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
    backgroundImage: null,
  });

  const [loading, setLoading] = useState(true);
  const [showCropper, setShowCropper] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [croppedLogo, setCroppedLogo] = useState(null);
  const [croppedBg, setCroppedBg] = useState(null);
  const [activeCropField, setActiveCropField] = useState(null); // 'logo' or 'backgroundImage'

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
          backgroundImage: data.merchant.backgroundImage || null,
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

  const handleImageChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
      setActiveCropField(fieldName);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (blob) => {
    if (activeCropField === 'logo') {
      setCroppedLogo(blob);
      setForm({ ...form, logo: blob });
    } else if (activeCropField === 'backgroundImage') {
      setCroppedBg(blob);
      setForm({ ...form, backgroundImage: blob });
    }
    setShowCropper(false);
    setActiveCropField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = new FormData();

    payload.append("shopName", form.shopName);
    payload.append("ownerName", form.ownerName);
    payload.append("email", form.email);
    payload.append("phoneNumber", form.phoneNumber);

    if (croppedLogo) {
      payload.append("logo", croppedLogo);
    }
    if (croppedBg) {
      payload.append("backgroundImage", croppedBg);
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

        <div className="flex flex-col">
          <label className="mb-1 font-semibold">Logo</label>
          <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'logo')} />
          {form.logo?.url && !croppedLogo && (
            <img src={form.logo.url} alt="Existing Logo" className="h-20 rounded mt-2" />
          )}
          {croppedLogo && (
            <img src={URL.createObjectURL(croppedLogo)} alt="Cropped Logo Preview" className="h-20 rounded border mt-2" />
          )}
        </div>

        <div className="flex flex-col mt-4">
          <label className="mb-1 font-semibold">Background Image</label>
          <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'backgroundImage')} />
          {form.backgroundImage?.url && !croppedBg && (
            <img src={form.backgroundImage.url} alt="Existing Background" className="h-20 rounded mt-2" />
          )}
          {croppedBg && (
            <img src={URL.createObjectURL(croppedBg)} alt="Cropped Background Preview" className="h-20 rounded border mt-2" />
          )}
        </div>

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
