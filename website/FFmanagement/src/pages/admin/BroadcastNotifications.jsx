import React, { useState } from 'react';
import axiosInstance from '../../utils/axios.config';

// Correcting import for web project
import { Send as SendIcon, Bell as BellIcon, Users as UsersIcon, Store as StoreIcon, Bike as BikeIcon, Loader2 as LoaderIcon, CheckCircle as CheckCircleIcon } from 'lucide-react';

const BroadcastNotifications = () => {
  const [target, setTarget] = useState('customers');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title || !body) {
      setStatus({ type: 'error', message: 'Title and body are required.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await axiosInstance.post('/admin/notifications/broadcast', {
        target,
        title,
        body
      });

      if (response.data.success) {
        setStatus({ type: 'success', message: response.data.message || 'Notification broadcasted successfully!' });
        setTitle('');
        setBody('');
      } else {
        setStatus({ type: 'error', message: response.data.message || 'Failed to send notification.' });
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.message || 'An error occurred while sending the notification.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const targets = [
    { id: 'customers', label: 'Customers', icon: <UsersIcon size={18} className="mr-2" /> },
    { id: 'merchants', label: 'Merchants', icon: <StoreIcon size={18} className="mr-2" /> },
    { id: 'riders', label: 'Riders', icon: <BikeIcon size={18} className="mr-2" /> }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
          <BellIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Broadcast Notifications</h1>
          <p className="text-sm text-gray-500">Send push notifications directly to users' devices.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        {status.message && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
            status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {status.type === 'success' ? <CheckCircleIcon className="mt-0.5 shrink-0" size={18} /> : <div className="mt-0.5 shrink-0 font-bold">!</div>}
            <p className="text-sm font-medium">{status.message}</p>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-6">
          
          {/* Target Audience */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Target Audience</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {targets.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTarget(t.id)}
                  className={`flex items-center justify-center p-3 rounded-xl border transition-all ${
                    target === t.id 
                      ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.icon}
                  <span className="font-medium text-sm">{t.label}</span>
                </button>
              ))}
            </div>
            {target === 'customers' && (
              <p className="mt-2 text-xs text-gray-500">
                Note: Customer notifications are sent as push notifications only.
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1">
              Notification Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekend Special: 50% Off!"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label htmlFor="body" className="block text-sm font-semibold text-gray-700 mb-1">
              Message Body
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter the main text of your notification..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              required
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <LoaderIcon size={18} className="animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <SendIcon size={18} />
                  <span>Send Broadcast</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default BroadcastNotifications;
