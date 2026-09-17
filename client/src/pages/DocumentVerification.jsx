import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  ShieldCheckIcon,
  DocumentTextIcon,
  CameraIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserIcon,
  MapPinIcon,
  CalendarIcon,
  CreditCardIcon,
  ArrowLeftIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'

function DocumentVerification() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [requirements, setRequirements] = useState(null)
  const [status, setStatus] = useState(null)

  // Form state
  const [selectedDocType, setSelectedDocType] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    documentNumber: '',
    dateOfBirth: '',
    expiryDate: '',
    country: '',
    address: '',
  })

  // File state
  const [frontImage, setFrontImage] = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [backPreview, setBackPreview] = useState(null)
  const [selfieImage, setSelfieImage] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)

  const fileInputRef = useRef(null)
  const backInputRef = useRef(null)
  const selfieInputRef = useRef(null)

  // Load requirements and status on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [reqRes, statusRes] = await Promise.all([
        api.get('/verification/requirements'),
        api.get('/verification/status'),
      ])
      setRequirements(reqRes.data)
      setStatus(statusRes.data)

      // If already verified, show success screen
      if (statusRes.data.kycStatus === 'VERIFIED') {
        setStep(5)
      }
      // If pending or under review, show waiting screen
      else if (statusRes.data.kycStatus === 'PENDING' || statusRes.data.kycStatus === 'UNDER_REVIEW') {
        setStep(4)
      }
    } catch (err) {
      setError('Failed to load verification requirements')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e, type) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    const previewUrl = URL.createObjectURL(file)

    if (type === 'front') {
      setFrontImage(file)
      setFrontPreview(previewUrl)
    } else if (type === 'back') {
      setBackImage(file)
      setBackPreview(previewUrl)
    } else if (type === 'selfie') {
      setSelfieImage(file)
      setSelfiePreview(previewUrl)
    }
    setError('')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const getSelectedDocConfig = () => {
    if (!requirements) return null
    return requirements.requirements.find(r => r.type === selectedDocType)
  }

  const validateStep = () => {
    if (step === 1) {
      if (!selectedDocType) {
        setError('Please select a document type')
        return false
      }
    }
    if (step === 2) {
      if (!formData.fullName.trim()) { setError('Full name is required'); return false }
      if (!formData.documentNumber.trim()) { setError('Document number is required'); return false }
      if (!formData.country.trim()) { setError('Country is required'); return false }
    }
    if (step === 3) {
      const docConfig = getSelectedDocConfig()
      if (!frontImage) { setError('Front image of document is required'); return false }
      if (docConfig?.requiresBack && !backImage) { setError('Back image is required'); return false }
      if (docConfig?.requiresSelfie && !selfieImage) { setError('Live selfie is required'); return false }
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    setStep(prev => prev + 1)
    setError('')
  }

  const handleBack = () => {
    setStep(prev => prev - 1)
    setError('')
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setIsSubmitting(true)
    setError('')

    try {
      const data = new FormData()
      data.append('documentType', selectedDocType)
      data.append('fullName', formData.fullName)
      data.append('documentNumber', formData.documentNumber)
      data.append('country', formData.country)
      if (formData.dateOfBirth) data.append('dateOfBirth', formData.dateOfBirth)
      if (formData.expiryDate) data.append('expiryDate', formData.expiryDate)
      if (formData.address) data.append('address', formData.address)
          if (frontImage) data.append('idImageFront', frontImage)
          if (backImage) data.append('idImageBack', backImage)
          if (selfieImage) data.append('selfieImage', selfieImage)
      await api.post('/verification/submit', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSuccess('Documents submitted successfully! Awaiting admin review.')
      setStep(4)
      // Refresh status
      const statusRes = await api.get('/verification/status')
      setStatus(statusRes.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit documents. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // RENDER: LOADING
  // ============================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading verification requirements...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: ALREADY VERIFIED
  // ============================================
  if (step === 5) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheckIcon className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Identity Verified</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Your identity has been successfully verified. You now have full access to all platform features.
            </p>
            <div className="bg-emerald-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-emerald-700 font-semibold">
                <CheckCircleIcon className="w-5 h-5" />
                <span>Verified on {status?.kycApprovedAt ? new Date(status.kycApprovedAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/feed')}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]"
            >
              Go to Dashboard
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: PENDING / UNDER REVIEW
  // ============================================
  if (step === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ClockIcon className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Under Review</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Your documents have been submitted and are currently being reviewed by our team. This usually takes 1-2 business days.
            </p>

            {status?.verification?.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <XCircleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700 text-sm">Previous rejection reason:</p>
                    <p className="text-red-600 text-sm mt-1">{status.verification.rejectionReason}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                <span className="text-sm text-gray-500">Document Type</span>
                <span className="text-sm font-semibold text-gray-900">{status?.verification?.documentType?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                <span className="text-sm text-gray-500">Submitted</span>
                <span className="text-sm font-semibold text-gray-900">
                  {status?.verification?.submittedAt ? new Date(status.verification.submittedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                <span className="text-sm text-gray-500">Status</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                  <ClockIcon className="w-3.5 h-3.5" />
                  {status?.kycStatus}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-[0.98]"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: REJECTED - ALLOW RESUBMISSION
  // ============================================
  if (status?.kycStatus === 'REJECTED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircleIcon className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Verification Rejected</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Your document verification was rejected. Please review the reason below and resubmit.
            </p>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
              <p className="font-semibold text-red-700 text-sm mb-1">Rejection Reason:</p>
              <p className="text-red-600 text-sm">{status?.verification?.rejectionReason}</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-amber-700 text-sm">
                  You have <strong>{3 - (status?.kycRejectionCount || 0)}</strong> remaining attempts. After 3 rejections, your account may be suspended.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setStep(1)
                setStatus(null)
              }}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]"
            >
              Resubmit Documents
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const docConfig = getSelectedDocConfig()

  // ============================================
  // MAIN FORM RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheckIcon className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Identity Verification</h1>
          <p className="mt-2 text-gray-500">
            {requirements?.userType === 'FREELANCER'
              ? 'Complete strict verification to start working on the platform'
              : 'Verify your identity to hire with confidence'}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
            {requirements?.strictnessLevel === 'STRICT' ? 'Strict Verification Required' : 'Standard Verification'}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s === step ? 'bg-emerald-600 text-white' :
                s < step ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-400'
              }`}>
                {s < step ? <CheckCircleIcon className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 rounded-full ${s < step ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Error / Success */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3">
            <XCircleIcon className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 shrink-0" />
            {success}
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {/* STEP 1: Select Document Type */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Select Document Type</h2>
                <p className="text-sm text-gray-500">Choose the government-issued ID you want to verify with</p>
              </div>

              <div className="grid gap-3">
                {requirements?.requirements?.map((doc) => (
                  <button
                    key={doc.type}
                    onClick={() => {
                      setSelectedDocType(doc.type)
                      setError('')
                    }}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl text-left transition-all ${
                      selectedDocType === doc.type
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedDocType === doc.type ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      <DocumentTextIcon className={`w-6 h-6 ${
                        selectedDocType === doc.type ? 'text-emerald-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{doc.label}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {doc.requiresBack && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <DocumentTextIcon className="w-3 h-3" /> Front + Back
                          </span>
                        )}
                        {!doc.requiresBack && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <DocumentTextIcon className="w-3 h-3" /> Single Page
                          </span>
                        )}
                        {doc.requiresSelfie && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <CameraIcon className="w-3 h-3" /> Selfie Required
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedDocType === doc.type && (
                      <CheckCircleIcon className="w-6 h-6 text-emerald-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Personal Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Document Details</h2>
                <p className="text-sm text-gray-500">Enter the information exactly as it appears on your document</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name (as on document)
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Document Number
                  </label>
                  <div className="relative">
                    <CreditCardIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="documentNumber"
                      value={formData.documentNumber}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                      placeholder="A12345678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Expiry Date
                    </label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        name="expiryDate"
                        value={formData.expiryDate}
                        onChange={handleInputChange}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Country of Issue
                  </label>
                  <div className="relative">
                    <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                      placeholder="Nigeria"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address (Optional)
                  </label>
                  <div className="relative">
                    <MapPinIcon className="absolute left-3.5 top-3 w-5 h-5 text-gray-400" />
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all resize-none"
                      placeholder="123 Main Street, Lagos"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Upload Documents */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Upload Documents</h2>
                <p className="text-sm text-gray-500">Upload clear, high-quality images of your documents</p>
              </div>

              {/* Front Image */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Front of Document <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all text-center ${
                    frontPreview ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'front')}
                    className="hidden"
                  />
                  {frontPreview ? (
                    <div className="relative">
                      <img src={frontPreview} alt="Front" className="max-h-48 mx-auto rounded-lg" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setFrontImage(null)
                          setFrontPreview(null)
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <XCircleIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto">
                        <DocumentTextIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">Click to upload front image</p>
                      <p className="text-xs text-gray-400">JPG, PNG, WebP up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Back Image */}
              {docConfig?.requiresBack && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Back of Document <span className="text-red-500">*</span>
                  </label>
                  <div
                    onClick={() => backInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all text-center ${
                      backPreview ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      ref={backInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'back')}
                      className="hidden"
                    />
                    {backPreview ? (
                      <div className="relative">
                        <img src={backPreview} alt="Back" className="max-h-48 mx-auto rounded-lg" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setBackImage(null)
                            setBackPreview(null)
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto">
                          <DocumentTextIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">Click to upload back image</p>
                        <p className="text-xs text-gray-400">JPG, PNG, WebP up to 10MB</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Selfie */}
              {docConfig?.requiresSelfie && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Live Selfie <span className="text-red-500">*</span>
                  </label>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                    <p className="text-xs text-amber-700 flex items-center gap-2">
                      <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                      Take a clear photo of your face. Make sure lighting is good and your face is fully visible.
                    </p>
                  </div>
                  <div
                    onClick={() => selfieInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all text-center ${
                      selfiePreview ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      ref={selfieInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => handleFileChange(e, 'selfie')}
                      className="hidden"
                    />
                    {selfiePreview ? (
                      <div className="relative">
                        <img src={selfiePreview} alt="Selfie" className="max-h-48 mx-auto rounded-lg" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelfieImage(null)
                            setSelfiePreview(null)
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto">
                          <CameraIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">Click to take/upload selfie</p>
                        <p className="text-xs text-gray-400">Clear photo of your face required</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Submission Summary</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Document Type</span>
                  <span className="font-medium text-gray-900">{selectedDocType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Name on Document</span>
                  <span className="font-medium text-gray-900">{formData.fullName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Document Number</span>
                  <span className="font-medium text-gray-900">{formData.documentNumber}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-6 py-3 text-gray-600 font-semibold hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]"
              >
                Continue
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit for Review
                    <ShieldCheckIcon className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentVerification