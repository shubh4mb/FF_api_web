import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProductsByMerchantId, updateMatchingProducts } from '@/api/products';

const MatchingProducts = () => {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const navigate = useNavigate();
  const { productId } = useParams();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProductsByMerchantId(productId);
        console.log(res);
        const filtered = res.products.filter(p => p._id !== productId);
        setProducts(filtered);
      } catch (error) {
        console.log(error);
      }
    };
    fetchProducts();
  }, [productId]);

  const handleSelect = (id) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(pid => pid !== id));
    } else if (selectedProducts.length < 3) {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const handleSave = async () => {
    try {
      await updateMatchingProducts(productId, { matchingProducts: selectedProducts });
      alert('Matching products updated successfully');
      navigate(`/products/${productId}`);
    } catch (error) {
      console.error(error);
      alert('Failed to update matching products');
    }
  };

  return (
    <div>
      <h2>Select Matching Products (Max 3)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {products.map(product => (
          <div
            key={product._id}
            style={{
              border: selectedProducts.includes(product._id) ? '2px solid green' : '1px solid gray',
              padding: '10px',
              cursor: 'pointer'
            }}
            onClick={() => handleSelect(product._id)}
          >
            <img src={product.mainImage?.url} alt={product.name} width="100" />
            <p>{product.name}</p>
          </div>
        ))}
      </div>

      <button
        disabled={selectedProducts.length === 0}
        onClick={handleSave}
      >
        Save Matching Products
      </button>
    </div>
  );
};

export default MatchingProducts;
