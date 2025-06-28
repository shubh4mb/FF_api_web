import { useState, useEffect } from 'react';
import axios from 'axios';

const Title_Banner = () => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('new-arrivals');
  const [categoryId, setCategoryId] = useState('');
  const [image, setImage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const res = await axios.get('/api/categories');
      setCategories(res.data);
    };
    fetchCategories();
  }, []);

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !image || (type === 'category' && !categoryId)) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('type', type);
    if (type === 'category') formData.append('category', categoryId);
    formData.append('image', image);

    try {
      const res = await axios.post('/api/title-banners', formData);
      alert('✅ Banner added successfully!');
      setTitle('');
      setType('new-arrivals');
      setCategoryId('');
      setImage(null);
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-3 border rounded"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full p-3 border rounded"
        >
          <option value="new-arrivals">New Arrivals</option>
          <option value="category">Category</option>
          <option value="custom">Custom</option>
        </select>

        {type === 'category' && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full p-3 border rounded"
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
        )}

        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="w-full p-3 border rounded"
        />

        {image && (
          <img
            src={URL.createObjectURL(image)}
            alt="Preview"
            className="w-full h-48 object-cover rounded"
          />
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
