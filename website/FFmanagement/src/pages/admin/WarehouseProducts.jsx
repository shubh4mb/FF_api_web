import React, { useState, useEffect } from 'react';
import { getCategories } from '@/api/categories';
import { getMerchants } from '@/api/merchants';
import { getBrands } from '@/api/brand';
import {
  getAllWarehouses,
  addWarehouseProduct,
  addWarehouseProductVariant,
  getWarehouseProducts,
  getWarehouseProductById,
  updateWarehouseProduct,
  updateWarehouseProductStock,
  toggleWarehouseProductVerification,
  deleteWarehouseProduct
} from '@/api/warehouse';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, CheckCircle, XCircle, ShoppingBag, Eye, Edit, Layers, Image as ImageIcon, Box } from 'lucide-react';

const WarehouseProducts = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form State - Add Product
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    brandId: '',
    categoryId: '',
    subCategoryId: '',
    merchantId: '',
    gender: 'MEN',
    isTriable: true,
    commissionRate: ''
  });

  // Form State - Add Variant
  const [variantForm, setVariantForm] = useState({
    colorName: '',
    colorHex: '#000000',
    sizeStr: 'M',
    stockNum: 10,
    mrp: '',
    price: '',
    discount: 0,
    images: []
  });

  // Form State - Edit Stock
  const [stockForm, setStockForm] = useState({
    variantId: '',
    size: '',
    stock: 0
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [whRes, catRes, merchantRes, brandRes] = await Promise.all([
        getAllWarehouses({ isActive: true }),
        getCategories(),
        getMerchants(),
        getBrands()
      ]);
      setWarehouses(whRes.data?.warehouses || []);
      setCategories(catRes.categories || []);
      setMerchants(merchantRes.merchants || []);
      setBrands(brandRes.brands || []);

      if (whRes.data?.warehouses?.length > 0) {
        setSelectedWarehouseId(whRes.data.warehouses[0]._id);
        fetchProducts(whRes.data.warehouses[0]._id);
      }
    } catch (error) {
      toast.error('Failed to load initial data');
    }
  };

  const fetchProducts = async (whId) => {
    if (!whId) return;
    setLoading(true);
    try {
      const res = await getWarehouseProducts(whId);
      setProducts(res.data?.products || []);
    } catch (error) {
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = (e) => {
    const whId = e.target.value;
    setSelectedWarehouseId(whId);
    fetchProducts(whId);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!selectedWarehouseId) return toast.error('Select a warehouse first');
    try {
      const payload = {
        ...productForm,
        commissionRate: productForm.commissionRate !== '' ? parseFloat(productForm.commissionRate) : null
      };
      await addWarehouseProduct(selectedWarehouseId, payload);
      toast.success('Warehouse product created. You can now add variants.');
      setIsProductModalOpen(false);
      fetchProducts(selectedWarehouseId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add product');
    }
  };

  const handleAddVariantSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const formData = new FormData();
    formData.append('color', JSON.stringify({ name: variantForm.colorName, hex: variantForm.colorHex }));
    formData.append('sizes', JSON.stringify([{ size: variantForm.sizeStr, stock: Number(variantForm.stockNum) }]));
    formData.append('mrp', variantForm.mrp);
    formData.append('price', variantForm.price);
    formData.append('discount', variantForm.discount);
    
    if (variantForm.images && variantForm.images.length > 0) {
      for (let i = 0; i < variantForm.images.length; i++) {
        formData.append('images', variantForm.images[i]);
      }
    }

    try {
      await addWarehouseProductVariant(selectedProduct._id, formData);
      toast.success('Variant added successfully');
      setIsVariantModalOpen(false);
      fetchProducts(selectedWarehouseId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add variant');
    }
  };

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await updateWarehouseProductStock(selectedProduct._id, stockForm);
      toast.success('Stock updated successfully');
      setIsStockModalOpen(false);
      fetchProducts(selectedWarehouseId);
    } catch (error) {
      toast.error('Failed to update stock');
    }
  };

  const handleToggleVerification = async (productId) => {
    try {
      const res = await toggleWarehouseProductVerification(productId);
      toast.success(res.message || 'Verification status updated');
      fetchProducts(selectedWarehouseId);
    } catch (error) {
      toast.error('Failed to toggle verification');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to remove this product listing from the warehouse?')) return;
    try {
      await deleteWarehouseProduct(productId);
      toast.success('Product listing deleted');
      fetchProducts(selectedWarehouseId);
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & selectors */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warehouse Products</h1>
          <p className="text-slate-500 text-sm mt-1">Manage physical product consignment stock stored inside FlashFits warehouses.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select
            value={selectedWarehouseId}
            onChange={handleWarehouseChange}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
          >
            <option value="">Select Warehouse...</option>
            {warehouses.map((wh) => (
              <option key={wh._id} value={wh._id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!selectedWarehouseId) return toast.error('Select a warehouse first');
              setIsProductModalOpen(true);
            }}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Plus size={18} />
            Consign New Product
          </button>
        </div>
      </div>

      {/* Main product view */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <ShoppingBag className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <p className="font-medium text-slate-700">No products inside this warehouse</p>
          <p className="text-sm text-slate-400 mt-1">Click "Consign New Product" to stock items from your merchant network.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="p-4">Product Info</th>
                  <th className="p-4">Consigned From</th>
                  <th className="p-4">Category / Brand</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Variants & Sizes</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((prod) => (
                  <tr key={prod._id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{prod.name}</div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">{prod.productCode}</div>
                    </td>
                    <td className="p-4 text-slate-600">
                      {prod.merchantId?.shopName || 'Unknown Merchant'}
                    </td>
                    <td className="p-4">
                      <span className="text-slate-600">{prod.categoryId?.name}</span>
                      <span className="block text-xs text-slate-400">{prod.brandId?.name}</span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleVerification(prod._id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          prod.isVerified
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {prod.isVerified ? (
                          <>
                            <CheckCircle size={14} /> Approved & Live
                          </>
                        ) : (
                          <>
                            <XCircle size={14} /> Pending Approval
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-4 space-y-2">
                      {prod.variants?.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No variants yet</span>
                      ) : (
                        <div className="space-y-1.5">
                          {prod.variants.map((v) => (
                            <div key={v._id} className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span
                                className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: v.color?.hex }}
                                title={v.color?.name}
                              />
                              <span className="font-medium text-slate-600">{v.color?.name}:</span>
                              {v.sizes?.map((s) => (
                                <button
                                  key={s.size}
                                  onClick={() => {
                                    setSelectedProduct(prod);
                                    setStockForm({ variantId: v._id, size: s.size, stock: s.stock });
                                    setIsStockModalOpen(true);
                                  }}
                                  className="bg-slate-100 hover:bg-sky-50 hover:text-sky-700 px-2 py-0.5 rounded border border-slate-200 transition-colors font-mono"
                                >
                                  {s.size} ({s.stock} left)
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(prod);
                          setVariantForm({
                            colorName: '',
                            colorHex: '#000000',
                            sizeStr: 'M',
                            stockNum: 10,
                            mrp: '',
                            price: '',
                            discount: 0,
                            images: []
                          });
                          setIsVariantModalOpen(true);
                        }}
                        className="text-xs bg-slate-100 hover:bg-sky-500 hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 font-semibold transition-all"
                      >
                        + Add Variant
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod._id)}
                        className="text-xs text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consign Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Consign New Product</h2>
              <p className="text-sm text-slate-500 mt-1">Specify source merchant and global attributes.</p>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div className="col-span-full">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    rows="3"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Source Merchant</label>
                  <select
                    required
                    value={productForm.merchantId}
                    onChange={(e) => setProductForm({ ...productForm, merchantId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                  >
                    <option value="">Select Merchant...</option>
                    {merchants.map((m) => (
                      <option key={m._id} value={m._id}>{m.shopName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                  <select
                    value={productForm.brandId}
                    onChange={(e) => setProductForm({ ...productForm, brandId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                  >
                    <option value="">Select Brand...</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    required
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={productForm.gender}
                    onChange={(e) => setProductForm({ ...productForm, gender: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                  >
                    <option value="MEN">Men</option>
                    <option value="WOMEN">Women</option>
                    <option value="KIDS">Kids</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Commission Override (%)</label>
                  <input
                    type="number"
                    value={productForm.commissionRate}
                    onChange={(e) => setProductForm({ ...productForm, commissionRate: e.target.value })}
                    placeholder="Warehouse default"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.isTriable}
                      onChange={(e) => setProductForm({ ...productForm, isTriable: e.target.checked })}
                      className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">Triable</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-xl font-semibold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Add Variant for: {selectedProduct?.name}</h2>
              <p className="text-sm text-slate-500 mt-1">Specify color, initial size and stock levels.</p>
            </div>

            <form onSubmit={handleAddVariantSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Color Name</label>
                  <input
                    type="text"
                    required
                    value={variantForm.colorName}
                    onChange={(e) => setVariantForm({ ...variantForm, colorName: e.target.value })}
                    placeholder="e.g. Jet Black"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Color Hex</label>
                  <input
                    type="color"
                    value={variantForm.colorHex}
                    onChange={(e) => setVariantForm({ ...variantForm, colorHex: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 p-1 focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
                  <input
                    type="text"
                    required
                    value={variantForm.sizeStr}
                    onChange={(e) => setVariantForm({ ...variantForm, sizeStr: e.target.value })}
                    placeholder="M, L, XL, etc."
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    value={variantForm.stockNum}
                    onChange={(e) => setVariantForm({ ...variantForm, stockNum: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    required
                    value={variantForm.mrp}
                    onChange={(e) => setVariantForm({ ...variantForm, mrp: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={variantForm.price}
                    onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div className="col-span-full">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Images</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setVariantForm({ ...variantForm, images: Array.from(e.target.files) })}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-xl font-semibold"
                >
                  Upload Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-6 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Update Size Stock</h2>
              <p className="text-sm text-slate-500 mt-1">Adjust size '{stockForm.size}' count.</p>
            </div>

            <form onSubmit={handleStockUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stock Count</label>
                <input
                  type="number"
                  required
                  value={stockForm.stock}
                  onChange={(e) => setStockForm({ ...stockForm, stock: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-xl font-semibold"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseProducts;
