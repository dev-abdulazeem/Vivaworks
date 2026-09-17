import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  ArrowLeftIcon,
  XMarkIcon,
  PhotoIcon,
  LinkIcon,
  BriefcaseIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  WrenchIcon,
  GlobeAltIcon,
  SparklesIcon,
  ChevronDownIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'

function PostJob() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const fileInputRef = useRef(null)

  const isBuyer = user?.role === 'buyer' || user?.isBuyer === true

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    skills: '',
    budget: '',
    budgetType: 'fixed',
    location: '',
  })
  const [mediaFiles, setMediaFiles] = useState([])
  const [mediaPreview, setMediaPreview] = useState([])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPreview, setLinkPreview] = useState(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [dragActive, setDragActive] = useState(false)

  // Redirect if not buyer
  if (!isAuthenticated) {
    navigate('/login')
    return null
  }

  if (!isBuyer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50/50 px-4">
        <div className="text-center max-w-sm bg-white rounded-2xl shadow-sm border border-emerald-100 p-8">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ExclamationCircleIcon className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Buyers Only</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Only buyers can post jobs. Enable buyer mode in your profile settings to get started.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 active:bg-emerald-800 transition-all text-sm"
          >
            Go to Profile
          </button>
        </div>
      </div>
    )
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFiles = (files) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    const totalFiles = mediaFiles.length + fileArray.length
    if (totalFiles > 5) {
      toast.error('Maximum 5 images allowed')
      return
    }

    const newPreviews = fileArray.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }))

    setMediaFiles(prev => [...prev, ...fileArray])
    setMediaPreview(prev => [...prev, ...newPreviews])
  }

  const handleMediaSelect = (e) => {
    handleFiles(e.target.files)
  }

  const removeMedia = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
    setMediaPreview(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const fetchLinkPreview = async () => {
    if (!linkUrl.trim()) return
    if (!linkUrl.startsWith('http')) {
      toast.error('Please enter a valid URL starting with http:// or https://')
      return
    }

    setLinkLoading(true)
    try {
      const response = await api.get(`/utils/link-preview?url=${encodeURIComponent(linkUrl)}`)
      setLinkPreview(response.data)
      toast.success('Link preview loaded')
    } catch (err) {
      setLinkPreview({
        url: linkUrl,
        title: linkUrl,
        description: '',
        image: ''
      })
    } finally {
      setLinkLoading(false)
    }
  }

  const removeLink = () => {
    setLinkUrl('')
    setLinkPreview(null)
  }

  const uploadMediaToCloudinary = async () => {
    if (mediaFiles.length === 0) return []

    const uploadedUrls = []
    for (const file of mediaFiles) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const response = await api.post('/upload/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        if (response.data.url) {
          uploadedUrls.push(response.data.url)
        }
      } catch (err) {
        console.error('Upload error:', err)
        toast.error(err.response?.data?.message || 'Failed to upload image')
      }
    }
    return uploadedUrls
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.title.trim()) newErrors.title = 'Job title is required'
    else if (formData.title.length > 200) newErrors.title = 'Title must be under 200 characters'

    if (!formData.description.trim()) newErrors.description = 'Job description is required'
    else if (formData.description.length > 10000) newErrors.description = 'Description must be under 10000 characters'

    if (formData.budget && parseFloat(formData.budget) < 0) {
      newErrors.budget = 'Budget must be positive'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)

    try {
      let mediaUrls = []
      if (mediaFiles.length > 0) {
        toast.loading('Uploading images...')
        mediaUrls = await uploadMediaToCloudinary()
        toast.dismiss()
      }

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        skills: formData.skills
          ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        budget: formData.budget ? parseFloat(formData.budget) : null,
        budgetType: formData.budgetType,
        location: formData.location.trim() || null,
        media: mediaUrls,
      }

      if (linkPreview) {
        payload.linkUrl = linkPreview.url
        payload.linkTitle = linkPreview.title
        payload.linkImage = linkPreview.image
        payload.linkDesc = linkPreview.description
      }

      const response = await api.post('/jobs', payload)
      toast.success('Job posted successfully!')
      navigate(`/jobs/${response.data.job.id}`)
    } catch (err) {
      console.error('Post job error:', err)
      toast.error(err.response?.data?.message || 'Failed to post job')
    } finally {
      setSubmitting(false)
    }
  }

  const budgetOptions = [
    { value: 'fixed', label: 'Fixed Price', desc: 'One-time payment' },
    { value: 'hourly', label: 'Hourly Rate', desc: 'Pay by the hour' },
    { value: 'retainer', label: 'Monthly Retainer', desc: 'Recurring monthly' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-600 transition-colors mb-5 text-sm font-medium"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <SparklesIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Post a New Job</h1>
              <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">
                Describe your project and find the perfect freelancer
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Title */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <DocumentTextIcon className="w-4 h-4 text-emerald-500" />
              Job Title
              <span className="text-red-400 text-xs font-normal ml-auto">Required</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Design a Mobile Banking App UI"
              className={`w-full px-4 py-3 bg-gray-50/50 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all ${
                errors.title ? 'border-red-300 bg-red-50/50 focus:bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <ExclamationCircleIcon className="w-3.5 h-3.5" />
                {errors.title}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2 text-right">{formData.title.length}/200</p>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <DocumentTextIcon className="w-4 h-4 text-emerald-500" />
              Job Description
              <span className="text-red-400 text-xs font-normal ml-auto">Required</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={6}
              placeholder="Describe the project in detail. What do you need? What are the deliverables? Any specific requirements?"
              className={`w-full px-4 py-3 bg-gray-50/50 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none resize-none transition-all ${
                errors.description ? 'border-red-300 bg-red-50/50 focus:bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <ExclamationCircleIcon className="w-3.5 h-3.5" />
                {errors.description}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2 text-right">{formData.description.length}/10000</p>
          </div>

          {/* Skills */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <WrenchIcon className="w-4 h-4 text-emerald-500" />
              Required Skills
            </label>
            <input
              type="text"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="e.g. React, Figma, UI Design, Node.js"
              className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all"
            />
            <p className="text-xs text-gray-400 mt-2">Separate skills with commas</p>
          </div>

          {/* Budget & Type */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <CurrencyDollarIcon className="w-4 h-4 text-emerald-500" />
              Budget
            </label>

            <div className="grid sm:grid-cols-3 gap-2 mb-4">
              {budgetOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, budgetType: opt.value }))}
                  className={`relative px-4 py-3 rounded-xl border text-left transition-all ${
                    formData.budgetType === opt.value
                      ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                  {formData.budgetType === opt.value && (
                    <CheckCircleIcon className="absolute top-2 right-2 w-4 h-4 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₦</span>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="Enter amount"
                min="0"
                className={`w-full pl-9 pr-4 py-3 bg-gray-50/50 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all ${
                  errors.budget ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                }`}
              />
            </div>
            {errors.budget && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <ExclamationCircleIcon className="w-3.5 h-3.5" />
                {errors.budget}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">Leave empty for negotiable budget</p>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <MapPinIcon className="w-4 h-4 text-emerald-500" />
              Location
            </label>
            <div className="relative">
              <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Lagos, Nigeria or Remote"
                className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all"
              />
            </div>
          </div>

          {/* Media Upload */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <PhotoIcon className="w-4 h-4 text-emerald-500" />
              Attachments
            </label>

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-emerald-400 bg-emerald-50/50'
                  : 'border-gray-200 bg-gray-50/30 hover:border-emerald-300 hover:bg-emerald-50/20'
              }`}
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <CloudArrowUpIcon className={`w-6 h-6 ${dragActive ? 'text-emerald-600' : 'text-emerald-500'}`} />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {dragActive ? 'Drop files here' : 'Click or drag files to upload'}
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF — up to 5 images</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
                className="hidden"
              />
            </div>

            {/* Media Previews */}
            {mediaPreview.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                {mediaPreview.map((media, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group border border-gray-100">
                    <img
                      src={media.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeMedia(index) }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 backdrop-blur text-gray-600 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Link Attachment */}
            <div className="border-t border-gray-100 mt-5 pt-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <LinkIcon className="w-4 h-4 text-emerald-500" />
                Attach Link
              </label>
              {!linkPreview ? (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <GlobeAltIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchLinkPreview}
                    disabled={linkLoading || !linkUrl.trim()}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-emerald-100 hover:text-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {linkLoading ? (
                      <CloudArrowUpIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      'Add'
                    )}
                  </button>
                </div>
              ) : (
                <div className="relative p-4 bg-gray-50/70 rounded-xl border border-gray-100">
                  <button
                    type="button"
                    onClick={removeLink}
                    className="absolute top-2.5 right-2.5 w-7 h-7 bg-white text-gray-400 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all shadow-sm border border-gray-100"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex gap-3 pr-8">
                    {linkPreview.image && (
                      <img
                        src={linkPreview.image}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-100"
                      />
                    )}
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm line-clamp-1">
                        {linkPreview.title}
                      </h4>
                      {linkPreview.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                          {linkPreview.description}
                        </p>
                      )}
                      <p className="text-xs text-emerald-600 mt-1 truncate font-medium">
                        {linkPreview.url}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all active:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-600/20"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <BriefcaseIcon className="w-4 h-4" />
                  Post Job
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PostJob
