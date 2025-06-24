import React, { useEffect, useState } from 'react'
import { getBaseProducts } from '@/api/products'
import ReusableAdminTable from '@/components/admin/Table'
import { useNavigate } from 'react-router-dom'



const Products = () => {
  const navigate = useNavigate();

const productColumns = [
    { header: "#", accessor: "_index", render: (_, __, i) => i + 1 },
    { header: "Name", accessor: "name" },
    {
      header: "Brand",
      accessor: "brandId",
      render: (value) => value?.name || "-"
    },
    {
        header: "Category Path",
        accessor: "categoryId", // can be anything, since we override with render
        render: (_, row) => {
          const top = row.categoryId?.name || "-";
          const sub = row.subCategoryId?.name || "-";
          const subsub = row.subSubCategoryId?.name || "-";
          return `${top}/${sub}/${subsub}`;
        },
      },
      
    { header: "Price", accessor: "price" },
    {
      header: "Status",
      accessor: "isActive",
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs ${value ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];
  

const productActions = [
  {
    label: "Edit",
    onClick: (row) => console.log("Edit", row),
  },
  {
    label: "Variants",
    onClick: (row) => navigate(`/admin/variants/${row._id}`),
    className: "text-blue-600 hover:underline text-sm",
  },
  {
    label: "Delete",
    onClick: (row) => console.log("Delete", row),
    className: "text-red-600 hover:underline text-sm",
  },
];
  
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getBaseProducts();
        console.log(res);
        setProducts(res.products);
      } catch (error) {
        console.log(error);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Products</h1>
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <ReusableAdminTable columns={productColumns} data={products} actions={productActions} />
      )}
    </div>
  );
};

export default Products;
