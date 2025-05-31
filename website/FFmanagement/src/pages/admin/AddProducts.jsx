// AddProductPage.jsx
import React, { useState, useEffect } from 'react';
// import axios from 'axios';
import { getCategories } from '@/api/categories';
import { getMerchants } from '@/api/merchants';
import { addProduct } from '@/api/products';
import { getBrands } from '@/api/brand';
export default function AddProductPage() {
  const [formData, setFormData] = useState({
    name: '',
    brandId: '',
    categoryId: '',
    subCategoryId: '',
    subSubCategoryId: '',
    gender: 'unisex',
    description: '',
    basePrice: '',
    tags: '',
    merchantId: '',
  });

  const [categories, setCategories] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    // Fetch categories from dummy endpoint or local JSON
    const fetchCategories = async () => {
      try {
       const res = await getCategories();
        setCategories(res.categories);
        console.log(res);
        
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    const fetchMerchants = async () => {
      try {
        const res = await getMerchants();
        setMerchants(res.merchants);
        console.log(res);
      } catch (error) {
        console.error('Error fetching merchants:', error);
      }
    };
    const fetchBrands = async () => {
      try {
        const res = await getBrands();
        setBrands(res.brands);
        console.log(res);
      } catch (error) {
        console.error('Error fetching brands:', error);
      }
    };

    fetchCategories();
    fetchMerchants();
    fetchBrands();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()),
        basePrice: parseFloat(formData.basePrice),
      };
      console.log(payload);
      // await addProduct(payload); 
      setMessage('Product created successfully!');
      // Redirect or show link to add variants
    } catch (err) {
      setMessage('Error creating product');
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryOptions = (level) => {
    return categories
      .filter(cat => cat.level === level)
      .map(cat => (
        <option key={cat._id} value={cat._id}>{cat.name}</option>
      ));
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Add New Product</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="name" placeholder="Product Name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" required />
       <select name="brandId" value={formData.brandId} onChange={handleChange} className="w-full p-2 border rounded" required>
          <option value="">Select Brand</option>
          {brands.map(brand => (
            <option key={brand._id} value={brand._id}>{brand.name}</option>
          ))}
        </select>

        <select name="merchantId" value={formData.merchantId} onChange={handleChange} className="w-full p-2 border rounded" required>
          <option value="">Select Merchant</option>
          {merchants.map(merchant => (
            <option key={merchant._id} value={merchant._id}>{merchant.shopName}</option>
          ))}
        </select>

        <select name="categoryId" value={formData.categoryId} onChange={handleChange} className="w-full p-2 border rounded" required>
          <option value="">Select Category</option>
          {renderCategoryOptions(0)}
        </select>

        <select name="subCategoryId" value={formData.subCategoryId} onChange={handleChange} className="w-full p-2 border rounded">
          <option value="">Select Sub Category</option>
          {renderCategoryOptions(1)}
        </select>

        <select name="subSubCategoryId" value={formData.subSubCategoryId} onChange={handleChange} className="w-full p-2 border rounded">
          <option value="">Select Sub-Sub Category</option>
          {renderCategoryOptions(2)}
        </select>

        <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border rounded">
          <option value="men">Men</option>
          <option value="women">Women</option>
          <option value="unisex">Unisex</option>
          <option value="boys">Boys</option>
          <option value="girls">Girls</option>
          <option value="babies">Babies</option>
        </select>

        <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} className="w-full p-2 border rounded" rows={4} />
        <input type="number" name="basePrice" placeholder="Base Price" value={formData.basePrice} onChange={handleChange} className="w-full p-2 border rounded" required />
        <input type="text" name="tags" placeholder="Tags (comma-separated)" value={formData.tags} onChange={handleChange} className="w-full p-2 border rounded" />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
          {loading ? 'Creating...' : 'Create Product'}
        </button>

        {message && <p className="mt-2 text-center text-sm text-red-600">{message}</p>}
      </form>
    </div>
  );
}
