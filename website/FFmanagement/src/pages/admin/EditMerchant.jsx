import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMerchantById, updateMerchantById, verifyMerchant } from "../../api/merchants";
import CropperModal from "../../components/CropperModal";

const EditMerchant = () => {
  const { merchantId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    managerName: "",
    email: "",
    phoneNumber: "",
    managerPhoneNumber: "",
    managerEmail: "",
    shopDescription: "",
    businessType: "",
    category: [],
    genderCategory: [],
    address: { street: "", city: "", state: "", postalCode: "", landmark: "", note: "" },
    bankDetails: { accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", upiId: "", isBankVerified: false },
    kyc: {
      pan: { number: "", image: null, verified: false },
      gst: { number: "", image: null, verified: false },
      businessProof: { proofType: "", image: null, verified: false },
      bankProof: { image: null, verified: false },
      isKycVerified: false
    },
    enableCourierDelivery: false,
    shipsWithinHours: 0,
    acceptsReturns: false,
    operatingHours: { openTime: "", closeTime: "", daysOpen: [] },
    logo: null,
    backgroundImage: null,
    isVerified: false,
    isActive: false,
    zoneName: ""
  });

  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [croppedLogo, setCroppedLogo] = useState(null);
  const [croppedBg, setCroppedBg] = useState(null);
  const [activeCropField, setActiveCropField] = useState(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionOptions, setRejectionOptions] = useState({
    panBlurry: false,
    wrongAccount: false,
    gstMismatch: false,
    photoMissing: false,
    ifscInvalid: false
  });
  const [customReason, setCustomReason] = useState("");

  useEffect(() => {
    const fetchMerchant = async () => {
      try {
        const data = await getMerchantById(merchantId);
        const m = data.merchant;
        setForm({
          ...m,
          address: m.address || {},
          bankDetails: m.bankDetails || { isBankVerified: false },
          category: m.category || [],
          genderCategory: m.genderCategory || [],
          kyc: {
            pan: m.kyc?.pan || { verified: false },
            gst: m.kyc?.gst || { verified: false },
            businessProof: m.kyc?.businessProof || { verified: false },
            bankProof: m.kyc?.bankProof || { verified: false },
            isKycVerified: m.kyc?.isKycVerified || false
          },
          operatingHours: {
             openTime: m.operatingHours?.open || m.operatingHours?.openTime || "",
             closeTime: m.operatingHours?.close || m.operatingHours?.closeTime || "",
             daysOpen: m.operatingHours?.daysOpen || []
          }
        });
      } catch (err) {
        console.error("Failed to fetch merchant", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMerchant();
  }, [merchantId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const parts = name.split('.');
      setForm(prev => {
        let updated = { ...prev };
        let current = updated;
        for (let i = 0; i < parts.length - 1; i++) {
            current[parts[i]] = { ...current[parts[i]] };
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = type === 'checkbox' ? checked : value;
        return updated;
      });
    } else {
      setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleToggleVerify = async () => {
    setIsUpdating(true);
    try {
      await verifyMerchant(merchantId, !form.isVerified);
      setForm(prev => ({ ...prev, isVerified: !prev.isVerified }));
      alert(`Shop ${!form.isVerified ? 'Verified' : 'Unverified'}`);
    } catch (err) {
      alert("Status update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    setIsUpdating(true);
    try {
      const reasons = [];
      if (rejectionOptions.panBlurry) reasons.push("❌ PAN blurry");
      if (rejectionOptions.wrongAccount) reasons.push("❌ Wrong account number");
      if (rejectionOptions.gstMismatch) reasons.push("❌ GST mismatch");
      if (rejectionOptions.photoMissing) reasons.push("❌ Shop photo missing");
      if (rejectionOptions.ifscInvalid) reasons.push("❌ Invalid IFSC code");
      if (customReason.trim()) reasons.push(`❌ ${customReason.trim()}`);

      const reasonStr = reasons.join("\n");
      if (!reasonStr) {
        alert("Please select or type at least one rejection reason");
        setIsUpdating(false);
        return;
      }

      await verifyMerchant(merchantId, false, undefined, reasonStr);
      setForm(prev => ({ ...prev, isVerified: false, status: 'rejected' }));
      alert("Merchant rejected successfully");
      setShowRejectForm(false);
    } catch (err) {
      alert("Failed to reject merchant");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectDoc = async (docKey, docTitle, reason) => {
    if (!reason || !reason.trim()) return;
    setIsUpdating(true);
    try {
      const fullReason = `❌ ${docTitle}: ${reason.trim()}`;
      await verifyMerchant(merchantId, false, { [docKey]: false }, fullReason);
      
      setForm(prev => {
        const updatedKyc = { ...prev.kyc };
        if (docKey === 'bankDetails') {
          return {
            ...prev,
            isVerified: false,
            status: 'rejected',
            rejectionReason: fullReason,
            bankDetails: { ...prev.bankDetails, isBankVerified: false }
          };
        } else {
          if (updatedKyc[docKey]) {
            updatedKyc[docKey] = { ...updatedKyc[docKey], verified: false };
          }
          return {
            ...prev,
            isVerified: false,
            status: 'rejected',
            rejectionReason: fullReason,
            kyc: updatedKyc
          };
        }
      });
      alert(`Rejected ${docTitle} successfully.`);
    } catch (err) {
      alert("Failed to reject document");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerifyDoc = async (docKey, status) => {
    setIsUpdating(true);
    try {
      await verifyMerchant(merchantId, undefined, { [docKey]: status });
      if (docKey === 'bankDetails') {
        setForm(prev => ({
          ...prev,
          bankDetails: { ...prev.bankDetails, isBankVerified: status }
        }));
      } else {
        setForm(prev => ({
          ...prev,
          kyc: {
            ...prev.kyc,
            [docKey]: { ...prev.kyc[docKey], verified: status }
          }
        }));
      }
    } catch (err) {
      alert("Verification failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
      setActiveCropField(fieldName);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (blob) => {
    if (activeCropField === 'logo') setCroppedLogo(blob);
    else if (activeCropField === 'backgroundImage') setCroppedBg(blob);
    setShowCropper(false);
    setActiveCropField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = new FormData();
    payload.append("shopName", form.shopName);
    payload.append("ownerName", form.ownerName);
    payload.append("managerName", form.managerName || "");
    payload.append("managerPhoneNumber", form.managerPhoneNumber || "");
    payload.append("managerEmail", form.managerEmail || "");
    payload.append("address", JSON.stringify(form.address));
    if (croppedLogo) payload.append("logo", croppedLogo);
    if (croppedBg) payload.append("backgroundImage", croppedBg);

    try {
      await updateMerchantById(merchantId, payload);
      alert("✅ Merchant details saved");
    } catch (err) {
      alert("❌ Update failed");
    }
  };

  if (loading) return <p className="p-8 text-center text-gray-400 font-mono italic animate-pulse">LOADING_PROFILE...</p>;

  const DocCard = ({ title, doc, docKey, labelPrefix }) => (
    <div className={`p-5 rounded-2xl border-2 transition-all ${doc?.verified ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{title}</p>
          <h4 className="font-bold text-gray-800 break-all">{labelPrefix}: {doc?.number || (docKey === 'businessProof' ? doc?.proofType : 'N/A') || 'N/A'}</h4>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${doc?.verified ? 'bg-green-600 text-white' : 'bg-orange-100 text-orange-600'}`}>
          {doc?.verified ? 'Verified' : 'Pending'}
        </span>
      </div>
      
      {doc?.image?.url ? (
        <a href={doc.image.url} target="_blank" rel="noreferrer" className="block relative group aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 mb-4">
          <img src={doc.image.url} className="w-full h-full object-cover" alt={title} />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
             <span className="text-white font-bold text-xs uppercase tracking-tighter">VIEW DOCUMENT</span>
          </div>
        </a>
      ) : (
        <div className="aspect-video rounded-xl border-2 border-dashed border-gray-100 flex items-center justify-center text-gray-300 text-xs mb-4 uppercase">NO_IMAGE</div>
      )}

      {doc?.verified ? (
        <button
          type="button"
          onClick={() => handleVerifyDoc(docKey, false)}
          disabled={isUpdating}
          className="w-full py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all bg-white border border-red-100 text-red-500 hover:bg-red-50"
        >
          Revoke Approval
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleVerifyDoc(docKey, true)}
            disabled={isUpdating}
            className="flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all bg-black text-white hover:bg-gray-800 shadow-lg shadow-black/10"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => {
              const reason = prompt(`Enter rejection reason for ${title}:`);
              if (reason) handleRejectDoc(docKey, title, reason);
            }}
            disabled={isUpdating}
            className="flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all bg-red-600 text-white hover:bg-red-750 shadow-lg shadow-red-600/10"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 my-4 md:my-8 font-sans text-gray-900 bg-white min-h-screen border-x border-gray-50">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12 pb-8 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Admin Portal</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Merchant Compliance</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Merchant Audit</h2>
          <p className="text-gray-400 font-mono text-[10px] mt-2 uppercase flex items-center gap-2">
            ID: <span className="text-black select-all">{merchantId}</span>
          </p>
           <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 w-full lg:w-auto">
              <div className="text-center sm:text-right sm:mr-6">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Global Verification</p>
                 <p className={`font-black tracking-tight text-lg ${form.isVerified ? 'text-green-600' : 'text-orange-500'}`}>{form.isVerified ? 'VERIFIED_SHOP' : 'PENDING_FINAL_SIGNOFF'}</p>
              </div>
              <button 
                 onClick={handleToggleVerify}
                 disabled={isUpdating || !form.kyc.pan.verified}
                 className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-2xl active:scale-95 ${form.isVerified ? 'bg-white border-2 border-red-500 text-red-500 hover:bg-red-50' : 'bg-black text-white hover:bg-gray-800 disabled:opacity-30'}`}
              >
                 {form.isVerified ? 'Block Access' : 'Approve Account'}
              </button>
              {!form.isVerified && (
                <button 
                   onClick={() => setShowRejectForm(!showRejectForm)}
                   disabled={isUpdating}
                   className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-2xl active:scale-95 bg-red-600 text-white hover:bg-red-700"
                >
                   Reject Account
                </button>
              )}
           </div>
        </div>
        {showRejectForm && (
          <div className="mt-6 p-6 bg-red-50 border-2 border-red-100 rounded-3xl max-w-xl text-black">
            <h4 className="text-lg font-black text-red-800 mb-4 uppercase tracking-tighter italic">Select Rejection Reasons</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={rejectionOptions.panBlurry} onChange={e => setRejectionOptions({...rejectionOptions, panBlurry: e.target.checked})} className="w-4 h-4 accent-red-600" />
                PAN Card Blurry
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={rejectionOptions.wrongAccount} onChange={e => setRejectionOptions({...rejectionOptions, wrongAccount: e.target.checked})} className="w-4 h-4 accent-red-600" />
                Wrong Account Number
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={rejectionOptions.gstMismatch} onChange={e => setRejectionOptions({...rejectionOptions, gstMismatch: e.target.checked})} className="w-4 h-4 accent-red-600" />
                GST Mismatch
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={rejectionOptions.photoMissing} onChange={e => setRejectionOptions({...rejectionOptions, photoMissing: e.target.checked})} className="w-4 h-4 accent-red-600" />
                Shop Photo Missing
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={rejectionOptions.ifscInvalid} onChange={e => setRejectionOptions({...rejectionOptions, ifscInvalid: e.target.checked})} className="w-4 h-4 accent-red-600" />
                Invalid IFSC Code
              </label>
            </div>
            <div className="form-group mb-4">
              <label className="text-xs font-black uppercase text-gray-500 tracking-wider block mb-1">Custom Rejection Notes</label>
              <textarea value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Type custom rejection notes here..." className="w-full p-3 border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="flex gap-4">
              <button onClick={handleReject} disabled={isUpdating} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-red-700">Confirm Rejection</button>
              <button onClick={() => setShowRejectForm(false)} className="px-6 py-3 bg-white border border-red-200 text-red-700 font-bold rounded-xl text-xs uppercase tracking-wider">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
        <div className="xl:col-span-3 space-y-12">
          {/* KYC Documents */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black flex items-center gap-4 uppercase italic">
                <span className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-mono not-italic text-sm">01</span> 
                Identity & Taxation
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <DocCard title="Primary Identity" doc={form.kyc.pan} docKey="pan" labelPrefix="PAN" />
               <DocCard title="Taxation Records" doc={form.kyc.gst} docKey="gst" labelPrefix="GST" />
               <DocCard title="Legal Structure" doc={form.kyc.businessProof} docKey="businessProof" labelPrefix="TYPE" />
               <DocCard title="Settlement Proof" doc={form.kyc.bankProof} docKey="bankProof" labelPrefix="BANK" />
            </div>
          </section>

          {/* Bank & Settlement Details */}
          <section className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <h3 className="text-2xl font-black flex items-center gap-4 uppercase italic">
                   <span className="w-10 h-10 bg-white text-black border border-gray-200 rounded-xl flex items-center justify-center font-mono not-italic text-sm shadow-sm">02</span> 
                   Bank & Settlement
                </h3>
                <button 
                  onClick={() => handleVerifyDoc('bankDetails', !form.bankDetails.isBankVerified)}
                  className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${form.bankDetails.isBankVerified ? 'bg-green-600 text-white' : 'bg-black text-white hover:scale-105'}`}
                >
                   {form.bankDetails.isBankVerified ? '✓ BANK_VERIFIED' : 'VERIFY BANK INFO'}
                </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Account Holder</p><p className="font-bold text-lg">{form.bankDetails.accountHolderName || 'N/A'}</p></div>
                <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Account Number</p><p className="font-mono text-lg">{form.bankDetails.accountNumber || 'N/A'}</p></div>
                <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">IFSC Code</p><p className="font-mono text-lg uppercase">{form.bankDetails.ifscCode || 'N/A'}</p></div>
                <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Bank Name</p><p className="font-bold">{form.bankDetails.bankName || 'N/A'}</p></div>
                <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">UPI ID</p><p className="font-mono">{form.bankDetails.upiId || 'N/A'}</p></div>
             </div>
          </section>

          {/* Shop Context & Performance */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
             <div>
                <h3 className="text-xl font-black mb-6 uppercase flex items-center gap-3 underline decoration-4 decoration-black underline-offset-8">Categorization</h3>
                <div className="space-y-6">
                   <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Product Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {form.category?.length > 0 ? form.category.map(c => <span key={c} className="px-3 py-1 bg-gray-100 text-[10px] font-bold rounded-lg uppercase">{c}</span>) : 'NO_CATEGORIES'}
                      </div>
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Gender Focus</p>
                      <div className="flex flex-wrap gap-2">
                        {form.genderCategory?.length > 0 ? form.genderCategory.map(c => <span key={c} className="px-3 py-1 bg-black text-white text-[10px] font-bold rounded-lg uppercase">{c}</span>) : 'NO_FOCUS'}
                      </div>
                   </div>
                </div>
             </div>
             <div className="bg-white border-2 border-black p-8 rounded-3xl">
                <h3 className="text-xl font-black mb-6 uppercase flex items-center gap-3">Operations</h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-center border-b pb-3 border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Working Hours</p>
                      <p className="font-black text-sm">{form.operatingHours.openTime} — {form.operatingHours.closeTime}</p>
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">Service Days</p>
                      <div className="flex flex-wrap gap-1">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                          const isFullDay = form.operatingHours.daysOpen.some(d => d.startsWith(day));
                          return (
                            <span key={day} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black tracking-tighter ${isFullDay ? 'bg-black text-white' : 'bg-gray-100 text-gray-300'}`}>
                              {day.toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* Shipping & Fulfillment */}
          <section className="bg-yellow-50/50 border border-yellow-100 rounded-3xl p-8">
             <h3 className="text-xl font-black mb-6 uppercase italic flex items-center gap-3">Courier & Fulfillment</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={`p-4 rounded-xl border flex items-center justify-between ${form.enableCourierDelivery ? 'bg-white border-yellow-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
                   <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Courier Status</p>
                      <p className="font-black text-sm">{form.enableCourierDelivery ? 'ENABLED' : 'DISABLED'}</p>
                   </div>
                   <div className={`w-3 h-3 rounded-full ${form.enableCourierDelivery ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-yellow-200">
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Fulfillment SLA</p>
                   <p className="font-black text-sm">{form.shipsWithinHours || '24'} HOURS MAX</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-yellow-200">
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Return Policy</p>
                   <p className="font-black text-sm">{form.acceptsReturns ? 'RETURNS_ACCEPTED' : 'FINAL_SALE_ONLY'}</p>
                </div>
             </div>
          </section>

          {/* Core Profile Edit */}
          <form onSubmit={handleSubmit} className="space-y-10 border-t pt-10 border-gray-100">
             <h3 className="text-xl font-black uppercase tracking-tight">Modify Core Profile</h3>
             <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Store Display Name</label>
                  <input name="shopName" value={form.shopName} onChange={handleChange} className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 md:p-5 focus:bg-white focus:border-black outline-none transition-all shadow-sm font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Owner Full Name</label>
                  <input name="ownerName" value={form.ownerName} onChange={handleChange} className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 md:p-5 focus:bg-white focus:border-black outline-none transition-all shadow-sm font-bold" />
                </div>
             </section>

             <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Administrative Manager</label>
                  <input name="managerName" value={form.managerName} onChange={handleChange} className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 md:p-5 focus:bg-white focus:border-black outline-none transition-all shadow-sm font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Manager Direct Line</label>
                  <input name="managerPhoneNumber" value={form.managerPhoneNumber} onChange={handleChange} className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 md:p-5 focus:bg-white focus:border-black outline-none transition-all shadow-sm font-mono font-bold" />
                </div>
             </section>

             <div className="space-y-2">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Public Store Biography</label>
               <textarea name="shopDescription" value={form.shopDescription} onChange={handleChange} className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 md:p-5 focus:bg-white focus:border-black outline-none transition-all shadow-sm min-h-[120px] font-medium" />
             </div>

             <button type="submit" disabled={isUpdating} className="w-full py-6 bg-black text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-900 transition-all shadow-2xl active:scale-95 disabled:opacity-50">
               {isUpdating ? 'SYNCING_DATA...' : 'Force Apply Profile Changes'}
             </button>
          </form>
        </div>

        {/* Sidebar Status & Media */}
        <aside className="space-y-8">
           <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-3xl shadow-black/20">
              <h4 className="font-black text-sm uppercase tracking-widest border-b border-gray-800 pb-6 mb-6 italic">Secure Contact Info</h4>
              <div className="space-y-6">
                 <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-tighter">Auth Email</p><p className="font-mono text-sm break-all">{form.email}</p></div>
                 <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-tighter">Office Line</p><p className="font-mono text-sm">{form.phoneNumber || 'N/A'}</p></div>
                 <div className="pt-4 border-t border-gray-900">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-tighter">Managed By</p>
                    <p className="text-sm font-bold truncate">{form.managerName || 'ADMIN_UNASSIGNED'}</p>
                    <p className="text-[10px] font-mono text-gray-400 mt-1">{form.managerEmail}</p>
                 </div>
              </div>
           </div>

           <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 relative overflow-hidden group">
              <h4 className="font-black text-gray-900 mb-6 flex justify-between items-center text-sm uppercase">
                Precise Location
                <span className="text-[10px] text-white bg-black px-2 py-0.5 rounded italic font-mono">{form.zoneName || 'O_O_Z'}</span>
              </h4>
              <div className="text-xs space-y-2 text-gray-600 leading-relaxed font-bold uppercase">
                 <p className="text-black">{form.address.street}</p>
                 <p>{form.address.city}, {form.address.state}</p>
                 <p className="font-black tracking-widest">{form.address.postalCode}</p>
                 
                 <div className="mt-8 pt-6 border-t border-gray-200">
                    <p className="text-[10px] text-gray-400 font-black uppercase mb-1 italic">Internal Benchmarks</p>
                    <p className="text-gray-400">Landmark: <span className="text-black">{form.address.landmark || 'NOT_SPECIFIED'}</span></p>
                    <p className="text-gray-400 line-clamp-2">Note: <span className="text-black italic font-medium">{form.address.note || 'NO_INTERNAL_NOTES'}</span></p>
                 </div>
              </div>
           </div>

           {/* Brand Assets */}
           <div className="space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Store Assets</p>
              <div className="p-2 border-2 border-dashed border-gray-100 rounded-[2rem]">
                 <div className="aspect-square rounded-[1.5rem] overflow-hidden bg-white">
                    <img src={form.logo?.url} className="w-full h-full object-contain p-4 grayscale hover:grayscale-0 transition-all duration-700" alt="Logo" />
                 </div>
              </div>
              {form.backgroundImage?.url && (
                <div className="p-2 border-2 border-dashed border-gray-100 rounded-[2rem]">
                  <div className="aspect-[16/9] rounded-[1.5rem] overflow-hidden bg-white">
                      <img src={form.backgroundImage?.url} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" alt="Background" />
                  </div>
                </div>
              )}
           </div>
        </aside>
      </div>

      {showCropper && previewUrl && (
        <CropperModal imageSrc={previewUrl} onCropComplete={handleCropComplete} onClose={() => setShowCropper(false)} />
      )}
    </div>
  );
};

export default EditMerchant;
