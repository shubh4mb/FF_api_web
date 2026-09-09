import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  CreditCard,
  Clock,
  MapPin,
  Truck,
  Store,
  Phone,
  Mail,
  User,
  Copy,
  Check,
  ExternalLink,
  Eye,
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronRight,
  Image as ImageIcon,
  Maximize2,
  FileQuestion,
  Edit3,
  SlidersHorizontal,
  Sparkles,
  PackageCheck,
  Lock,
  Unlock,
  HelpCircle,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
  Save,
  Package
} from 'lucide-react';
import { getMerchantById, updateMerchantById, verifyMerchant } from '../../api/merchants';
import CropperModal from '../../components/CropperModal';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EditMerchant = () => {
  const { merchantId } = useParams();
  const navigate = useNavigate();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState('compliance'); // 'compliance' | 'profile' | 'operations' | 'products'

  // Main Merchant Form State
  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    managerName: '',
    email: '',
    phoneNumber: '',
    pickupContactNumber: '',
    storeMobileNumber: '',
    managerPhoneNumber: '',
    managerEmail: '',
    shopDescription: '',
    businessType: 'Individual',
    category: [],
    genderCategory: [],
    address: { street: '', city: '', state: '', postalCode: '', landmark: '', note: '', latitude: '', longitude: '' },
    bankDetails: { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', upiId: '', isBankVerified: false },
    kyc: {
      pan: { number: '', image: null, verified: false },
      gst: { number: '', image: null, verified: false },
      businessProof: { proofType: '', image: null, verified: false },
      bankProof: { image: null, verified: false },
      isKycVerified: false,
    },
    enableCourierDelivery: false,
    shipsWithinHours: 24,
    acceptsReturns: true,
    operatingHours: { openTime: '09:00', closeTime: '21:00', daysOpen: DAYS_OF_WEEK },
    logo: null,
    backgroundImage: null,
    isVerified: false,
    isActive: false,
    status: 'incomplete',
    isRegistrationFeePaid: false,
    rejectionReason: '',
    zoneName: '',
    createdAt: null,
    stats: { totalProducts: 0, totalOrders: 0, totalReturns: 0 }
  });

  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Image Cropper State
  const [showCropper, setShowCropper] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [croppedLogo, setCroppedLogo] = useState(null);
  const [croppedBg, setCroppedBg] = useState(null);
  const [activeCropField, setActiveCropField] = useState(null);

  // Document Lightbox Modal State
  const [lightbox, setLightbox] = useState({
    isOpen: false,
    title: '',
    imageUrl: '',
    docNumber: '',
    verified: false,
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Rejection Modal State
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    target: 'merchant', // 'merchant' | 'pan' | 'gst' | 'businessProof' | 'bankProof' | 'bankDetails'
    targetTitle: 'Merchant Registration',
    customReason: '',
    reasons: {
      panBlurry: false,
      nameMismatch: false,
      gstMismatch: false,
      invalidProof: false,
      addressMismatch: false,
      chequeBlurry: false,
      ifscInvalid: false,
      incompleteInfo: false,
    }
  });

  useEffect(() => {
    fetchMerchantDetails();
  }, [merchantId]);

  const fetchMerchantDetails = async () => {
    try {
      setLoading(true);
      const data = await getMerchantById(merchantId);
      const m = data.merchant;
      if (!m) {
        toast.error('Merchant not found');
        return;
      }
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
          isKycVerified: m.kyc?.isKycVerified || false,
        },
        operatingHours: {
          openTime: m.operatingHours?.open || m.operatingHours?.openTime || '09:00',
          closeTime: m.operatingHours?.close || m.operatingHours?.closeTime || '21:00',
          daysOpen: m.operatingHours?.daysOpen?.length ? m.operatingHours.daysOpen : DAYS_OF_WEEK,
        },
        stats: m.stats || { totalProducts: 0, totalOrders: 0, totalReturns: 0 }
      });
    } catch (err) {
      console.error('Failed to fetch merchant:', err);
      toast.error('Failed to load merchant details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Form field change handler
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

  // Multi-select toggle for days/categories/genders
  const toggleArrayItem = (fieldName, item) => {
    setForm(prev => {
      const currentList = prev[fieldName] || [];
      const updated = currentList.includes(item)
        ? currentList.filter(i => i !== item)
        : [...currentList, item];
      return { ...prev, [fieldName]: updated };
    });
  };

  const toggleDayOpen = (day) => {
    setForm(prev => {
      const currentDays = prev.operatingHours?.daysOpen || [];
      const updated = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      return {
        ...prev,
        operatingHours: {
          ...prev.operatingHours,
          daysOpen: updated,
        }
      };
    });
  };

  // --- Image Handling ---
  const handleImageChange = (e, fieldName) => {
    const file = e.target.files?.[0];
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
    toast.success('Image cropped successfully. Click "Save Profile Changes" to submit.');
  };

  // --- Save Profile Changes ---
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setIsUpdating(true);
    const payload = new FormData();
    payload.append('shopName', form.shopName || '');
    payload.append('ownerName', form.ownerName || '');
    payload.append('shopDescription', form.shopDescription || '');
    payload.append('businessType', form.businessType || 'Individual');
    payload.append('phoneNumber', form.phoneNumber || '');
    payload.append('pickupContactNumber', form.pickupContactNumber || '');
    payload.append('storeMobileNumber', form.storeMobileNumber || '');
    payload.append('managerName', form.managerName || '');
    payload.append('managerPhoneNumber', form.managerPhoneNumber || '');
    payload.append('managerEmail', form.managerEmail || '');
    payload.append('address', JSON.stringify(form.address));
    payload.append('operatingHours', JSON.stringify(form.operatingHours));
    payload.append('enableCourierDelivery', form.enableCourierDelivery);
    payload.append('shipsWithinHours', form.shipsWithinHours);
    payload.append('acceptsReturns', form.acceptsReturns);
    
    if (form.category?.length) {
      form.category.forEach(c => payload.append('category[]', c));
    }
    if (form.genderCategory?.length) {
      form.genderCategory.forEach(g => payload.append('genderCategory[]', g));
    }

    if (croppedLogo) payload.append('logo', croppedLogo);
    if (croppedBg) payload.append('backgroundImage', croppedBg);

    try {
      await updateMerchantById(merchantId, payload);
      toast.success('Merchant details saved successfully!');
      fetchMerchantDetails();
    } catch (err) {
      console.error('Update failed:', err);
      toast.error(err.message || 'Failed to update merchant profile');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Document Verification / Revocation ---
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
      toast.success(status ? 'Document verified successfully!' : 'Document approval revoked');
    } catch (err) {
      toast.error('Failed to update verification status');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Registration & Status Transitions ---
  const handleApproveRegistration = async () => {
    setIsUpdating(true);
    try {
      await verifyMerchant(merchantId, true);
      toast.success('Merchant approved! Status updated to Pending Payment.');
      fetchMerchantDetails();
    } catch (err) {
      toast.error('Failed to approve merchant');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprovePaymentAndActivate = async () => {
    setIsUpdating(true);
    try {
      await verifyMerchant(merchantId, undefined, undefined, undefined, 'active');
      toast.success('Payment approved! Merchant store is now active and live.');
      fetchMerchantDetails();
    } catch (err) {
      toast.error('Failed to activate merchant');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDirectActivate = async () => {
    if (!window.confirm('Are you sure you want to directly activate this store and waive/skip registration fee verification?')) return;
    setIsUpdating(true);
    try {
      await verifyMerchant(merchantId, undefined, undefined, undefined, 'active');
      toast.success('Store activated directly!');
      fetchMerchantDetails();
    } catch (err) {
      toast.error('Failed to activate store');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSuspendStore = async () => {
    if (!window.confirm('Are you sure you want to suspend this store? The merchant will not receive orders while suspended.')) return;
    setIsUpdating(true);
    try {
      await verifyMerchant(merchantId, undefined, undefined, 'Store suspended by admin.', 'suspended');
      toast.success('Store suspended');
      fetchMerchantDetails();
    } catch (err) {
      toast.error('Failed to suspend store');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Open Rejection Modal ---
  const openRejectionModal = (target = 'merchant', targetTitle = 'Merchant Registration') => {
    setRejectModal({
      isOpen: true,
      target,
      targetTitle,
      customReason: '',
      reasons: {
        panBlurry: false,
        nameMismatch: false,
        gstMismatch: false,
        invalidProof: false,
        addressMismatch: false,
        chequeBlurry: false,
        ifscInvalid: false,
        incompleteInfo: false,
      }
    });
  };

  const handleConfirmRejection = async () => {
    const { target, targetTitle, reasons, customReason } = rejectModal;
    const notes = [];

    if (reasons.panBlurry) notes.push('PAN card image is blurry or illegible.');
    if (reasons.nameMismatch) notes.push('Name on document/bank account does not match owner name.');
    if (reasons.gstMismatch) notes.push('GSTIN number or certificate details do not match.');
    if (reasons.invalidProof) notes.push('Invalid or unaccepted business registration document.');
    if (reasons.addressMismatch) notes.push('Address on proof document does not match store location.');
    if (reasons.chequeBlurry) notes.push('Bank proof / cancelled cheque is blurry or missing account details.');
    if (reasons.ifscInvalid) notes.push('Invalid IFSC code or branch not found.');
    if (reasons.incompleteInfo) notes.push('Store registration details are incomplete.');
    if (customReason.trim()) notes.push(customReason.trim());

    if (notes.length === 0) {
      toast.error('Please select at least one reason or provide notes.');
      return;
    }

    const fullReasonStr = notes.map(n => `• ${n}`).join('\n');
    setIsUpdating(true);

    try {
      if (target === 'merchant') {
        // Global merchant rejection
        await verifyMerchant(merchantId, false, undefined, fullReasonStr, 'rejected');
        toast.success('Merchant registration rejected with feedback.');
      } else {
        // Individual document rejection
        const kycPayload = {};
        if (target === 'bankDetails') {
          kycPayload.bankDetails = false;
        } else {
          kycPayload[target] = false;
        }
        const docFormattedReason = `Issue with ${targetTitle}:\n${fullReasonStr}`;
        await verifyMerchant(merchantId, false, kycPayload, docFormattedReason, 'rejected');
        toast.success(`${targetTitle} rejected. Rejection notice sent to merchant.`);
      }
      setRejectModal(prev => ({ ...prev, isOpen: false }));
      fetchMerchantDetails();
    } catch (err) {
      toast.error('Failed to submit rejection');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Document Lightbox ---
  const openLightbox = (title, imageUrl, docNumber, verified) => {
    if (!imageUrl) return;
    setLightbox({
      isOpen: true,
      title,
      imageUrl,
      docNumber,
      verified,
    });
    setZoomLevel(1);
    setRotation(0);
  };

  const closeLightbox = () => {
    setLightbox(prev => ({ ...prev, isOpen: false }));
  };

  // --- Computed KYC Stats ---
  const kycAudit = useMemo(() => {
    const docs = [
      { key: 'pan', title: 'PAN Card', data: form.kyc?.pan, required: true },
      { key: 'businessProof', title: 'Business Proof', data: form.kyc?.businessProof, required: true },
      { key: 'bankProof', title: 'Bank Proof', data: form.kyc?.bankProof, required: true },
    ];

    const total = docs.length;
    let uploadedCount = 0;
    let verifiedCount = 0;

    docs.forEach(d => {
      const hasContent = !!d.data?.image?.url || !!d.data?.number || !!d.data?.proofType;
      if (hasContent) uploadedCount++;
      if (d.data?.verified) verifiedCount++;
    });

    return { total, uploadedCount, verifiedCount, isComplete: verifiedCount === total };
  }, [form.kyc]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium text-sm animate-pulse">Loading merchant profile & compliance records...</p>
      </div>
    );
  }

  // Helper for Status Badge
  const renderStatusBadge = () => {
    const s = form.status;
    if (s === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Active Store
        </span>
      );
    }
    if (s === 'payment_pending_verification') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          Payment Awaiting Approval
        </span>
      );
    }
    if (s === 'pending_payment') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
          <Clock className="w-3.5 h-3.5" />
          Pending Registration Payment
        </span>
      );
    }
    if (s === 'pending_verification') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3.5 h-3.5" />
          Awaiting Admin Review
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <XCircle className="w-3.5 h-3.5" />
          Registration Rejected
        </span>
      );
    }
    if (s === 'suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800 border border-slate-300">
          <Lock className="w-3.5 h-3.5" />
          Suspended
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        Incomplete Onboarding
      </span>
    );
  };

  // Helper for Document Cards
  const renderDocCard = ({ title, docKey, docData, labelPrefix, helperText }) => {
    const hasImage = !!docData?.image?.url;
    const hasValue = !!docData?.number || !!docData?.proofType;
    const isUploaded = hasImage || hasValue;
    const isVerified = !!docData?.verified;

    return (
      <div className={`rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between ${
        isVerified 
          ? 'bg-emerald-50/50 border-emerald-200' 
          : !isUploaded 
            ? 'bg-slate-50 border-slate-200/80' 
            : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
      }`}>
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 ${isVerified ? 'text-emerald-600' : !isUploaded ? 'text-slate-400' : 'text-amber-500'}`} />
                <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{helperText}</p>
            </div>

            {/* Document Status Tag */}
            {isVerified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </span>
            ) : !isUploaded ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-600">
                <FileQuestion className="w-3 h-3" />
                Not Uploaded
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                <Clock className="w-3 h-3" />
                Awaiting Audit
              </span>
            )}
          </div>

          {/* Identifier/Number */}
          <div className="mb-4 bg-white/60 p-2.5 rounded-xl border border-slate-100 text-xs">
            <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">{labelPrefix}</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className={`font-mono font-bold ${isUploaded ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                {docKey === 'businessProof' 
                  ? (docData?.proofType ? docData.proofType.replace('_', ' ').toUpperCase() : 'Not Specified')
                  : (docData?.number || 'No Number Provided')}
              </span>
              {docData?.number && (
                <button
                  type="button"
                  onClick={() => handleCopy(docData.number, `${docKey}-number`)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title="Copy"
                >
                  {copiedKey === `${docKey}-number` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Image Thumbnail / Preview Container */}
          <div className="mb-4">
            {hasImage ? (
              <div 
                onClick={() => openLightbox(title, docData.image.url, docData.number || docData.proofType, isVerified)}
                className="group relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-900 cursor-pointer border border-slate-200 shadow-inner"
              >
                <img 
                  src={docData.image.url} 
                  alt={title} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-90 group-hover:opacity-100" 
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-bold shadow">
                    <Maximize2 className="w-3.5 h-3.5" />
                    Inspect Document
                  </span>
                </div>
              </div>
            ) : (
              <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-200 bg-slate-100/60 flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                <FileQuestion className="w-7 h-7 text-slate-300 mb-1" />
                <span>No document image file uploaded</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-slate-100">
          {!isUploaded ? (
            <div className="text-center py-1.5">
              <span className="text-[11px] text-slate-400 font-medium italic">Cannot verify or reject (No document submitted)</span>
            </div>
          ) : isVerified ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleVerifyDoc(docKey, false)}
                disabled={isUpdating}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
              >
                Revoke Approval
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleVerifyDoc(docKey, true)}
                disabled={isUpdating}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => openRejectionModal(docKey, title)}
                disabled={isUpdating}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Breadcrumbs & Merchant Title */}
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <Link to="/admin/merchants" className="hover:text-slate-800 flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Merchants Directory
                </Link>
                <span>/</span>
                <span className="text-slate-700 font-semibold">{form.shopName || 'Store Details'}</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {form.shopName || 'Unnamed Merchant'}
                </h1>
                {renderStatusBadge()}
                {form.zoneName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {form.zoneName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                Merchant ID: <span className="font-mono text-slate-600">{merchantId}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(merchantId, 'merchant-id')}
                  className="text-slate-400 hover:text-slate-600"
                  title="Copy ID"
                >
                  {copiedKey === 'merchant-id' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </p>
            </div>

            {/* Right: Quick Action Buttons based on Registration State */}
            <div className="flex flex-wrap items-center gap-2.5">
              {form.status === 'pending_verification' && (
                <>
                  <button
                    type="button"
                    onClick={handleApproveRegistration}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Registration
                  </button>
                  <button
                    type="button"
                    onClick={() => openRejectionModal('merchant', 'Merchant Registration')}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}

              {form.status === 'payment_pending_verification' && (
                <>
                  <button
                    type="button"
                    onClick={handleApprovePaymentAndActivate}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    Approve Payment & Activate Store
                  </button>
                  <button
                    type="button"
                    onClick={() => openRejectionModal('merchant', 'Registration Payment')}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all active:scale-95"
                  >
                    <XCircle className="w-4 h-4" />
                    Flag Issue
                  </button>
                </>
              )}

              {form.status === 'pending_payment' && (
                <button
                  type="button"
                  onClick={handleDirectActivate}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all"
                >
                  <Unlock className="w-4 h-4" />
                  Waive Fee & Activate Directly
                </button>
              )}

              {form.status === 'active' && (
                <button
                  type="button"
                  onClick={handleSuspendStore}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 transition-all"
                >
                  <Lock className="w-4 h-4" />
                  Suspend Store
                </button>
              )}

              {form.status === 'rejected' && (
                <button
                  type="button"
                  onClick={handleApproveRegistration}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-evaluate & Approve
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isUpdating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all"
              >
                <Save className="w-4 h-4" />
                {isUpdating ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 border-t border-slate-100 pt-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('compliance')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'compliance'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              KYC & Bank Compliance
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'compliance' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}>
                {kycAudit.verifiedCount}/{kycAudit.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Store Profile & Location
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('operations')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'operations'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              Operations & Fulfillment
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'products'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              Products & Catalog
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Context Alert Banners */}
        {form.status === 'payment_pending_verification' && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-sm">Registration Payment Awaiting Verification</h4>
                <p className="text-xs text-blue-700 mt-0.5">
                  The merchant has paid their onboarding fee via Razorpay. Verify and activate their store account.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleApprovePaymentAndActivate}
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap shadow-sm"
            >
              Approve Payment & Activate
            </button>
          </div>
        )}

        {form.status === 'rejected' && form.rejectionReason && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-900 text-sm">Registration Currently Rejected</h4>
              <p className="text-xs text-rose-700 mt-1 whitespace-pre-line font-medium">
                {form.rejectionReason}
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: KYC & BANK COMPLIANCE AUDIT */}
        {/* ========================================================================= */}
        {activeTab === 'compliance' && (
          <div className="space-y-8">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">KYC Compliance</p>
                <div className="flex items-baseline justify-between mt-2">
                  <p className="text-2xl font-black text-slate-900">{kycAudit.verifiedCount} / {kycAudit.total}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    kycAudit.isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {kycAudit.isComplete ? 'All Verified' : 'Audit Incomplete'}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(kycAudit.verifiedCount / kycAudit.total) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bank Settlement Status</p>
                <div className="flex items-baseline justify-between mt-2">
                  <p className="text-lg font-bold text-slate-900">
                    {form.bankDetails?.isBankVerified ? 'Verified' : (form.bankDetails?.accountNumber ? 'Awaiting Audit' : 'Not Added')}
                  </p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    form.bankDetails?.isBankVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {form.bankDetails?.isBankVerified ? 'Ready' : 'Action Needed'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 truncate">
                  {form.bankDetails?.bankName || 'No bank assigned'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Business Type</p>
                <p className="text-lg font-bold text-slate-900 mt-2">{form.businessType || 'Individual'}</p>
                <p className="text-[11px] text-slate-400 mt-2">Owner: {form.ownerName || 'N/A'}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registration Fee</p>
                <div className="flex items-baseline justify-between mt-2">
                  <p className="text-lg font-bold text-slate-900">
                    {form.isRegistrationFeePaid ? 'Paid' : 'Unpaid'}
                  </p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    form.isRegistrationFeePaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {form.isRegistrationFeePaid ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Stage: {form.status}</p>
              </div>
            </div>

            {/* KYC Document Cards Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-slate-700" />
                    Identity & Statutory Verification
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click document thumbnails to view high-resolution proof files. Empty documents cannot be approved or rejected.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openRejectionModal('merchant', 'Merchant Compliance')}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors inline-flex items-center gap-1.5 self-start"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Flag Compliance Issues
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. PAN Card */}
                {renderDocCard({
                  title: 'Primary PAN Identity',
                  docKey: 'pan',
                  docData: form.kyc?.pan,
                  labelPrefix: 'PAN NUMBER',
                  helperText: 'Permanent Account Number of Business / Proprietor'
                })}

                {/* 2. Business Proof */}
                {renderDocCard({
                  title: 'Legal Business Proof',
                  docKey: 'businessProof',
                  docData: form.kyc?.businessProof,
                  labelPrefix: 'DOCUMENT TYPE',
                  helperText: 'Shop License, Udyam MSME, or Rent Agreement'
                })}

                {/* 3. Bank Proof */}
                {renderDocCard({
                  title: 'Bank Account Proof',
                  docKey: 'bankProof',
                  docData: form.kyc?.bankProof,
                  labelPrefix: 'PROOF DOCUMENT',
                  helperText: 'Cancelled Cheque, Passbook, or Bank Statement'
                })}
              </div>
            </div>

            {/* Bank Details Verification Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Settlement Bank Account</h3>
                    <p className="text-xs text-slate-500">Destination account for daily/weekly order payouts</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {form.bankDetails?.isBankVerified ? (
                    <button
                      type="button"
                      onClick={() => handleVerifyDoc('bankDetails', false)}
                      disabled={isUpdating}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                    >
                      Revoke Bank Verification
                    </button>
                  ) : form.bankDetails?.accountNumber ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleVerifyDoc('bankDetails', true)}
                        disabled={isUpdating}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Verify Bank Info
                      </button>
                      <button
                        type="button"
                        onClick={() => openRejectionModal('bankDetails', 'Bank Account Details')}
                        disabled={isUpdating}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                      >
                        Reject Bank Info
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 italic">No bank info added</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Holder Name</span>
                  <p className="font-bold text-slate-900 text-sm">{form.bankDetails?.accountHolderName || 'Not Provided'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Number</span>
                  <div className="flex items-center justify-between">
                    <p className="font-mono font-bold text-slate-900 text-sm">{form.bankDetails?.accountNumber || 'Not Provided'}</p>
                    {form.bankDetails?.accountNumber && (
                      <button
                        type="button"
                        onClick={() => handleCopy(form.bankDetails.accountNumber, 'bank-acc')}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        {copiedKey === 'bank-acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">IFSC Code</span>
                  <div className="flex items-center justify-between">
                    <p className="font-mono font-bold text-slate-900 text-sm uppercase">{form.bankDetails?.ifscCode || 'Not Provided'}</p>
                    {form.bankDetails?.ifscCode && (
                      <button
                        type="button"
                        onClick={() => handleCopy(form.bankDetails.ifscCode, 'bank-ifsc')}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        {copiedKey === 'bank-ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank Name</span>
                  <p className="font-bold text-slate-900 text-sm">{form.bankDetails?.bankName || 'Not Provided'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">UPI ID (Optional)</span>
                  <p className="font-mono font-medium text-slate-900 text-sm">{form.bankDetails?.upiId || 'None'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Verification Status</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                      form.bankDetails?.isBankVerified ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {form.bankDetails?.isBankVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {form.bankDetails?.isBankVerified ? 'Verified by Admin' : 'Unverified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STORE PROFILE & LOCATION */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* Store Information */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Store className="w-5 h-5 text-slate-700" />
                Store Profile & Identity
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Shop Display Name *</label>
                  <input
                    type="text"
                    name="shopName"
                    value={form.shopName}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="e.g. Urban Threads Boutique"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Business Legal Structure</label>
                  <select
                    name="businessType"
                    value={form.businessType}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  >
                    <option value="Individual">Individual / Freelancer</option>
                    <option value="Sole Proprietor">Sole Proprietorship</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Company">Private Limited Company</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Owner Full Name *</label>
                  <input
                    type="text"
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Registered Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Store Mobile Phone</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={form.phoneNumber}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="e.g. +91 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Rider Pickup Contact Number</label>
                  <input
                    type="text"
                    name="pickupContactNumber"
                    value={form.pickupContactNumber}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="Direct dispatch number"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Store Description / Bio</label>
                <textarea
                  name="shopDescription"
                  value={form.shopDescription}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  placeholder="Public store bio visible to customers..."
                />
              </div>

              {/* Categories & Gender Target */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-3">Gender Demographics Focus</label>
                  <div className="flex flex-wrap gap-2">
                    {['Men', 'Women', 'Kids', 'Boys', 'Girls'].map(gender => {
                      const selected = form.genderCategory?.includes(gender);
                      return (
                        <button
                          key={gender}
                          type="button"
                          onClick={() => toggleArrayItem('genderCategory', gender)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            selected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {gender}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-3">Product Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {['Streetwear', 'Formal', 'Ethnic', 'Casual', 'Athleisure', 'Footwear', 'Accessories'].map(cat => {
                      const selected = form.category?.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleArrayItem('category', cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            selected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Manager / Secondary Contact */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-slate-700" />
                Store Manager Contact
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Manager Name</label>
                  <input
                    type="text"
                    name="managerName"
                    value={form.managerName}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Manager Direct Phone</label>
                  <input
                    type="text"
                    name="managerPhoneNumber"
                    value={form.managerPhoneNumber}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Manager Email</label>
                  <input
                    type="email"
                    name="managerEmail"
                    value={form.managerEmail}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="manager@store.com"
                  />
                </div>
              </div>
            </div>

            {/* Location & Physical Address */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-700" />
                Physical Address & Dispatch Hub
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Street Address</label>
                  <input
                    type="text"
                    name="address.street"
                    value={form.address?.street || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="Shop No. 4, Market Complex"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">City</label>
                  <input
                    type="text"
                    name="address.city"
                    value={form.address?.city || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">State</label>
                  <input
                    type="text"
                    name="address.state"
                    value={form.address?.state || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Postal Code (PIN)</label>
                  <input
                    type="text"
                    name="address.postalCode"
                    value={form.address?.postalCode || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Landmark</label>
                  <input
                    type="text"
                    name="address.landmark"
                    value={form.address?.landmark || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                    placeholder="Opposite Metro Pillar 42"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Rider Pickup Instructions / Notes</label>
                <textarea
                  name="address.note"
                  value={form.address?.note || ''}
                  onChange={handleChange}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  placeholder="Gate code, parking instructions for riders..."
                />
              </div>
            </div>

            {/* Store Assets (Logo & Banner) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-slate-700" />
                Store Branding Assets
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Card */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Store Logo</h4>
                      <p className="text-xs text-slate-400">1:1 Square aspect ratio</p>
                    </div>
                    <label className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800 transition-colors">
                      Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(e, 'logo')}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="w-32 h-32 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-2 shadow-inner">
                    {croppedLogo ? (
                      <img src={URL.createObjectURL(croppedLogo)} alt="Cropped Logo" className="w-full h-full object-contain" />
                    ) : form.logo?.url ? (
                      <img src={form.logo.url} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Store className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                </div>

                {/* Banner Card */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Store Header Banner</h4>
                      <p className="text-xs text-slate-400">16:9 Landscape ratio</p>
                    </div>
                    <label className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800 transition-colors">
                      Upload Banner
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(e, 'backgroundImage')}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="w-full h-32 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                    {croppedBg ? (
                      <img src={URL.createObjectURL(croppedBg)} alt="Cropped Banner" className="w-full h-full object-cover" />
                    ) : form.backgroundImage?.url ? (
                      <img src={form.backgroundImage.url} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Save Button */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="submit"
                disabled={isUpdating}
                className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all disabled:opacity-50"
              >
                {isUpdating ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: OPERATIONS & FULFILLMENT */}
        {/* ========================================================================= */}
        {activeTab === 'operations' && (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* Operating Hours */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-700" />
                Store Operating Hours & Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Opening Time</label>
                  <input
                    type="time"
                    name="operatingHours.openTime"
                    value={form.operatingHours?.openTime || '09:00'}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Closing Time</label>
                  <input
                    type="time"
                    name="operatingHours.closeTime"
                    value={form.operatingHours?.closeTime || '21:00'}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-slate-900 outline-hidden transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-3">Service Days</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map(day => {
                    const isOpen = form.operatingHours?.daysOpen?.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOpen(day)}
                        className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                          isOpen
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Courier & Delivery SLAs */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Truck className="w-5 h-5 text-slate-700" />
                Courier Delivery & Fulfillment SLAs
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-600 uppercase block mb-1">Courier Delivery</span>
                    <p className="text-xs text-slate-400">Allow orders to be shipped via standard postal courier partner</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{form.enableCourierDelivery ? 'Enabled' : 'Disabled'}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="enableCourierDelivery"
                        checked={form.enableCourierDelivery}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase block mb-1">Fulfillment Dispatch SLA</span>
                  <p className="text-xs text-slate-400 mb-4">Max hours allowed for order packaging & handover</p>
                  <select
                    name="shipsWithinHours"
                    value={form.shipsWithinHours || 24}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-hidden"
                  >
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours (Standard)</option>
                    <option value={48}>48 Hours</option>
                    <option value={72}>72 Hours</option>
                  </select>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-600 uppercase block mb-1">Return Policy Acceptance</span>
                    <p className="text-xs text-slate-400">Accept customer returns for eligible products</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{form.acceptsReturns ? 'Returns Allowed' : 'Final Sale Only'}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="acceptsReturns"
                        checked={form.acceptsReturns}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="submit"
                disabled={isUpdating}
                className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all disabled:opacity-50"
              >
                {isUpdating ? 'Saving Changes...' : 'Save Operations Settings'}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PRODUCTS & CATALOG OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Merchant Inventory & Catalog</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Manage this merchant's live inventory, price points, and active variant listings.
                </p>
                <div className="flex items-center gap-6 mt-4">
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase">Total Listed Products</span>
                    <p className="text-2xl font-black text-slate-900">{form.stats?.totalProducts || 0}</p>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Lifetime Orders</span>
                    <p className="text-2xl font-black text-slate-900">{form.stats?.totalOrders || 0}</p>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Total Returns</span>
                    <p className="text-2xl font-black text-slate-900">{form.stats?.totalReturns || 0}</p>
                  </div>
                </div>
              </div>

              <Link
                to={`/admin/products/merchant/${merchantId}`}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-sm inline-flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Open Merchant Products Catalog
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FULL-RESOLUTION DOCUMENT LIGHTBOX MODAL */}
      {/* ========================================================================= */}
      {lightbox.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          {/* Lightbox Header */}
          <div className="p-4 bg-black/50 border-b border-white/10 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm leading-tight">{lightbox.title}</h3>
                {lightbox.docNumber && (
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{lightbox.docNumber}</p>
                )}
              </div>
              {lightbox.verified ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  Verified
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                  Unverified
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <a
                href={lightbox.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={closeLightbox}
                className="p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs transition-colors ml-2"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Body Image Display */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
            <img
              src={lightbox.imageUrl}
              alt={lightbox.title}
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease',
              }}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REJECTION / COMPLIANCE ISSUE MODAL */}
      {/* ========================================================================= */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reject {rejectModal.targetTitle}</h3>
                  <p className="text-xs text-slate-400">Select issues found so the merchant can fix and re-submit.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Checkbox Presets */}
            <div className="space-y-2.5 mb-5 max-h-60 overflow-y-auto pr-1">
              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={rejectModal.reasons.panBlurry}
                  onChange={(e) => setRejectModal(prev => ({
                    ...prev,
                    reasons: { ...prev.reasons, panBlurry: e.target.checked }
                  }))}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                Document / PAN image is blurry or unreadable
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={rejectModal.reasons.nameMismatch}
                  onChange={(e) => setRejectModal(prev => ({
                    ...prev,
                    reasons: { ...prev.reasons, nameMismatch: e.target.checked }
                  }))}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                Name mismatch (Document name doesn't match owner name)
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={rejectModal.reasons.gstMismatch}
                  onChange={(e) => setRejectModal(prev => ({
                    ...prev,
                    reasons: { ...prev.reasons, gstMismatch: e.target.checked }
                  }))}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                GSTIN certificate invalid or mismatched
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={rejectModal.reasons.addressMismatch}
                  onChange={(e) => setRejectModal(prev => ({
                    ...prev,
                    reasons: { ...prev.reasons, addressMismatch: e.target.checked }
                  }))}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                Address on proof does not match store location
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={rejectModal.reasons.chequeBlurry}
                  onChange={(e) => setRejectModal(prev => ({
                    ...prev,
                    reasons: { ...prev.reasons, chequeBlurry: e.target.checked }
                  }))}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                Bank cheque / passbook image blurry or missing account details
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={rejectModal.reasons.ifscInvalid}
                  onChange={(e) => setRejectModal(prev => ({
                    ...prev,
                    reasons: { ...prev.reasons, ifscInvalid: e.target.checked }
                  }))}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                Invalid IFSC Code or Account Number
              </label>
            </div>

            {/* Custom Notes */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Additional Specific Feedback for Merchant</label>
              <textarea
                value={rejectModal.customReason}
                onChange={(e) => setRejectModal(prev => ({ ...prev, customReason: e.target.value }))}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-hidden"
                placeholder="Type any specific details or corrections required..."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={isUpdating}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isUpdating ? 'Submitting...' : 'Confirm Rejection'}
              </button>
              <button
                type="button"
                onClick={() => setRejectModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {showCropper && previewUrl && (
        <CropperModal
          imageSrc={previewUrl}
          onCropComplete={handleCropComplete}
          onClose={() => setShowCropper(false)}
        />
      )}
    </div>
  );
};

export default EditMerchant;
