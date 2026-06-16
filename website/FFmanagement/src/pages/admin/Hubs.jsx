import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit2, MapPin } from 'lucide-react';

const Hubs = () => {
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentHubId, setCurrentHubId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [pincodesInput, setPincodesInput] = useState('');

  const adminToken = localStorage.getItem('adminToken');
  const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/admin/hub`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (data.success) {
        setHubs(data.hubs);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch Hubs');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setName('');
    setPincodesInput('');
    setCurrentHubId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (hub) => {
    setIsEditing(true);
    setName(hub.name);
    setPincodesInput(hub.serviceablePincodes.map(p => p.areaName ? `${p.code} - ${p.areaName}` : p.code).join('\n'));
    setCurrentHubId(hub._id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !pincodesInput.trim()) {
      return toast.error('Please provide name and pincodes');
    }

    // Process pincodes
    const pincodesArray = pincodesInput
      .split('\n')
      .flatMap(line => line.split(','))
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        const parts = p.split('-');
        if (parts.length > 1) {
          return { code: parts[0].trim(), areaName: parts.slice(1).join('-').trim() };
        }
        return { code: p, areaName: '' };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    if (pincodesArray.length === 0) {
      return toast.error('Please provide at least one valid pincode');
    }

    try {
      const payload = {
        name,
        serviceablePincodes: pincodesArray
      };

      if (isEditing) {
        const { data } = await axios.patch(`${API_URL}/admin/hub/${currentHubId}`, payload, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (data.success) {
          toast.success('Hub updated successfully');
          setIsModalOpen(false);
          fetchHubs();
        }
      } else {
        const { data } = await axios.post(`${API_URL}/admin/hub/add`, payload, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (data.success) {
          toast.success('Hub created successfully');
          setIsModalOpen(false);
          fetchHubs();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save Hub');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Hub?')) return;
    try {
      const { data } = await axios.delete(`${API_URL}/admin/hub/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (data.success) {
        toast.success('Hub deleted successfully');
        fetchHubs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete Hub');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hubs Management</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage delivery hubs and their serviceable pincodes.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
        >
          <Plus size={18} />
          Add New Hub
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {hubs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <MapPin className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p>No Hubs found. Create one to get started.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b leading-normal">
                  <th className="py-4 px-6 font-semibold">Hub Name</th>
                  <th className="py-4 px-6 font-semibold">Serviceable Pincodes</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 text-sm">
                {hubs.map((hub) => (
                  <tr key={hub._id} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-slate-900">
                      {hub.name}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {hub.serviceablePincodes.slice(0, 5).map((pin, idx) => (
                           <span key={idx} className="bg-sky-50 text-sky-600 px-2 py-1 rounded text-xs shrink-0 font-medium border border-sky-100" title={pin.areaName || 'No area defined'}>
                             {pin.code} {pin.areaName && `(${pin.areaName})`}
                           </span>
                        ))}
                        {hub.serviceablePincodes.length > 5 && (
                           <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs shrink-0 font-medium">
                             +{hub.serviceablePincodes.length - 5} more
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${hub.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {hub.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => openEditModal(hub)} className="text-slate-400 hover:text-sky-500 transition-colors" title="Edit Hub">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(hub._id)} className="text-slate-400 hover:text-rose-500 transition-colors" title="Delete Hub">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">
                {isEditing ? 'Edit Hub' : 'Add New Hub'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hub Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kochi Hub"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Serviceable Pincodes & Areas</label>
                  <p className="text-xs text-slate-500 mb-2">Enter each pincode on a new line. You can optionally include an area name after a hyphen.<br/><b>Format:</b> <code>682016 - MG Road area</code></p>
                  <textarea
                    required
                    value={pincodesInput}
                    onChange={(e) => setPincodesInput(e.target.value)}
                    rows={5}
                    placeholder="682016 - MG Road area&#10;682020 - Kadavanthra"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-mono text-sm"
                  />
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                  {isEditing ? 'Save Changes' : 'Create Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hubs;
