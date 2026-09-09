import React, { useEffect, useState } from 'react'
import { getBaseProducts, toggleProductStatus, toggleProductVerification } from '@/api/products'
import { getMerchants } from '@/api/merchants'
import { getZones } from '@/api/zone'
import ReusableAdminTable from '@/components/admin/Table'
import useTableFeatures from '@/hooks/useTableFeatures'
import { useNavigate } from 'react-router-dom'
import { Package } from 'lucide-react'

const Products = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merchantsList, setMerchantsList] = useState([]);
  const [zonesList, setZonesList] = useState([]);

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
      width: "35%",
      sortKey: "name",
      render: (_, row) => {
        const imageUrl = row.variants?.[0]?.images?.[0]?.url || "https://placehold.co/100x100?text=No+Image";
        return (
          <div className="flex items-center gap-3">
            <img
              src={imageUrl}
              alt="product"
              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
            />
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="font-semibold text-slate-800 truncate text-sm" title={row.name}>
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
      width: "20%",
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
      width: "140px",
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

  // --- Actions ---
  const productActions = [
    {
      label: "Edit",
      onClick: (row) => console.log("Edit", row),
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
        } catch (err) {
          console.error(err);
          alert("Failed to toggle product status.");
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
        } catch (err) {
          console.error(err);
          alert("Failed to toggle verification status.");
        }
      },
    },
    {
      label: "Delete",
      onClick: (row) => console.log("Delete", row),
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
    </div>
  );
};

export default Products;
