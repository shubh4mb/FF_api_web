import React, { useEffect, useState } from 'react';
import { getMerchants, verifyMerchant } from '@/api/merchants';
import { useNavigate } from 'react-router-dom';
import ReusableAdminTable from '@/components/admin/Table';
import api from '@/utils/axios.config';

const Merchants = () => {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState([]);

  const merchantColumns = [
    { header: "#", accessor: "_index", render: (_, __, i) => i + 1 },
    { header: "Name", accessor: "shopName" },
    { header: "Phone", accessor: "phoneNumber" },
    { header: "Email", accessor: "email" },
    {
      header: "Status",
      accessor: "status",
      render: (value) => {
        let badgeColor = "bg-gray-100 text-gray-600";
        if (value === "active") badgeColor = "bg-green-100 text-green-600";
        else if (value === "pending_verification") badgeColor = "bg-yellow-100 text-yellow-600";
        else if (value === "pending_payment") badgeColor = "bg-blue-100 text-blue-600";
        else if (value === "rejected") badgeColor = "bg-red-100 text-red-600";
        
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${badgeColor}`}>
            {value ? value.replace('_', ' ') : 'UNKNOWN'}
          </span>
        );
      },
    },
    {
      header: "Verified",
      accessor: "isVerified",
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${value ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"}`}>
          {value ? "VERIFIED" : "PENDING"}
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
    {
      label: (row) => row.isVerified ? "Unverify" : "Verify",
      onClick: async (row) => {
        try {
          await verifyMerchant(row._id, !row.isVerified);
          window.location.reload(); // Quick refresh to show status
        } catch (err) {
          alert("Error updating verification: " + err.message);
        }
      },
      className: (row) => row.isVerified ? "text-orange-600 hover:underline text-sm font-bold" : "text-green-600 hover:underline text-sm font-bold",
    },
  ];

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await getMerchants();
        // console.log("yes reachingddd : ",res);
        setMerchants(res.merchants);
      } catch (err) {
        console.error(err);
      }
    };

    fetchMerchants();
  }, []);

  const handleViewDummyReceipt = async () => {
    try {
      // Because of the axios interceptor, `res` is already `response.data` (which is the Blob)
      const res = await api.get('/admin/dummy-receipt', { responseType: 'blob' });
      
      // If the response is actually a JSON error (e.g. backend failed)
      if (res.type === 'application/json') {
        const text = await res.text();
        alert("Backend Error: " + text);
        return;
      }
      
      const url = window.URL.createObjectURL(new Blob([res], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      alert("Error fetching receipt: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Merchants</h1>
        <button 
          onClick={handleViewDummyReceipt}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition font-medium"
        >
          View Dummy Receipt
        </button>
      </div>
      {merchants.length === 0 ? (
        <p className="text-gray-500">No merchants found.</p>
      ) : (
        <ReusableAdminTable columns={merchantColumns} data={merchants} actions={merchantActions} />
      )}
    </div>
  );
};

export default Merchants;
