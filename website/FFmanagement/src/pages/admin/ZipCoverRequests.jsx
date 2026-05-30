import React, { useState, useEffect } from 'react';
import { getAllZipCoverOrders, updateZipCoverOrderStatus } from '../../api/zipCovers';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';

const ZipCoverRequests = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getAllZipCoverOrders();
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to fetch zip cover orders', error);
      toast.error('Failed to load zip cover orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateZipCoverOrderStatus(orderId, newStatus);
      toast.success(`Order marked as ${newStatus}`);
      fetchOrders();
    } catch (error) {
      console.error('Failed to update status', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCopyAddress = (addressStr) => {
    if (!addressStr) return;
    navigator.clipboard.writeText(addressStr);
    toast.success('Address copied to clipboard');
  };

  const formatAddress = (addressObj) => {
    if (!addressObj) return 'No address provided';
    const parts = [
      addressObj.street,
      addressObj.city,
      addressObj.state,
      addressObj.postalCode
    ].filter(Boolean);
    
    let addrString = parts.join(', ');
    
    // Check for coordinates in GeoJSON format or direct fields
    let lat = addressObj.latitude;
    let lng = addressObj.longitude;
    
    if (addressObj.location?.coordinates?.length === 2) {
      // MongoDB GeoJSON format is [longitude, latitude]
      lng = addressObj.location.coordinates[0];
      lat = addressObj.location.coordinates[1];
    }

    if (lat !== undefined && lng !== undefined) {
      addrString += ` (Lat: ${lat}, Lng: ${lng})`;
    }

    return addrString || 'No address provided';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Zip Cover Requests</h1>
        <button onClick={fetchOrders} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading requests...</div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No zip cover requests found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantities</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{order.merchantId?.shopName || 'Unknown Merchant'}</div>
                    <div className="text-sm text-gray-500">{order.merchantId?.phoneNumber || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 flex items-start gap-2 max-w-[250px]">
                      <span className="line-clamp-2">{formatAddress(order.merchantId?.address)}</span>
                      {order.merchantId?.address && (
                        <button 
                          onClick={() => handleCopyAddress(formatAddress(order.merchantId?.address))}
                          className="text-gray-400 hover:text-gray-700 mt-0.5"
                          title="Copy Address"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex gap-4">
                      {order.quantities.small > 0 && <span>S: <b>{order.quantities.small}</b></span>}
                      {order.quantities.medium > 0 && <span>M: <b>{order.quantities.medium}</b></span>}
                      {order.quantities.large > 0 && <span>L: <b>{order.quantities.large}</b></span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <select
                      className="border border-gray-300 rounded px-2 py-1 bg-white text-sm"
                      value={order.status}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ZipCoverRequests;
