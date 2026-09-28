import React, { useState, useEffect } from 'react';
import adminAxios from '../../utils/axios.config';
import {
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ShieldAlert,
  UserX,
  Store,
  Bike,
  Camera,
  Package,
  AlertTriangle,
  Ban,
  Maximize2,
  X,
  ExternalLink,
  DollarSign,
  CheckCircle2,
  Upload,
} from 'lucide-react';

const ReturnIssues = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Investigation details state
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form states for resolution
  const [resolutionStatus, setResolutionStatus] = useState('resolved_merchant_compensated');
  const [adminActionTaken, setAdminActionTaken] = useState('none');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  // Moderation modal states
  const [modModalType, setModModalType] = useState(null); // 'user' | 'rider' | 'merchant'
  const [modReason, setModReason] = useState('');
  const [blockIp, setBlockIp] = useState(true);
  const [blockDevice, setBlockDevice] = useState(true);
  const [modSubmitting, setModSubmitting] = useState(false);

  // Merchant compensation refund modal state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('upi');
  const [refundReferenceNumber, setRefundReferenceNumber] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [refundReceiptFile, setRefundReceiptFile] = useState(null);
  const [refundReceiptPreview, setRefundReceiptPreview] = useState(null);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Lightbox preview state
  const [lightboxImage, setLightboxImage] = useState(null);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/admin/return-issues?status=${statusFilter}` : '/admin/return-issues';
      const res = await adminAxios.get(url);
      setIssues(res.data.issues || []);
    } catch (err) {
      console.error('Failed to fetch return issues', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [statusFilter]);

  const handleOpenInvestigation = async (issueId) => {
    setSelectedIssueId(issueId);
    setLoadingDetails(true);
    setInvestigationData(null);
    try {
      const res = await adminAxios.get(`/admin/return-issues/${issueId}/details`);
      setInvestigationData(res.data);
      setResolutionStatus(res.data.issue?.status || 'investigating');
      setAdminActionTaken(res.data.issue?.adminActionTaken || 'none');
      setResolutionNotes(res.data.issue?.resolutionNotes || '');
    } catch (err) {
      console.error('Failed to fetch investigation details', err);
      alert('Failed to load investigation details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedIssueId) return;
    if (['resolved', 'resolved_merchant_compensated', 'resolved_customer_fault', 'resolved_rider_fault', 'rejected'].includes(resolutionStatus)) {
      if (!resolutionNotes.trim()) {
        alert('Resolution notes are required when finalizing a dispute.');
        return;
      }
    }

    setUpdating(true);
    try {
      await adminAxios.patch(`/admin/return-issues/${selectedIssueId}`, {
        status: resolutionStatus,
        resolutionNotes,
        adminActionTaken,
      });
      alert('Dispute resolution recorded successfully.');
      setSelectedIssueId(null);
      fetchIssues();
    } catch (err) {
      console.error('Failed to update issue status', err);
      alert('Failed to update dispute status.');
    } finally {
      setUpdating(false);
    }
  };

  // Open refund modal
  const handleOpenRefundModal = () => {
    if (!investigationData?.issue) return;
    const itemPrice = investigationData.issue.itemDetails?.price || 0;
    setRefundAmount(itemPrice ? String(itemPrice) : '');
    setRefundMethod('upi');
    setRefundReferenceNumber('');
    setRefundNotes(
      `Damage compensation for item "${investigationData.issue.itemDetails?.name || 'Damaged Product'}" (Order #${String(investigationData.issue.orderId?._id || investigationData.issue.orderId).slice(-6).toUpperCase()})`
    );
    setRefundReceiptFile(null);
    setRefundReceiptPreview(null);
    setIsRefundModalOpen(true);
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }
    setRefundReceiptFile(file);
    setRefundReceiptPreview(URL.createObjectURL(file));
  };

  const handleConfirmRefundMerchant = async (e) => {
    e.preventDefault();
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      alert('Please enter a valid refund amount.');
      return;
    }
    if (!refundReferenceNumber.trim() && refundMethod !== 'wallet' && refundMethod !== 'cash') {
      alert('Reference / UTR number is required for bank and UPI disbursements.');
      return;
    }

    setSubmittingRefund(true);
    try {
      const formData = new FormData();
      formData.append('amount', refundAmount);
      formData.append('paymentMethod', refundMethod);
      formData.append('referenceNumber', refundReferenceNumber.trim());
      formData.append('notes', refundNotes.trim());
      if (refundReceiptFile) {
        formData.append('receipt', refundReceiptFile);
      }

      const res = await adminAxios.post(
        `/admin/return-issues/${selectedIssueId}/refund-merchant`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data.success) {
        alert(res.data.message || 'Merchant refund recorded successfully and logged in ledger!');
        setIsRefundModalOpen(false);
        // Refresh investigation data to show compensation badge
        handleOpenInvestigation(selectedIssueId);
        // Refresh issues list
        fetchIssues();
      }
    } catch (err) {
      console.error('Refund merchant error:', err);
      alert(err.response?.data?.message || 'Failed to process merchant refund.');
    } finally {
      setSubmittingRefund(false);
    }
  };

  // Moderation: Block / Unblock User
  const handleBlockUser = async () => {
    if (!investigationData?.issue?.userId?._id) return;
    setModSubmitting(true);
    try {
      await adminAxios.post('/admin/moderation/block-user', {
        userId: investigationData.issue.userId._id,
        reason: modReason.trim() || 'Administrative suspension due to repetitive damage complaints.',
        blockIp,
        blockDevice,
      });
      alert('Customer account, IP, and device blocked.');
      setModModalType(null);
      setModReason('');
      handleOpenInvestigation(selectedIssueId);
    } catch (err) {
      console.error('Failed to block user', err);
      alert('Failed to block customer.');
    } finally {
      setModSubmitting(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!investigationData?.issue?.userId?._id) return;
    if (!window.confirm('Are you sure you want to unblock this customer?')) return;
    try {
      await adminAxios.post('/admin/moderation/unblock-user', {
        userId: investigationData.issue.userId._id,
      });
      alert('Customer unblocked.');
      handleOpenInvestigation(selectedIssueId);
    } catch (err) {
      console.error('Failed to unblock user', err);
      alert('Failed to unblock customer.');
    }
  };

  // Moderation: Suspend / Restore Rider
  const handleSuspendRider = async () => {
    if (!investigationData?.issue?.deliveryRiderId?._id) return;
    setModSubmitting(true);
    try {
      await adminAxios.post('/admin/moderation/suspend-rider', {
        riderId: investigationData.issue.deliveryRiderId._id,
        reason: modReason.trim() || 'Suspended due to repetitive damage disputes on assigned deliveries.',
      });
      alert('Delivery rider suspended.');
      setModModalType(null);
      setModReason('');
      handleOpenInvestigation(selectedIssueId);
    } catch (err) {
      console.error('Failed to suspend rider', err);
      alert('Failed to suspend rider.');
    } finally {
      setModSubmitting(false);
    }
  };

  const handleUnsuspendRider = async () => {
    if (!investigationData?.issue?.deliveryRiderId?._id) return;
    if (!window.confirm('Restore this delivery rider to active status?')) return;
    try {
      await adminAxios.post('/admin/moderation/unsuspend-rider', {
        riderId: investigationData.issue.deliveryRiderId._id,
      });
      alert('Rider restored.');
      handleOpenInvestigation(selectedIssueId);
    } catch (err) {
      console.error('Failed to unsuspend rider', err);
      alert('Failed to restore rider.');
    }
  };

  // Moderation: Suspend / Restore Merchant
  const handleSuspendMerchant = async () => {
    if (!investigationData?.issue?.merchantId?._id) return;
    setModSubmitting(true);
    try {
      await adminAxios.post('/admin/moderation/suspend-merchant', {
        merchantId: investigationData.issue.merchantId._id,
        reason: modReason.trim() || 'Suspended due to fraudulent damage claims or merchant policy violations.',
      });
      alert('Merchant store suspended.');
      setModModalType(null);
      setModReason('');
      handleOpenInvestigation(selectedIssueId);
    } catch (err) {
      console.error('Failed to suspend merchant', err);
      alert('Failed to suspend merchant.');
    } finally {
      setModSubmitting(false);
    }
  };

  const handleUnsuspendMerchant = async () => {
    if (!investigationData?.issue?.merchantId?._id) return;
    if (!window.confirm('Restore this merchant store to active status?')) return;
    try {
      await adminAxios.post('/admin/moderation/unsuspend-merchant', {
        merchantId: investigationData.issue.merchantId._id,
      });
      alert('Merchant store restored.');
      handleOpenInvestigation(selectedIssueId);
    } catch (err) {
      console.error('Failed to unsuspend merchant', err);
      alert('Failed to restore merchant.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">Pending</span>;
      case 'investigating':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Investigating</span>;
      case 'resolved_merchant_compensated':
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Resolved (Merchant Compensated)</span>;
      case 'resolved_customer_fault':
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">Customer Fault</span>;
      case 'resolved_rider_fault':
        return <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">Rider Fault</span>;
      case 'resolved':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">Resolved</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Claim Rejected</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  const renderRiskBadge = (level) => {
    switch (level) {
      case 'critical':
        return <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-extrabold uppercase tracking-wide">Critical Fraud Risk</span>;
      case 'high':
        return <span className="px-2 py-0.5 bg-red-500 text-white rounded text-[10px] font-extrabold uppercase tracking-wide">High Incident Rate</span>;
      case 'suspicious':
      case 'watch':
        return <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-extrabold uppercase tracking-wide">Watchlist</span>;
      case 'clean':
      case 'normal':
      default:
        return <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-extrabold uppercase tracking-wide">Clean / Normal</span>;
    }
  };

  return (
    <div className="p-6">
      {/* Top Banner */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Return & Damage Dispute Center</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Audit item photos across merchant packing, rider return, and post-delivery claims with 3-way incident tracking.
          </p>
        </div>
        <div className="flex gap-4">
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="investigating">Investigating</option>
            <option value="resolved_merchant_compensated">Merchant Compensated</option>
            <option value="resolved_customer_fault">Customer Fault</option>
            <option value="resolved_rider_fault">Rider Fault</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={fetchIssues}
            className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Issues Table */}
      {loading ? (
        <div className="flex justify-center p-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-16 flex flex-col items-center justify-center text-center border border-gray-200">
          <AlertCircle size={52} className="text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-800">No return issues found</h3>
          <p className="text-gray-500 text-sm mt-1">There are no reports matching your current filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Order / Category</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {issues.map((issue) => (
                <tr key={issue._id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{issue.merchantId?.shopName || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{issue.merchantId?.email || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{issue.userId?.name || 'Customer'}</div>
                    <div className="text-xs text-gray-500">{issue.userId?.phoneNumber || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-medium text-gray-900">
                      #{issue.orderId?._id?.slice(-6)?.toUpperCase() || 'N/A'}
                    </div>
                    <div className="text-xs text-rose-600 font-semibold uppercase mt-0.5">
                      {issue.damageCategory ? issue.damageCategory.replace('_', ' ') : issue.issueType}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>{getStatusBadge(issue.status)}</div>
                    {issue.isMerchantRefunded && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                          Compensated ₹{issue.compensationAmount}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenInvestigation(issue._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-semibold text-xs"
                    >
                      <Eye size={15} /> Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── FULL INVESTIGATION MODAL ── */}
      {selectedIssueId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    Incident Case Investigation
                    <span className="font-mono text-sm px-2 py-0.5 bg-gray-200 rounded text-gray-800">
                      #{selectedIssueId.slice(-6).toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Comparative visual evidence inspection & 3-way reputational audit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIssueId(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {loadingDetails || !investigationData ? (
                <div className="flex flex-col items-center justify-center p-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
                  <p className="text-sm font-medium text-gray-600">Gathering photos, audit trail, and history...</p>
                </div>
              ) : (
                <>
                  {/* ── SECTION 1: 3-WAY REPUTATIONAL & INCIDENT METRICS ── */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      3-Way Reputational & Incident Profiles
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Customer Card */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-gray-600 uppercase">Customer</span>
                            {renderRiskBadge(investigationData.stats?.user?.riskLevel)}
                          </div>
                          <p className="font-bold text-gray-900 text-sm">
                            {investigationData.issue.userId?.name || 'Customer Name'}
                          </p>
                          <p className="text-xs text-gray-500">{investigationData.issue.userId?.phoneNumber || 'No Phone'}</p>
                          <p className="text-xs text-gray-500">{investigationData.issue.userId?.email || ''}</p>

                          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Total Orders:</span>
                              <p className="font-bold text-gray-800">{investigationData.stats?.user?.totalOrders || 0}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Damage Claims:</span>
                              <p className="font-bold text-rose-600">
                                {investigationData.stats?.user?.totalDisputes || 0} ({investigationData.stats?.user?.disputeRatePercent || 0}%)
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2">
                          {investigationData.stats?.user?.isBlocked ? (
                            <div className="p-2 bg-red-100 text-red-800 rounded-lg text-xs font-bold flex items-center justify-between">
                              <span>⛔ ACCOUNT & IP BLOCKED</span>
                              <button
                                onClick={handleUnblockUser}
                                className="text-xs text-red-950 underline hover:text-red-800 font-semibold"
                              >
                                Unblock
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setModModalType('user');
                                setModReason(`Repetitive returned product damage violations on order #${selectedIssueId.slice(-6)}`);
                              }}
                              className="w-full py-1.5 px-3 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <UserX size={14} /> Block Customer (Account + IP + Device)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Delivery Rider Card */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-gray-600 uppercase">Delivery Rider</span>
                            {renderRiskBadge(investigationData.stats?.rider?.riskLevel)}
                          </div>
                          <p className="font-bold text-gray-900 text-sm">
                            {investigationData.issue.deliveryRiderId?.fullName ||
                              investigationData.issue.deliveryRiderId?.name ||
                              'Unassigned Rider'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {investigationData.issue.deliveryRiderId?.phone || 'No phone'}
                          </p>

                          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Deliveries Done:</span>
                              <p className="font-bold text-gray-800">{investigationData.stats?.rider?.totalDeliveries || 0}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Damage Claims:</span>
                              <p className="font-bold text-rose-600">
                                {investigationData.stats?.rider?.totalDisputes || 0} ({investigationData.stats?.rider?.incidentRatePercent || 0}%)
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2">
                          {investigationData.stats?.rider?.isSuspended ? (
                            <div className="p-2 bg-red-100 text-red-800 rounded-lg text-xs font-bold flex items-center justify-between">
                              <span>⛔ RIDER SUSPENDED</span>
                              <button
                                onClick={handleUnsuspendRider}
                                className="text-xs text-red-950 underline hover:text-red-800 font-semibold"
                              >
                                Restore
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setModModalType('rider');
                                setModReason(`Repeated damage reports on handled deliveries.`);
                              }}
                              className="w-full py-1.5 px-3 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Bike size={14} /> Suspend Rider Account
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Merchant Card */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-gray-600 uppercase">Merchant Store</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              False Claim: {investigationData.stats?.merchant?.falseClaimPercent || 0}%
                            </span>
                          </div>
                          <p className="font-bold text-gray-900 text-sm">
                            {investigationData.issue.merchantId?.shopName || 'Shop Name'}
                          </p>
                          <p className="text-xs text-gray-500">{investigationData.issue.merchantId?.phoneNumber || ''}</p>
                          <p className="text-xs text-gray-500">{investigationData.issue.merchantId?.email || ''}</p>

                          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Total Orders:</span>
                              <p className="font-bold text-gray-800">{investigationData.stats?.merchant?.totalOrders || 0}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Disputes Filed:</span>
                              <p className="font-bold text-gray-800">
                                {investigationData.stats?.merchant?.totalDisputesFiled || 0}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2">
                          {investigationData.stats?.merchant?.isSuspended ? (
                            <div className="p-2 bg-red-100 text-red-800 rounded-lg text-xs font-bold flex items-center justify-between">
                              <span>⛔ MERCHANT SUSPENDED</span>
                              <button
                                onClick={handleUnsuspendMerchant}
                                className="text-xs text-red-950 underline hover:text-red-800 font-semibold"
                              >
                                Restore
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setModModalType('merchant');
                                setModReason(`Repetitive invalid/fraudulent damage reports against customers or riders.`);
                              }}
                              className="w-full py-1.5 px-3 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Store size={14} /> Suspend Merchant Store
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 2: SIDE-BY-SIDE VISUAL EVIDENCE COMPARISON ── */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Side-by-Side Photographic Audit Trail
                      </h4>
                      <span className="text-xs text-gray-500">Click any image to expand view</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Column 1: Merchant Packing Photos */}
                      <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-100">
                          <Package size={16} className="text-blue-600" />
                          <h5 className="font-bold text-xs text-blue-900 uppercase">
                            1. Merchant Packing Proof ({investigationData.evidence?.packingPhotos?.length || 0})
                          </h5>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-3">Captured at merchant shop when order was packed</p>

                        {investigationData.evidence?.packingPhotos?.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {investigationData.evidence.packingPhotos.map((photo, i) => (
                              <div
                                key={i}
                                onClick={() => setLightboxImage(photo.url)}
                                className="group relative aspect-square rounded-lg overflow-hidden border border-blue-200 bg-black cursor-pointer"
                              >
                                <img
                                  src={photo.url}
                                  alt="Packing proof"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 size={18} color="#fff" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-white/60 rounded-lg border border-dashed border-blue-200">
                            <p className="text-xs text-gray-400">No packing photos available</p>
                          </div>
                        )}
                      </div>

                      {/* Column 2: Rider Return Photos */}
                      <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-indigo-100">
                          <Camera size={16} className="text-indigo-600" />
                          <h5 className="font-bold text-xs text-indigo-900 uppercase">
                            2. Rider Return Proof ({investigationData.evidence?.riderReturnPhotos?.length || 0})
                          </h5>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-3">Captured by rider when collecting returned items</p>

                        {investigationData.evidence?.riderReturnPhotos?.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {investigationData.evidence.riderReturnPhotos.map((photo, i) => (
                              <div
                                key={i}
                                onClick={() => setLightboxImage(photo.url)}
                                className="group relative aspect-square rounded-lg overflow-hidden border border-indigo-200 bg-black cursor-pointer"
                              >
                                <img
                                  src={photo.url}
                                  alt="Rider return proof"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                {photo.caption && (
                                  <span className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-[9px] font-bold py-0.5 text-center rounded uppercase">
                                    {photo.caption}
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 size={18} color="#fff" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-white/60 rounded-lg border border-dashed border-indigo-200">
                            <p className="text-xs text-gray-400">No rider return photos captured</p>
                          </div>
                        )}
                      </div>

                      {/* Column 3: Merchant Incident Damage Photos */}
                      <div className="border border-rose-200 bg-rose-50/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-rose-100">
                          <ShieldAlert size={16} className="text-rose-600" />
                          <h5 className="font-bold text-xs text-rose-900 uppercase">
                            3. Merchant Claim Photos ({investigationData.evidence?.merchantDamagePhotos?.length || 0})
                          </h5>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-3">Uploaded by merchant when reporting the damage</p>

                        {investigationData.evidence?.merchantDamagePhotos?.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {investigationData.evidence.merchantDamagePhotos.map((photo, i) => (
                              <div
                                key={i}
                                onClick={() => setLightboxImage(photo.url)}
                                className="group relative aspect-square rounded-lg overflow-hidden border border-rose-200 bg-black cursor-pointer"
                              >
                                <img
                                  src={photo.url}
                                  alt="Merchant damage evidence"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 size={18} color="#fff" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-white/60 rounded-lg border border-dashed border-rose-200">
                            <p className="text-xs text-gray-400">No damage photos attached</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 3: ISSUE EXPLANATION & ITEM DETAILS ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Item Details */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Affected Product</h5>
                      {investigationData.issue.itemDetails ? (
                        <div className="flex items-center gap-3">
                          {investigationData.issue.itemDetails.image && (
                            <img
                              src={investigationData.issue.itemDetails.image}
                              alt="Product"
                              className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                            />
                          )}
                          <div>
                            <p className="font-bold text-sm text-gray-900">{investigationData.issue.itemDetails.name}</p>
                            <p className="text-xs text-gray-500">
                              Size: {investigationData.issue.itemDetails.size || 'N/A'} • Price: ₹
                              {investigationData.issue.itemDetails.price || 0}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">No specific item attached (Order-level incident)</p>
                      )}
                    </div>

                    {/* Merchant Claim Description */}
                    <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-100">
                      <div className="flex justify-between items-center mb-1">
                        <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Merchant's Report</h5>
                        <span className="text-[11px] font-bold text-rose-700 uppercase bg-rose-100 px-2 py-0.5 rounded">
                          {investigationData.issue.damageCategory ? investigationData.issue.damageCategory.replace('_', ' ') : 'General'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {investigationData.issue.description}
                      </p>
                    </div>
                  </div>

                  {/* ── FINANCIAL COMPENSATION & REFUND ACTION ── */}
                  <div className="pt-2">
                    {investigationData.issue.isMerchantRefunded ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl mt-0.5">
                            <CheckCircle2 size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-950 text-sm">Merchant Refunded & Compensated</span>
                              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[10px] font-extrabold uppercase tracking-wide">
                                Logged in Ledger
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800 mt-1">
                              Disbursed <strong>₹{investigationData.issue.compensationAmount}</strong> via{' '}
                              <span className="uppercase font-semibold">{investigationData.issue.compensationMethod || 'UPI'}</span>
                              {investigationData.issue.compensationReferenceNumber && (
                                <span> • Ref/UTR: <code className="font-mono bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-semibold">{investigationData.issue.compensationReferenceNumber}</code></span>
                              )}
                              {investigationData.issue.refundedAt && (
                                <span> • {new Date(investigationData.issue.refundedAt).toLocaleString()}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {investigationData.issue.compensationTransactionId && (
                          <span className="text-xs font-mono text-emerald-800 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shrink-0 font-medium shadow-xs">
                            Txn: {investigationData.issue.compensationTransactionId?.transactionId || String(investigationData.issue.compensationTransactionId).slice(-8)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                            <DollarSign size={24} />
                          </div>
                          <div>
                            <h5 className="font-bold text-gray-900 text-sm">Damage Dispute Refund</h5>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Reimburse merchant for verified damaged goods. Backend will automatically credit balance and record a transaction in ledger.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenRefundModal}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all shrink-0 hover:shadow-emerald-600/35 cursor-pointer"
                        >
                          <DollarSign size={16} /> Refund Merchant
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── SECTION 4: DISPUTE RESOLUTION & ACTIONS ── */}
                  <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Administrative Decision & Enforcement
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Dispute Outcome Status</label>
                        <select
                          value={resolutionStatus}
                          onChange={(e) => setResolutionStatus(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="pending">Pending</option>
                          <option value="investigating">Investigating</option>
                          <option value="resolved_merchant_compensated">Resolve: Compensate Merchant (Transit / Defect)</option>
                          <option value="resolved_customer_fault">Resolve: Customer Fault (Customer Warned/Charged)</option>
                          <option value="resolved_rider_fault">Resolve: Rider Fault (Handling Penalty)</option>
                          <option value="resolved">Resolved Amicably</option>
                          <option value="rejected">Reject: Invalid / Fraudulent Merchant Claim</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Disciplinary Action Taken</label>
                        <select
                          value={adminActionTaken}
                          onChange={(e) => setAdminActionTaken(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="none">None / Record Only</option>
                          <option value="user_blocked">Customer Blocked & Device Blacklisted</option>
                          <option value="rider_suspended">Rider Account Suspended</option>
                          <option value="merchant_warned">Merchant Formally Warned</option>
                          <option value="merchant_suspended">Merchant Store Suspended</option>
                          <option value="payout_adjusted">Payout Adjusted / Deducted</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Resolution Explanation / Case Notes (Mandatory for finalize)
                      </label>
                      <textarea
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Detail findings comparing packing, rider return, and merchant photos..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setSelectedIssueId(null)}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateStatus}
                        disabled={updating}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {updating ? 'Saving...' : 'Save Resolution & Enforcement'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODERATION ACTION MODAL (Block User / Suspend Rider / Suspend Merchant) ── */}
      {modModalType && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-base">
                  {modModalType === 'user' && 'Block Customer Account'}
                  {modModalType === 'rider' && 'Suspend Delivery Rider'}
                  {modModalType === 'merchant' && 'Suspend Merchant Store'}
                </h4>
                <p className="text-xs text-gray-500">
                  {modModalType === 'user' && 'Revokes account access and blacklists IP & device'}
                  {modModalType === 'rider' && 'Revokes rider availability and delivery assignments'}
                  {modModalType === 'merchant' && 'Hides store and delists catalog from customer app'}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">Administrative Reason</label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="Enter justification for this suspension..."
              />
            </div>

            {modModalType === 'user' && (
              <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={blockIp}
                    onChange={(e) => setBlockIp(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  Blacklist Client IP Address
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={blockDevice}
                    onChange={(e) => setBlockDevice(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  Blacklist Device Hardware Footprint
                </label>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModModalType(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modModalType === 'user') handleBlockUser();
                  else if (modModalType === 'rider') handleSuspendRider();
                  else if (modModalType === 'merchant') handleSuspendMerchant();
                }}
                disabled={modSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {modSubmitting ? 'Enforcing...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MERCHANT DAMAGE COMPENSATION & REFUND MODAL ── */}
      {isRefundModalOpen && investigationData?.issue && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-700/60 rounded-xl">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-base leading-tight">Refund Merchant for Damaged Item</h4>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    Order #{String(investigationData.issue.orderId?._id || investigationData.issue.orderId).slice(-6).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRefundModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmRefundMerchant} className="p-6 space-y-4">
              {/* Item & Merchant Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-900 block text-sm">
                    {investigationData.issue.itemDetails?.name || 'Damaged Product'}
                  </span>
                  <span className="text-gray-500">
                    Store: <strong>{investigationData.issue.merchantId?.shopName || 'Merchant'}</strong> ({investigationData.issue.merchantId?.phoneNumber || ''})
                  </span>
                  {investigationData.issue.merchantId?.bankDetails?.upiId && (
                    <div className="text-emerald-700 font-mono mt-0.5 font-semibold">
                      UPI: {investigationData.issue.merchantId.bankDetails.upiId}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block text-[10px]">Item Price</span>
                  <span className="font-extrabold text-base text-gray-900">
                    ₹{investigationData.issue.itemDetails?.price || 0}
                  </span>
                </div>
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Refund Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 text-sm font-bold border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="upi">UPI Transfer</option>
                    <option value="bank_transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="wallet">In-App Balance Credit</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Reference / UTR Number */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Reference / UTR / Transaction ID {refundMethod !== 'wallet' && refundMethod !== 'cash' && '*'}
                </label>
                <input
                  type="text"
                  required={refundMethod !== 'wallet' && refundMethod !== 'cash'}
                  value={refundReferenceNumber}
                  onChange={(e) => setRefundReferenceNumber(e.target.value)}
                  placeholder="e.g. 423985729184 or UPI Ref"
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Remarks / Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Audit Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Explanation of compensation and verified defect..."
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Receipt Screenshot Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Payment Proof Screenshot (Optional)
                </label>
                {refundReceiptPreview ? (
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <img
                      src={refundReceiptPreview}
                      alt="Receipt preview"
                      className="w-12 h-12 object-cover rounded-md border"
                    />
                    <div className="flex-1 text-xs truncate">
                      <span className="font-semibold block truncate">{refundReceiptFile?.name}</span>
                      <span className="text-gray-400">{((refundReceiptFile?.size || 0) / 1024).toFixed(1)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRefundReceiptFile(null);
                        setRefundReceiptPreview(null);
                      }}
                      className="text-xs text-rose-600 font-bold px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs text-gray-600">
                    <Upload size={16} className="text-gray-400" />
                    <span>Upload payment slip / screenshot</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRefund}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {submittingRefund ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Confirm & Enter in Ledger
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── IMAGE LIGHTBOX MODAL ── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 bg-black/90 z-70 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={lightboxImage} alt="Expanded preview" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white text-sm font-bold flex items-center gap-1"
            >
              <X size={20} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnIssues;
