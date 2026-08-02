import React, { useState, useEffect } from 'react';
import { getZones } from '@/api/zone';
import {
  createWarehouse,
  getAllWarehouses,
  updateWarehouse,
  deleteWarehouse,
  createWarehouseOperator
} from '@/api/warehouse';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit2, Warehouse, MapPin, Phone, Mail, Clock, Percent, X, UserPlus } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapModalClickHandler({ setLocation }) {
  useMapEvents({
    click(e) {
      setLocation([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

const WarehouseManagement = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Map Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [tempMapLocation, setTempMapLocation] = useState(null);
  const [mapCenter] = useState([9.9961, 76.2942]); // default Kochi coordinates

  // Operator Modal State
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [operatorWarehouseId, setOperatorWarehouseId] = useState(null);
  const [operatorEmail, setOperatorEmail] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorPhone, setOperatorPhone] = useState('');
  const [operatorLoading, setOperatorLoading] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentWarehouseId, setCurrentWarehouseId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [selectedZoneIds, setSelectedZoneIds] = useState([]);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [longitude, setLongitude] = useState('');
  const [latitude, setLatitude] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('21:00');
  const [commissionRate, setCommissionRate] = useState('');
  const [supportsTryAndBuy, setSupportsTryAndBuy] = useState(true);
  const [supportsCourier, setSupportsCourier] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching warehouses and zones...');
      const [warehouseRes, zonesRes] = await Promise.all([
        getAllWarehouses(),
        getZones()
      ]);
      console.log('getAllWarehouses response:', warehouseRes);
      console.log('getZones response:', zonesRes);
      setWarehouses(warehouseRes.warehouses || []);
      setZones(zonesRes.zones || []);
    } catch (error) {
      console.error('Failed to load warehouse data. Error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setCurrentWarehouseId(null);
    setName('');
    setSelectedZoneIds([]);
    setStreet('');
    setCity('');
    setState('');
    setPostalCode('');
    setLandmark('');
    setLongitude('');
    setLatitude('');
    setManagerName('');
    setManagerPhone('');
    setManagerEmail('');
    setOpenTime('09:00');
    setCloseTime('21:00');
    setCommissionRate('');
    setSupportsTryAndBuy(true);
    setSupportsCourier(true);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openOperatorModal = (wh) => {
    setOperatorWarehouseId(wh._id);
    setOperatorEmail('');
    setOperatorPassword('');
    setOperatorName('');
    setOperatorPhone('');
    setIsOperatorModalOpen(true);
  };

  const openEditModal = (wh) => {
    setIsEditMode(true);
    setCurrentWarehouseId(wh._id);
    setName(wh.name);
    setSelectedZoneIds(wh.zoneIds?.map(z => typeof z === 'object' ? z._id : z) || []);
    setStreet(wh.address?.street || '');
    setCity(wh.address?.city || '');
    setState(wh.address?.state || '');
    setPostalCode(wh.address?.postalCode || '');
    setLandmark(wh.address?.landmark || '');
    setLongitude(wh.address?.location?.coordinates?.[0] || '');
    setLatitude(wh.address?.location?.coordinates?.[1] || '');
    setManagerName(wh.manager?.name || '');
    setManagerPhone(wh.manager?.phone || '');
    setManagerEmail(wh.manager?.email || '');
    setOpenTime(wh.operatingHours?.open || '09:00');
    setCloseTime(wh.operatingHours?.close || '21:00');
    setCommissionRate(wh.commissionRate !== null ? wh.commissionRate : '');
    setSupportsTryAndBuy(wh.supportsTryAndBuy);
    setSupportsCourier(wh.supportsCourier);
    setIsActive(wh.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) return toast.error('Warehouse name is required');
    if (!city.trim() || !state.trim()) return toast.error('City and State are required');
    if (!longitude || !latitude) return toast.error('Coordinates are required');

    const payload = {
      name,
      zoneIds: selectedZoneIds,
      address: {
        street,
        city,
        state,
        postalCode,
        landmark,
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        }
      },
      manager: {
        name: managerName,
        phone: managerPhone,
        email: managerEmail
      },
      operatingHours: {
        open: openTime,
        close: closeTime,
        daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      },
      commissionRate: commissionRate !== '' ? parseFloat(commissionRate) : null,
      supportsTryAndBuy,
      supportsCourier,
      isActive
    };

    try {
      if (isEditMode) {
        await updateWarehouse(currentWarehouseId, payload);
        toast.success('Warehouse updated successfully');
      } else {
        await createWarehouse(payload);
        toast.success('Warehouse created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save warehouse');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this warehouse?')) return;
    try {
      await deleteWarehouse(id);
      toast.success('Warehouse deactivated successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to deactivate warehouse');
    }
  };

  const handleOperatorSubmit = async (e) => {
    e.preventDefault();
    if (!operatorEmail.trim() || !operatorPassword.trim() || !operatorName.trim()) {
      return toast.error('Email, Password and Name are required');
    }
    setOperatorLoading(true);
    try {
      await createWarehouseOperator(operatorWarehouseId, {
        email: operatorEmail,
        password: operatorPassword,
        name: operatorName,
        phoneNumber: operatorPhone
      });
      toast.success('Operator account created successfully!');
      setIsOperatorModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create operator');
    } finally {
      setOperatorLoading(false);
    }
  };

  const toggleZoneSelection = (zoneId) => {
    setSelectedZoneIds(prev => 
      prev.includes(zoneId) 
        ? prev.filter(id => id !== zoneId) 
        : [...prev, zoneId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warehouse Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage FlashFits-operated fulfillment centers, zones served, and service parameters.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors w-full sm:w-auto"
        >
          <Plus size={18} />
          Create New Warehouse
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {warehouses.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              <Warehouse className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="font-medium text-slate-700">No warehouses configured yet</p>
              <p className="text-sm text-slate-400 mt-1">Click "Create New Warehouse" to set one up.</p>
            </div>
          ) : (
            warehouses.map((wh) => (
              <div 
                key={wh._id} 
                className={`bg-white rounded-2xl border ${wh.isActive ? 'border-slate-200' : 'border-rose-100 bg-rose-50/20'} shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow relative overflow-hidden`}
              >
                {!wh.isActive && (
                  <span className="absolute top-3 right-3 bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-bold">
                    Inactive
                  </span>
                )}
                
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-sky-500 shrink-0" />
                    <span className="truncate">{wh.name}</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-1">Code: {wh.code}</p>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-700">{wh.address?.city}, {wh.address?.state}</p>
                      <p className="text-xs text-slate-400">{wh.address?.street}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{wh.manager?.name} ({wh.manager?.phone})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{wh.operatingHours?.open} - {wh.operatingHours?.close}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="font-semibold text-slate-700">
                      Commission: {wh.commissionRate !== null ? `${wh.commissionRate}%` : 'Global default (10%)'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex gap-1.5">
                    {wh.supportsTryAndBuy && (
                      <span className="bg-sky-50 text-sky-700 text-xs px-2.5 py-1 rounded-full font-medium">
                        Try & Buy
                      </span>
                    )}
                    {wh.supportsCourier && (
                      <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-medium">
                        Courier
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {wh.isActive && (
                      <button
                        onClick={() => openOperatorModal(wh)}
                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Create Operator Account"
                      >
                        <UserPlus size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(wh)}
                      className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Warehouse"
                    >
                      <Edit2 size={16} />
                    </button>
                    {wh.isActive && (
                      <button
                        onClick={() => handleDelete(wh._id)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Deactivate Warehouse"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {isEditMode ? 'Edit Warehouse' : 'Create New Warehouse'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">Configure fulfillment center location, zones served, and team details.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Basic Info</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. FlashFits Warehouse Kochi"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Address & Location</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="e.g. Bypass Junction, Kundannoor"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Kochi"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Kerala"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="682024"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Near Decathlon store"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-full bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600 uppercase">Map Coordinates *</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (latitude && longitude) {
                            setTempMapLocation([parseFloat(latitude), parseFloat(longitude)]);
                          } else {
                            setTempMapLocation(mapCenter);
                          }
                          setIsMapModalOpen(true);
                        }}
                        className="text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors"
                      >
                        Select on Map
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          placeholder="e.g. 76.3216"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                          placeholder="e.g. 9.9816"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Zones */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Service Coverage</h3>
                <label className="block text-sm font-medium text-slate-700">Select Zones Served</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                  {zones.length === 0 ? (
                    <span className="text-xs text-slate-400">No active zones available. Configure zones first.</span>
                  ) : (
                    zones.map((zone) => (
                      <button
                        type="button"
                        key={zone._id}
                        onClick={() => toggleZoneSelection(zone._id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          selectedZoneIds.includes(zone._id)
                            ? 'bg-sky-500 border-sky-600 text-white font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {zone.zoneName} ({zone.city})
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Manager info */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Manager Contact Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      placeholder="jane@flashfits.com"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Settings, times & commission */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Service Parameters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Opening Time</label>
                    <input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Closing Time</label>
                    <input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Commission Override (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      placeholder="Global default (10%)"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supportsTryAndBuy}
                      onChange={(e) => setSupportsTryAndBuy(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">Supports Try & Buy</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supportsCourier}
                      onChange={(e) => setSupportsCourier(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">Supports Courier Delivery</span>
                  </label>
                  {isEditMode && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">Active</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors"
                >
                  {isEditMode ? 'Save Changes' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Map Selection Modal */}
      {isMapModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[200] animate-in fade-in p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[80vh] animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">Select Location</h3>
                <p className="text-xs text-slate-500">Tap anywhere on the map to drop a pin.</p>
              </div>
              <button onClick={() => setIsMapModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors hover:text-slate-800">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 relative">
              <MapContainer
                center={tempMapLocation || mapCenter}
                zoom={15}
                className="w-full h-full z-0"
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapModalClickHandler setLocation={setTempMapLocation} />
                {tempMapLocation && (
                  <Marker
                    position={tempMapLocation}
                    icon={L.divIcon({
                      html: `<div class="w-6 h-6 bg-sky-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center animate-bounce"><span class="text-white text-[9px] font-bold">New</span></div>`,
                      className: 'temp-marker',
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  />
                )}
              </MapContainer>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tempMapLocation) {
                    setLatitude(tempMapLocation[0].toFixed(6));
                    setLongitude(tempMapLocation[1].toFixed(6));
                    setIsMapModalOpen(false);
                    toast.success("Coordinates selected successfully");
                  } else {
                    toast.error("Please tap on the map to select a location first.");
                  }
                }}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Warehouse Operator Account Modal */}
      {isOperatorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create Operator Account</h2>
              <p className="text-sm text-slate-500 mt-1">This will create a ready-to-use account for warehouse staff to log into the Merchant app.</p>
            </div>

            <form onSubmit={handleOperatorSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operator Full Name</label>
                <input
                  type="text"
                  required
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={operatorEmail}
                  onChange={(e) => setOperatorEmail(e.target.value)}
                  placeholder="operator@flashfits.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={operatorPassword}
                  onChange={(e) => setOperatorPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={operatorPhone}
                  onChange={(e) => setOperatorPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOperatorModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={operatorLoading}
                  className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {operatorLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseManagement;
