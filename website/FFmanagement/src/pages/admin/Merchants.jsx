import React, { useEffect, useState } from 'react';
import { getMerchants } from '@/api/merchants';
import { useNavigate } from 'react-router-dom';
import ReusableAdminTable from '@/components/admin/Table';

const Merchants = () => {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState([]);

  const merchantColumns = [
    { header: "#", accessor: "_index", render: (_, __, i) => i + 1 },
    { header: "Name", accessor: "name" },
    { header: "Phone", accessor: "phone" },
    { header: "Email", accessor: "email" },
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

  const merchantActions = [
    {
      label: "Edit",
      onClick: (row) => navigate(`/admin/merchants/${row._id}`), // 👈 navigate to route
      className: "text-blue-600 hover:underline text-sm",
    },
    {
      label: "View Products",
      onClick: (row) => navigate(`/admin/products/merchant/${row._id}`),
      className: "text-blue-600 hover:underline text-sm",
    },
    {
      label: "Delete",
      onClick: (row) => console.log("Delete", row),
      className: "text-red-600 hover:underline text-sm",
    },
  ];

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await getMerchants();
        console.log(res);
        setMerchants(res.merchants);
      } catch (err) {
        console.error(err);
      }
    };

    fetchMerchants();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Merchants</h1>
      {merchants.length === 0 ? (
        <p>No merchants found.</p>
      ) : (
        <ReusableAdminTable columns={merchantColumns} data={merchants} actions={merchantActions} />
      )}
    </div>
  );
};

export default Merchants;
