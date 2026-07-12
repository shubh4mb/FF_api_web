import React, { useState, useEffect } from 'react';
import adminAxios from '../../utils/axios.config';
import { RefreshCw, Eye, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

const ReturnIssues = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/admin/return-issues?status=${statusFilter}` : '/admin/return-issues';
      const res = await adminAxios.get(url);
      setIssues(res.data.issues || []);
    } catch (err) {
      console.error("Failed to fetch return issues", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [statusFilter]);

  const handleUpdateStatus = async (status) => {
    if (!selectedIssue) return;
    if (status === 'resolved' || status === 'rejected') {
      if (!resolutionNotes.trim()) {
        alert("Resolution notes are required for this status.");
        return;
      }
    }

    setUpdating(true);
    try {
      await adminAxios.patch(`/admin/return-issues/${selectedIssue._id}`, {
        status,
        resolutionNotes
      });
      alert(`Issue marked as ${status}`);
      setSelectedIssue(null);
      setResolutionNotes('');
      fetchIssues();
    } catch (err) {
      console.error("Failed to update issue status", err);
      alert("Failed to update issue status");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Pending</span>;
      case 'investigating': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Investigating</span>;
      case 'resolved': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Resolved</span>;
      case 'rejected': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Rejected</span>;
      default: return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Return Issues</h1>
          <p className="text-gray-500 text-sm">Manage damage and missing item reports from merchants</p>
        </div>
        <div className="flex gap-4">
          <select 
            className="border border-gray-300 rounded-lg px-4 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button 
            onClick={fetchIssues}
            className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-center border border-gray-100">
          <AlertCircle size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No return issues found</h3>
          <p className="text-gray-500 mt-1">There are no reports matching your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order / Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {issues.map((issue) => (
                <tr key={issue._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{issue.merchantId?.shopName || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{issue.merchantId?.email || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">#{issue.orderId?._id?.slice(-6) || 'N/A'}</div>
                    <div className="text-xs text-gray-500 uppercase font-semibold mt-1">
                      {issue.issueType === 'damage' ? 'Damaged Item' : issue.issueType === 'missing' ? 'Missing Item' : 'Other'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(issue.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => {
                        setSelectedIssue(issue);
                        setResolutionNotes(issue.resolutionNotes || '');
                      }}
                      className="text-primary hover:text-primary/80 flex items-center justify-end gap-1 ml-auto"
                    >
                      <Eye size={16} /> View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <AlertCircle size={20} className="text-warning" /> 
                  Issue Details
                </h3>
                <p className="text-sm text-gray-500 mt-1 font-mono">Order #{selectedIssue.orderId?._id || 'N/A'}</p>
              </div>
              <button 
                onClick={() => setSelectedIssue(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Merchant Info</h4>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="font-medium text-gray-900">{selectedIssue.merchantId?.shopName}</p>
                    <p className="text-sm text-gray-500">{selectedIssue.merchantId?.email}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rider Info</h4>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="font-medium text-gray-900">{selectedIssue.deliveryRiderId?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-500">{selectedIssue.deliveryRiderId?.phone || 'No phone'}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Issue Description</h4>
                <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100">
                  <p className="text-gray-800 whitespace-pre-wrap">{selectedIssue.description}</p>
                </div>
              </div>

              {selectedIssue.images && selectedIssue.images.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Evidence Photos</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedIssue.images.map((img, i) => (
                      <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="block relative pt-[100%] rounded-lg overflow-hidden border border-gray-200 hover:border-primary transition-colors">
                        <img src={img.url} alt="Evidence" className="absolute inset-0 w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-6 mt-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Resolution Actions</h4>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes (Required for Resolve/Reject)</label>
                  <textarea 
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    rows="3"
                    placeholder="Enter notes about how this was resolved or why it was rejected..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    disabled={selectedIssue.status === 'resolved' || selectedIssue.status === 'rejected'}
                  ></textarea>
                </div>

                {selectedIssue.status !== 'resolved' && selectedIssue.status !== 'rejected' && (
                  <div className="flex gap-3 mt-4">
                    {selectedIssue.status === 'pending' && (
                      <button 
                        onClick={() => handleUpdateStatus('investigating')}
                        disabled={updating}
                        className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Clock size={16} /> Mark Investigating
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleUpdateStatus('resolved')}
                      disabled={updating || !resolutionNotes.trim()}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${!resolutionNotes.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                      <CheckCircle size={16} /> Resolve
                    </button>
                    
                    <button 
                      onClick={() => handleUpdateStatus('rejected')}
                      disabled={updating || !resolutionNotes.trim()}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${!resolutionNotes.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnIssues;
