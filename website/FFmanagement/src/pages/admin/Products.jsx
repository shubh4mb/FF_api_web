import React, { useEffect, useState } from 'react'
import { getBaseProducts, toggleProductStatus, toggleProductVerification, deleteProduct } from '@/api/products'
import { getMerchants } from '@/api/merchants'
import { getZones } from '@/api/zone'
import ReusableAdminTable from '@/components/admin/Table'
import ProductDetailsModal from '@/components/admin/ProductDetailsModal'
import EditProductModal from '@/components/admin/EditProductModal'
import useTableFeatures from '@/hooks/useTableFeatures'
import { useNavigate } from 'react-router-dom'
import { Package, Eye, Edit, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const Products = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merchantsList, setMerchantsList] = useState([]);
  const [zonesList, setZonesList] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // --- Filter definitions ---
  const filterDefs = [
    {
      key: 'isActive',
      label: 'Status',
      options: [
        { label: 'Active', value: 'true' },
        { label: 'Inactive', value: 'false' },
      ],
    },
    {
      key: 'isVerified',
      label: 'Verification',
      options: [
        { label: 'Verified', value: 'true' },
        { label: 'Pending', value: 'false' },
      ],
    },
    {
      key: 'merchantId._id',
      label: 'Merchant',
      options: merchantsList.map(m => ({ label: m.shopName || m.name || m.ownerName || 'Unknown Merchant', value: m._id })),
    },
    {
      key: 'zone',
      label: 'Zone',
      options: zonesList.map(z => ({ label: z.zoneName || z.name || 'Unknown Zone', value: z._id })),
      matchFn: (rowValue, filterValue, row) => {
        const merchant = merchantsList.find(m => m._id === row.merchantId?._id);
        if (!merchant) return false;
        return merchant.zoneId === filterValue || merchant.zoneId?._id === filterValue;
      }
    }
  ];

  // --- Table features hook ---
  const {
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
    activeFilters,
    setFilter,
    clearFilters,
    currentPage,
    totalPages,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalFilteredCount,
    totalCount,
    filterDefs: resolvedFilterDefs,
  } = useTableFeatures(products, {
    searchableFields: ['name', 'brandId.name', 'categoryId.name', 'subCategoryId.name', 'merchantId.name'],
    defaultSort: null,
    pageSize: 10,
    filters: filterDefs,
  });

  // --- Column definitions ---
  const productColumns = [
    {
      header: "#",
      accessor: "_index",
      width: "50px",
      sortKey: false,
      render: (_, __, i) => (
        <span className="text-xs font-mono text-slate-400">{i + 1}</span>
      ),
    },
    {
      header: "Product",
      accessor: "name",
      width: "30%",
      sortKey: "name",
      render: (_, row) => {
        const imageUrl = row.variants?.[0]?.images?.[0]?.url || "https://placehold.co/100x100?text=No+Image";
        return (
          <div 
            className="flex items-center gap-3 cursor-pointer group/item"
            onClick={() => {
              setSelectedProduct(row);
              setViewModalOpen(true);
            }}
            title="Click to view full details"
          >
            <img
              src={imageUrl}
              alt="product"
              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 group-hover/item:border-sky-400 transition-colors"
            />
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="font-semibold text-slate-800 truncate text-sm group-hover/item:text-sky-600 transition-colors" title={row.name}>
                {row.name}
              </span>
              <span className="text-xs text-slate-400 truncate">
                {row.brandId?.name || "No Brand"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      header: "Category",
      accessor: "categoryId",
      width: "18%",
      sortKey: "categoryId.name",
      render: (_, row) => {
        const top = row.categoryId?.name;
        const sub = row.subCategoryId?.name;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-700 truncate">{top || "—"}</span>
            {sub && <span className="text-xs text-slate-400 truncate">{sub}</span>}
          </div>
        );
      },
    },
    {
      header: "Price",
      accessor: "price",
      width: "90px",
      sortKey: "variants.0.price",
      render: (_, row) => {
        const price = row.variants?.[0]?.price || row.price || 0;
        return <span className="font-bold text-slate-800 text-sm">₹{price}</span>;
      },
    },
    {
      header: "Status",
      accessor: "isActive",
      width: "130px",
      sortKey: false,
      render: (_, row) => (
        <div className="flex flex-col gap-1.5">
          <span
            className={`inline-flex items-center w-max px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
              row.isVerified
                ? "bg-sky-50 text-sky-600 border border-sky-200"
                : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}
          >
            {row.isVerified ? "Verified" : "Pending"}
          </span>
          <span
            className={`inline-flex items-center w-max px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
              row.isActive
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-rose-50 text-rose-500 border border-rose-200"
            }`}
          >
            {row.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "_quickActions",
      width: "110px",
      sortKey: false,
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setSelectedProduct(row);
              setViewModalOpen(true);
            }}
            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditingProduct(row);
              setEditModalOpen(true);
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit Product"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setProductToDelete(row)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete Product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // --- Default hidden columns (none hidden by default) ---
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  const onToggleColumn = (accessor) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.has(accessor) ? next.delete(accessor) : next.add(accessor);
      return next;
    });
  };

  // --- Delete confirmation handler ---
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    const targetId = productToDelete._id || productToDelete.styleGroupId;
    const targetName = productToDelete.name;

    try {
      setDeleting(true);
      await deleteProduct(targetId);
      setProducts((prev) => prev.filter((p) => p._id !== targetId && p.styleGroupId !== targetId));
      toast.success(`"${targetName}" deleted successfully`);
      setProductToDelete(null);
      if (selectedProduct && (selectedProduct._id === targetId || selectedProduct.styleGroupId === targetId)) {
        setViewModalOpen(false);
        setSelectedProduct(null);
      }
    } catch (err) {
      console.error("Delete product error:", err);
      toast.error(err.message || "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  // --- Actions ---
  const productActions = [
    {
      label: "View Details",
      onClick: (row) => {
        setSelectedProduct(row);
        setViewModalOpen(true);
      },
    },
    {
      label: "Edit",
      onClick: (row) => {
        setEditingProduct(row);
        setEditModalOpen(true);
      },
    },
    {
      label: "Variants",
      onClick: (row) => navigate(`/admin/variants/${row._id}`),
    },
    {
      label: "Matching Products",
      onClick: (row) => navigate(`/admin/matching-products/${row._id}`, { state: { merchantId: row.merchantId?._id || row.merchantId } }),
    },
    {
      label: "Toggle Status",
      onClick: async (row) => {
        try {
          await toggleProductStatus(row._id);
          setProducts((prev) =>
            prev.map((p) =>
              p._id === row._id ? { ...p, isActive: !p.isActive } : p
            )
          );
          toast.success(`Status updated for "${row.name}"`);
        } catch (err) {
          console.error(err);
          toast.error(err.message || "Failed to toggle product status.");
        }
      },
    },
    {
      label: "Toggle Verification",
      onClick: async (row) => {
        try {
          await toggleProductVerification(row._id);
          setProducts((prev) =>
            prev.map((p) =>
              p._id === row._id ? { ...p, isVerified: !p.isVerified } : p
            )
          );
          toast.success(`Verification updated for "${row.name}"`);
        } catch (err) {
          console.error(err);
          toast.error(err.message || "Failed to toggle verification status.");
        }
      },
    },
    {
      label: "Delete",
      onClick: (row) => {
        setProductToDelete(row);
      },
    },
  ];

  // --- Fetch data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [prodRes, merchRes, zoneRes] = await Promise.all([
          getBaseProducts().catch(() => ({ products: [] })),
          getMerchants().catch(() => ({ merchants: [] })),
          getZones().catch(() => ({ data: { zones: [] }, zones: [] }))
        ]);
        
        setProducts(prodRes?.products || []);
        setMerchantsList(merchRes?.merchants || []);
        
        const fetchedZones = zoneRes?.data?.zones || zoneRes?.zones || [];
        setZonesList(fetchedZones);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center shadow-sm">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Products</h1>
          <p className="text-sm text-slate-400">
            {totalCount} total product{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Table */}
      <ReusableAdminTable
        columns={productColumns}
        data={paginatedData}
        actions={productActions}
        loading={loading}
        pageOffset={(currentPage - 1) * pageSize}
        search={{
          query: searchQuery,
          onChange: setSearchQuery,
        }}
        sort={{
          config: sortConfig,
          onSort: handleSort,
        }}
        filters={{
          defs: resolvedFilterDefs,
          active: activeFilters,
          onChange: setFilter,
          onClear: clearFilters,
        }}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: setCurrentPage,
          pageSize,
          onPageSizeChange: setPageSize,
          totalCount,
          filteredCount: totalFilteredCount,
        }}
        columnToggle={{
          hiddenColumns,
          onToggle: onToggleColumn,
        }}
      />

      {/* Product Details Modal */}
      <ProductDetailsModal
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onToggleStatus={async (id) => {
          await toggleProductStatus(id);
          setProducts((prev) =>
            prev.map((p) => (p._id === id ? { ...p, isActive: !p.isActive } : p))
          );
        }}
        onToggleVerification={async (id) => {
          await toggleProductVerification(id);
          setProducts((prev) =>
            prev.map((p) => (p._id === id ? { ...p, isVerified: !p.isVerified } : p))
          );
        }}
        onDelete={(prod) => {
          setViewModalOpen(false);
          setSelectedProduct(null);
          setProductToDelete(prod);
        }}
      />

      {/* Product Edit Modal */}
      <EditProductModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSuccess={(updated) => {
          setProducts((prev) =>
            prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p))
          );
        }}
      />

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-100 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900">Delete Product</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete <span className="font-semibold text-slate-800">"{productToDelete.name}"</span>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl text-xs text-rose-700 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Notice
              </p>
              <p className="text-rose-600/90 leading-relaxed">
                This will deactivate the product and remove all its variants from active listings and catalog searches.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Product
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
