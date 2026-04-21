import React, { useState, useEffect } from 'react';
import { getZones, deleteZone, updateZone } from '@/api/zone';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit2, Map, MapPin } from 'lucide-react';

const Zones = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentZone, setCurrentZone] = useState(null);

  // Form State
  const [zoneName, setZoneName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [status, setStatus] = useState('Inactive');

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const data = await getZones();
      setZones(data.zones || []);
    } catch (error) {
      toast.error('Failed to fetch zones');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (zone) => {
    setCurrentZone(zone);
    setZoneName(zone.zoneName);
    setCity(zone.city);
    setState(zone.state);
    setStatus(zone.status || 'Inactive');
    setIsModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        zoneName,
        city,
        state,
        status
      };
      await updateZone(currentZone._id, payload);
      toast.success('Zone updated successfully');
      setIsModalOpen(false);
      fetchZones();
    } catch (error) {
      toast.error('Failed to update zone');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this zone? This may affect linked merchants.')) return;
    try {
      await deleteZone(id);
      toast.success('Zone deleted successfully');
      fetchZones();
    } catch (error) {
      toast.error('Failed to delete zone');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Zone Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage delivery zones and merchant eligibility.</p>
        </div>
        <button
          onClick={() => navigate('/admin/create-zone')}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
        >
          <Plus size={18} />
          Create New Zone
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {zones.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Map className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p>No zones found. Create one to get started.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b leading-normal">
                  <th className="py-4 px-6 font-semibold">Zone Name</th>
                  <th className="py-4 px-6 font-semibold">City</th>
                  <th className="py-4 px-6 font-semibold">State</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 text-sm">
                {zones.map((zone) => (
                  <tr key={zone._id} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-slate-900">
                      {zone.zoneName}
                    </td>
                    <td className="py-4 px-6">
                      {zone.city}
                    </td>
                    <td className="py-4 px-6">
                      {zone.state}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        zone.status === 'Active' ? 'bg-green-100 text-green-700' : 
                        zone.status === 'Onboarding' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {zone.status || 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => openEditModal(zone)} className="text-slate-400 hover:text-sky-500 transition-colors" title="Edit Basic Info">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(zone._id)} className="text-slate-400 hover:text-rose-500 transition-colors" title="Delete Zone">
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

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">Edit Zone Basic Info</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Onboarding">Onboarding</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1 italic">* Changing status to Active will enable linked merchants for Try & Buy.</p>
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Zones;
