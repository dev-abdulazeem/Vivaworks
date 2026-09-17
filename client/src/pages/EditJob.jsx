import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  ArrowLeft,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  AlertCircle,
  Loader2,
  CloudUpload
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const EditJob = () => {
  const { jobId } = useParams()
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
  const [originalJob, setOriginalJob] = useState(null)
  const [mediaFiles, setMediaFiles] = useState([])
  const [mediaPreview, setMediaPreview] = useState([])
  const [existingMedia, setExistingMedia] = useState([])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPreview, setLinkPreview] = useState(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!isBuyer) {
      navigate('/')
      return
    }
    fetchJob()
  }, [jobId, isAuthenticated, isBuyer])

  const fetchJob = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/jobs/${jobId}`)
      const job = response.data.job

      if (job.buyerId !== user?.id) {
        toast.error('You can only edit your own jobs')
        navigate('/jobs')
        return
      }

      setOriginalJob(job)
      setFormData({
        title: job.title || '',
        description: job.description || '',
        skills: job.skills ? job.skills.join(', ') : '',
        budget: job.budget || '',
        budgetType: job.budgetType || 'fixed',
        location: job.location || '',
      })
      setExistingMedia(job.media || [])
      if (job.linkUrl) {
        setLinkPreview({
          url: job.linkUrl,
          title: job.linkTitle || job.linkUrl,
          description: job.linkDesc || '',
          image: job.linkImage || '',
        })
      }
    } catch (err) {
      console.error('Fetch job error:', err)
      toast.error(err.response?.data?.message || 'Failed to load job')
      navigate('/jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const totalFiles = mediaFiles.length + files.length + existingMedia.length
    if (totalFiles > 5) {
      toast.error('Maximum 5 images allowed')
      return
    }

    const newPreviews = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }))

    setMediaFiles(prev => [...prev, ...files])
    setMediaPreview(prev => [...prev, ...newPreviews])
  }

  const removeNewMedia = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
    setMediaPreview(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const removeExistingMedia = (index) => {
    setExistingMedia(prev => prev.filter((_, i) => i !== index))
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

    setSaving(true)

    try {
      let newMediaUrls = []
      if (mediaFiles.length > 0) {
        toast.loading('Uploading images...')
        newMediaUrls = await uploadMediaToCloudinary()
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
        media: [...existingMedia, ...newMediaUrls],
      }

      if (linkPreview) {
        payload.linkUrl = linkPreview.url
        payload.linkTitle = linkPreview.title
        payload.linkImage = linkPreview.image
        payload.linkDesc = linkPreview.description
      } else {
        payload.linkUrl = null
        payload.linkTitle = null
        payload.linkImage = null
        payload.linkDesc = null
      }

      await api.patch(`/jobs/${jobId}`, payload)
      toast.success('Job updated successfully!')
      navigate(`/jobs/${jobId}`)
    } catch (err) {
      console.error('Update job error:', err)
      toast.error(err.response?.data?.message || 'Failed to update job')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-500">Loading job...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit Job</h1>
          <p className="text-gray-500 mt-1">
            Update your job posting
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Design a Mobile Banking App UI"
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all ${
                errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.title && (
              <p className="text-sm text-red-600 mt-1">{errors.title}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formData.title.length}/200</p>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={8}
              placeholder="Describe the project in detail..."
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all ${
                errors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formData.description.length}/10000</p>
          </div>

          {/* Skills */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Required Skills
            </label>
            <input
              type="text"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="e.g. React, Figma, UI Design, Node.js (comma separated)"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Separate skills with commas</p>
          </div>

          {/* Budget & Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget (₦)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    placeholder="e.g. 150000"
                    min="0"
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${
                      errors.budget ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.budget && (
                  <p className="text-sm text-red-600 mt-1">{errors.budget}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Leave empty for negotiable</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Type
                </label>
                <select
                  name="budgetType"
                  value={formData.budgetType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="retainer">Monthly Retainer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Lagos, Nigeria or Remote"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Existing Media */}
          {existingMedia.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Current Attachments
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {existingMedia.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingMedia(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Media Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Add New Attachments
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
            >
              <ImageIcon className="w-5 h-5" />
              Add Images
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleMediaSelect}
              className="hidden"
            />
            <p className="text-xs text-gray-400 mt-1">Up to 5 images total</p>

            {/* New Media Previews */}
            {mediaPreview.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                {mediaPreview.map((media, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                    <img
                      src={media.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewMedia(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link Attachment */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach Link
            </label>
            {!linkPreview ? (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com/reference"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchLinkPreview}
                  disabled={linkLoading || !linkUrl.trim()}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {linkLoading ? (
                    <CloudUpload className="w-5 h-5 animate-spin" />
                  ) : (
                    'Add'
                  )}
                </button>
              </div>
            ) : (
              <div className="relative p-4 bg-gray-50 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={removeLink}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="flex gap-3">
                  {linkPreview.image && (
                    <img
                      src={linkPreview.image}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-1">
                      {linkPreview.title}
                    </h4>
                    {linkPreview.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {linkPreview.description}
                      </p>
                    )}
                    <p className="text-xs text-emerald-600 mt-1 truncate">
                      {linkPreview.url}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Briefcase className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditJob