import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBaseProductById  , addVariant} from '@/api/products';
import DynamicSizesInput from '@/components/commmon/DynamicSizesInput';
import CropperModal from '@/components/CropperModal';

const Variants = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(null);
  const [variantForm, setVariantForm] = useState(getEmptyVariantForm());
   const [previewUrl, setPreviewUrl] = useState(null); // base64 preview
  const [croppedImage, setCroppedImage] = useState(null); // blob
  const [showCropper, setShowCropper] = useState(false);
  const [images, setImages] = useState([]); // list of blobs
const [previewQueue, setPreviewQueue] = useState([]); // for multiple previews



  function getEmptyVariantForm() {
    return {
      color: { name: '', hex: '' },
      sizes: [{ size: '', stock: 0 }],
      images: [],
      mainImage: { public_id: '', url: '' },
      discount: 0,
      mrp: 0,
      price: 0,
    };
  }

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await getBaseProductById(productId);
        setProduct(res);
        if (res.variants?.length) {
          setSelectedVariantIndex(0);
          setVariantForm(res.variants[0]);
        } else {
          setSelectedVariantIndex(null);
          setVariantForm(getEmptyVariantForm());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProduct();
  }, [productId]);

  const handleSelectVariant = (index) => {
    setSelectedVariantIndex(index);
    setVariantForm(product.variants[index]);
  };

  // Call this when image is cropped and uploaded
// const handleImageCropped = (croppedImage) => {
//     setVariantForm((prev) => ({
//       ...prev,
//       mainImage: croppedImage, // { public_id, url }
//     }));
//     setCropperOpen(false);
//   };
  

  const handleChange = (e) => {
    const { name, value ,type } = e.target;

      // Convert numeric values safely
  const numericFields = ["mrp", "price", "discount"];
  const parsedValue = numericFields.includes(name) ? Number(value) : value;

  setVariantForm((prev) => ({
    ...prev,
    [name]: parsedValue,
  }));



    if (type === "file") {
      const files = Array.from(e.target.files);
      const previews = files.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      });
      Promise.all(previews).then((urls) => {
        setPreviewQueue((prev) => [...prev, ...urls]);
        setShowCropper(true);
      });
    }
  };

  const handleColorChange = (e) => {
    const { name, value } = e.target;
    setVariantForm((prev) => ({
      ...prev,
      color: {
        ...prev.color,
        [name]: value,
      },
    }));
  };

 // Instead of showing one cropper and clearing queue
 const handleCropComplete = (blob) => {
  console.log("Incoming blob:", blob);
  console.log("Blob type:", typeof blob);
  console.log("Is it a Blob?", blob instanceof Blob);

  // Don't proceed if blob is invalid
  if (!(blob instanceof Blob)) {
    console.warn("❌ Invalid blob passed to handleCropComplete");
    return;
  }

  setImages((prev) => [...prev, blob]);

  const objectUrl = URL.createObjectURL(blob);

  setVariantForm((prev) => {
    const updatedImages = [
      ...(prev.images || []),
      {
        url: objectUrl,
        file: blob, // ✅ this should now be a valid Blob
      },
    ];
    return {
      ...prev,
      images: updatedImages,
      mainImage: updatedImages[0],
    };
  });

  setPreviewQueue((prev) => {
    const [, ...rest] = prev;
    if (rest.length === 0) setShowCropper(false);
    return rest;
  });
};






const handleSubmit = async () => {
  try {
    console.log("📦 Submitting Variant Form...");
    console.log("Selected Variant Index:", selectedVariantIndex);
    console.log("Product ID:", productId);

    console.log("📝 Variant Form Data:");
    console.log("Name:", product.name);
    console.log("Color:", variantForm.color);
    console.log("Price:", variantForm.price);
    console.log("Discount Price:", variantForm.discount);
    console.log("Sizes:", variantForm.sizes);
    console.log("Images:", variantForm.images.map(img => img.file));

    // console.log("Main Image:", variantForm.mainImage.file);

    if (selectedVariantIndex !== null) {
      console.log("🛠️ Updating existing variant...");
      // await updateVariant(productId, selectedVariantIndex, variantForm);
    } else {
      console.log("➕ Adding new variant...");
      await addVariant(productId, variantForm);
      // await addVariantToProduct(productId, variantForm);
    }

    console.log("✅ Variant Submitted!");
    // window.location.reload();
  } catch (err) {
    console.error("❌ Error while submitting variant:", err);
  }
};


  if (!product) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold mb-4">
        Manage Variants for: <span className="text-blue-600">{product.name}</span>
      </h2>

      {/* Product Info */}
      <div className="bg-gray-50 p-4 rounded-md mb-6 border">
        <p><strong>Brand:</strong> {product.brandId?.name || '-'}</p>
        <p><strong>Category:</strong> {[product.categoryId?.name, product.subCategoryId?.name, product.subSubCategoryId?.name].filter(Boolean).join(' / ')}</p>
        <p><strong>Description:</strong> {product.description || '-'}</p>
        {/* <p><strong>Price:</strong> ₹{product.price}</p> */}
      </div>

      {/* Variant Selection */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-grow">
          <label className="block text-sm font-medium mb-1">Select Variant</label>
          <select
            className="border px-3 py-2 rounded w-full"
            onChange={(e) => handleSelectVariant(Number(e.target.value))}
            value={selectedVariantIndex ?? ''}
          >
            <option value="">-- Select Existing Variant --</option>
            {product.variants.map((variant, i) => (
              <option key={i} value={i}>
                {variant.color.name || `Variant ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
        <button
          className="text-blue-600 hover:underline text-sm mt-1"
          onClick={() => {
            setSelectedVariantIndex(null);
            setVariantForm(getEmptyVariantForm());
          }}
        >
          + Add New Variant
        </button>
      </div>

      {/* Color */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Color Name</label>
          <input
            type="text"
            name="name"
            value={variantForm.color.name}
            onChange={handleColorChange}
            className="border w-full px-3 py-2 rounded"
            placeholder="e.g. Navy Blue"
          />
        </div>
        {/* <div>
          <label className="block text-sm font-medium mb-1">Color HEX</label>
          <input
            type="text"
            name="hex"
            value={variantForm.color.hex}
            onChange={handleColorChange}
            className="border w-full px-3 py-2 rounded"
            placeholder="#aabbcc"
          />
        </div> */}
      </div>

      {/* Sizes */}
      <DynamicSizesInput
        sizes={variantForm.sizes}
        setSizes={(updatedSizes) =>
          setVariantForm((prev) => ({ ...prev, sizes: updatedSizes }))
        }
      />

      {/* mrp */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">MRP</label>
        <input
          type="number"
          name="mrp"
          value={variantForm.mrp}
          onChange={handleChange}
          className="border w-full px-3 py-2 rounded"
        />
      </div>
      {/* price */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Price</label>
        <input
          type="number"
          name="price"
          value={variantForm.price}
          onChange={handleChange}
          className="border w-full px-3 py-2 rounded"
        />
      </div>

      {/* Discount */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Discount (%)</label>
        <input
          type="number"
          name="discount"
          value={variantForm.discount}
          onChange={handleChange}
          className="border w-full px-3 py-2 rounded"
        />
      </div>

      {/* Main Image */}
      {/* Main Image Upload with Crop */}
      <div className="flex flex-col">
<div className="mb-4">
  <label className="block text-sm font-medium mb-1">Upload Images</label>
  <input
    type="file"
    accept="image/*"
    name="image"
    multiple
    onChange={handleChange}
    className="border p-2 rounded"
  />
</div>

{showCropper && previewQueue.length > 0 && (
  <CropperModal
    imageSrc={previewQueue[0]} // show the first one
    onClose={() => {
      setShowCropper(false);
      setPreviewQueue([]); // clear the rest if you want
    }}
    onCropComplete={handleCropComplete}
  />
)}


{variantForm.images?.length > 0 && (
  <div className="mt-4 grid grid-cols-2 gap-4">
    {variantForm.images.map((img, i) => (
      <div key={i}>
        <img src={img.url} alt={`Variant ${i}`} className="h-24 rounded border" />
        <p className="text-xs text-gray-500 mt-1">{i === 0 ? "Main Image" : `Image ${i + 1}`}</p>
      </div>
    ))}
  </div>
)}

</div>


      {/* Additional Images */}
      {/* <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Additional Images</label>
        {variantForm.images.map((img, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Image URL"
              value={img.url}
              onChange={(e) => handleImageChange(i, "url", e.target.value)}
              className="border p-2 rounded w-full"
            />
            <button
              onClick={() => removeImage(i)}
              className="bg-red-500 text-white px-2 rounded"
            >
              X
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addImage}
          className="bg-blue-500 text-white px-4 py-1 rounded"
        >
          + Add Image
        </button>
      </div> */}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow"
      >
        {selectedVariantIndex !== null ? 'Update Variant' : 'Add Variant'}
      </button>
    </div>
  );
};

export default Variants;
