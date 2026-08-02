import React, { useEffect, useState } from 'react';
import { getMerchants, verifyMerchant, updateWarehouseStatus } from '@/api/merchants';
import { getAllWarehouses } from '@/api/warehouse';
import { useNavigate } from 'react-router-dom';
import ReusableAdminTable from '@/components/admin/Table';
import api from '@/utils/axios.config';

const Merchants = () => {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending_warehouse'
  
  // Modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

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
    {
      header: "Warehouse Status",
      accessor: "warehouseStatus",
      render: (value) => {
        let badgeColor = "bg-gray-100 text-gray-500";
        let label = "NOT OPTED-IN";
        if (value === "approved") {
          badgeColor = "bg-emerald-100 text-emerald-700 font-semibold";
          label = "APPROVED";
        } else if (value === "pending") {
          badgeColor = "bg-amber-100 text-amber-800 font-bold animate-pulse";
          label = "PENDING APPROVAL";
        } else if (value === "rejected") {
          badgeColor = "bg-red-100 text-red-600";
          label = "REJECTED";
        }
        return (
          <span className={`px-2 py-1 rounded text-xs ${badgeColor}`}>
            {label}
          </span>
        );
      },
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
          window.location.reload();
        } catch (err) {
          alert("Error updating verification: " + err.message);
        }
      },
      className: (row) => row.isVerified ? "text-orange-600 hover:underline text-sm font-bold" : "text-green-600 hover:underline text-sm font-bold",
    },
    {
      label: (row) => row.warehouseStatus === "approved" ? "Revoke Warehouse" : "Approve Warehouse",
      onClick: async (row) => {
        if (row.warehouseStatus === "approved") {
          try {
            await updateWarehouseStatus(row._id, "none");
            setMerchants(prev => prev.map(m => m._id === row._id ? { ...m, warehouseStatus: "none" } : m));
            alert(`Warehouse status updated to NONE successfully.`);
          } catch (err) {
            alert("Error updating warehouse status: " + err.message);
          }
        } else {
          setSelectedMerchant(row);
          setShowApproveModal(true);
          setSelectedWarehouseId("");
        }
      },
      className: (row) => row.warehouseStatus === "approved" ? "text-red-600 hover:underline text-sm font-semibold" : "text-emerald-600 hover:underline text-sm font-bold",
    },
    {
      label: "Reject Warehouse",
      onClick: async (row) => {
        if (row.warehouseStatus === "none") return;
        try {
          await updateWarehouseStatus(row._id, "rejected");
          setMerchants(prev => prev.map(m => m._id === row._id ? { ...m, warehouseStatus: "rejected" } : m));
          alert("Warehouse application rejected.");
        } catch (err) {
          alert("Error rejecting warehouse status: " + err.message);
        }
      },
      className: (row) => row.warehouseStatus === "pending" ? "text-red-600 hover:underline text-sm font-bold" : "hidden",
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

    const fetchWarehouses = async () => {
      try {
        const res = await getAllWarehouses();
        setWarehouses(res.warehouses || res || []);
      } catch (err) {
        console.error("Error fetching warehouses", err);
      }
    };

    fetchMerchants();
    fetchWarehouses();
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

  const handleApproveSubmit = async () => {
    if (!selectedWarehouseId) {
      alert("Please select a warehouse to assign.");
      return;
    }

    try {
      await updateWarehouseStatus(selectedMerchant._id, "approved", selectedWarehouseId);
      setMerchants(prev => prev.map(m => m._id === selectedMerchant._id ? { ...m, warehouseStatus: "approved" } : m));
      setShowApproveModal(false);
      setSelectedMerchant(null);
      alert("Warehouse application approved and assigned successfully.");
    } catch (err) {
      alert("Error approving warehouse: " + err.message);
    }
  };

  const pendingWarehouseCount = merchants.filter(m => m.warehouseStatus === 'pending').length;
  const filteredMerchants = activeTab === 'pending_warehouse' 
    ? merchants.filter(m => m.warehouseStatus === 'pending')
    : merchants;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">Merchants</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage merchant accounts, KYC verification, and warehouse fulfillment approvals.</p>
        </div>
        <button 
          onClick={handleViewDummyReceipt}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition font-medium text-sm w-full sm:w-auto"
        >
          View Dummy Receipt
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Merchants ({merchants.length})
        </button>
        <button
          onClick={() => setActiveTab('pending_warehouse')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'pending_warehouse'
              ? 'border-amber-600 text-amber-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending Warehouse Requests
          {pendingWarehouseCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">
              {pendingWarehouseCount}
            </span>
          )}
        </button>
      </div>

      {filteredMerchants.length === 0 ? (
        <p className="text-gray-500 py-8 text-center border border-dashed rounded-xl">
          {activeTab === 'pending_warehouse' ? 'No pending warehouse requests.' : 'No merchants found.'}
        </p>
      ) : (
        <ReusableAdminTable columns={merchantColumns} data={filteredMerchants} actions={merchantActions} />
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full">
            <h2 className="text-xl font-bold mb-4">Approve Warehouse Request</h2>
            <p className="text-sm text-gray-600 mb-4">
              Assign a warehouse for {selectedMerchant?.shopName}.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Warehouse</label>
              <select
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                <option value="">-- Select Warehouse --</option>
                {warehouses.map(w => (
                  <option key={w._id} value={w._id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSubmit}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Approve & Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Merchants;
