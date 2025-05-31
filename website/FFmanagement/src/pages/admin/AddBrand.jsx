import React, { useState } from 'react';
import { addBrand } from '@/api/brand';
const BrandForm = () => {
  const [brand, setBrand] = useState({
    name: '',
    description: '',
    logo: null,
  });

  const [preview, setPreview] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBrand({ ...brand, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setBrand({ ...brand, logo: file });
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!brand.name || !brand.createdByType) {
      alert("Please fill all required fields.");
      return;
    }

    const formData = new FormData();
    formData.append('name', brand.name);
    // formData.append('description', brand.description);
    formData.append('logo', brand.logo);
    // formData.append('createdById', createdById);
    formData.append('createdByType', brand.createdByType);
    for (let pair of formData.entries()) {
        console.log(pair[0] + ':', pair[1]);
      }
      
    
    try {
      const response = await addBrand(formData);

      alert('Brand added successfully!');
      console.log(response.data);
    } catch (error) {
      console.error(error);
      alert('Error adding brand');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Add Brand</h2>

      <label className="block mb-2">
        Name:
        <input
          type="text"
          name="name"
          value={brand.name}
          onChange={handleChange}
          required
          className="w-full border px-2 py-1 mt-1"
        />
      </label>

      {/* <label className="block mb-2">
        Description:
        <textarea
          name="description"
          value={brand.description}
          onChange={handleChange}
          className="w-full border px-2 py-1 mt-1"
        />
      </label> */}

      <label className="block mb-2">
        Created by:
        <select
          name="createdByType"
          value={brand.createdByType}
          onChange={handleChange}
          required
          className="w-full border px-2 py-1 mt-1"
        >
          <option value="Admin">Admin</option>
          <option value="Merchant">Merchant</option>
        </select>
      </label>

      <label className="block mb-4">
        Logo:
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          
          className="block mt-1"
        />
      </label>

      {preview && <img src={preview} alt="Preview" className="h-24 mb-4" />}

      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit
      </button>
    </form>
  );
};

export default BrandForm;
