import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  BookmarkIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  XMarkIcon,
  FireIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid'

function Jobs() {
  const [jobs, setJobs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [savedJobs, setSavedJobs] = useState(new Set())

  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [filters, setFilters] = useState({
    status: '',
    skill: '',
    minBudget: '',
    maxBudget: '',
    location: '',
  })

  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', limit.toString())

      if (filters.status) params.append('status', filters.status)
      if (filters.skill) params.append('skill', filters.skill)
      if (filters.minBudget) params.append('minBudget', filters.minBudget)
      if (filters.maxBudget) params.append('maxBudget', filters.maxBudget)
      if (filters.location) params.append('location', filters.location)

      const response = await api.get(`/jobs?${params.toString()}`)
      const { jobs: fetchedJobs, pagination } = response.data

      setJobs(fetchedJobs)
      setTotalPages(pagination.pages)
      setTotal(pagination.total)

      const allSkills = new Set()
      const allLocations = new Set()
      fetchedJobs.forEach((job) => {
        job.skills?.forEach((s) => allSkills.add(s))
        if (job.location) allLocations.add(job.location)
      })
      setCategories([...allSkills])
      setLocations([...allLocations])
    } catch (err) {
      console.error('Fetch jobs error:', err)
      setError(err.response?.data?.message || 'Failed to load jobs. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, filters])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      job.title?.toLowerCase().includes(q) ||
      job.description?.toLowerCase().includes(q) ||
      job.skills?.some((s) => s.toLowerCase().includes(q)) ||
      job.buyer?.firstName?.toLowerCase().includes(q) ||
      job.buyer?.lastName?.toLowerCase().includes(q)
    )
  })

  const toggleSaveJob = (jobId) => {
    setSavedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'Negotiable'
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const timeAgo = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)

    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'week', seconds: 604800 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ]

    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds)
      if (count >= 1) return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`
    }
    return 'Just now'
  }

  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length

  const clearFilters = () => {
    setFilters({ status: '', skill: '', minBudget: '', maxBudget: '', location: '' })
    setPage(1)
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'in_progress':
        return 'bg-sky-50 text-sky-700 border-sky-100'
      case 'completed':
        return 'bg-slate-100 text-slate-600 border-slate-200'
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-100'
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    }
  }

  const getInitials = (firstName, lastName) => {
    const f = firstName?.trim()?.[0] || ''
    const l = lastName?.trim()?.[0] || ''
    return `${f}${l}`.toUpperCase() || '?'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <BriefcaseIcon className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Job Board</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                Find Your Next Project
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isLoading ? 'Loading opportunities...' : `${total.toLocaleString()} jobs waiting for you`}
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <FireIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">{total} Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs, skills, or keywords..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-300 transition-colors"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                onClick={fetchJobs}
                disabled={isLoading}
                className="flex items-center justify-center w-11 h-11 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200 transition-all disabled:opacity-50"
                title="Refresh"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Skill</label>
                  <select
                    value={filters.skill}
                    onChange={(e) => { setFilters({ ...filters, skill: e.target.value }); setPage(1) }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">All Skills</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
                  <select
                    value={filters.location}
                    onChange={(e) => { setFilters({ ...filters, location: e.target.value }); setPage(1) }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">Any Location</option>
                    {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Min Budget (₦)</label>
                  <input
                    type="number"
                    value={filters.minBudget}
                    onChange={(e) => { setFilters({ ...filters, minBudget: e.target.value }); setPage(1) }}
                    placeholder="e.g. 100000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max Budget (₦)</label>
                  <input
                    type="number"
                    value={filters.maxBudget}
                    onChange={(e) => { setFilters({ ...filters, maxBudget: e.target.value }); setPage(1) }}
                    placeholder="e.g. 500000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors flex items-center gap-1"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XMarkIcon className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button onClick={fetchJobs} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors text-xs">
              Retry
            </button>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-900">{filteredJobs.length}</span> of <span className="font-semibold text-slate-900">{total}</span> jobs
            {searchQuery && <span className="ml-2 text-slate-400">for "{searchQuery}"</span>}
          </p>
          <button className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            Newest <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Jobs List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-slate-200 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="flex gap-2 mt-3">
                      <div className="h-5 bg-slate-200 rounded w-16" />
                      <div className="h-5 bg-slate-200 rounded w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredJobs.map((job) => {
                const isSaved = savedJobs.has(job.id)
                const statusStyle = getStatusStyle(job.status)

                return (
                  <div
                    key={job.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-md hover:shadow-slate-100 transition-all duration-200 group"
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="shrink-0 hidden sm:block">
                          {job.buyer?.avatar ? (
                            <img
                              src={job.buyer.avatar}
                              alt={`${job.buyer.firstName} ${job.buyer.lastName}`}
                              className="w-11 h-11 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                              {getInitials(job.buyer?.firstName, job.buyer?.lastName)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Tags */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-md border border-emerald-100 uppercase tracking-wide">
                              {job.budgetType || 'fixed'}
                            </span>
                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border capitalize ${statusStyle}`}>
                              {job.status?.replace('_', ' ') || 'Open'}
                            </span>
                            {job.proposals?.length > 5 && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-md border border-amber-100 flex items-center gap-1">
                                <FireIcon className="w-3 h-3" />
                                Popular
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <Link to={`/jobs/${job.id}`} className="block group-hover:text-emerald-700 transition-colors">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                              {job.title}
                            </h3>
                          </Link>

                          {/* Description */}
                          <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                            {job.description}
                          </p>

                          {/* Skills */}
                          {job.skills && job.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {job.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2.5 py-1 bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg border border-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-100 transition-colors cursor-default"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Meta Row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs">
                            {job.budget !== null ? (
                              <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                <CurrencyDollarIcon className="w-3.5 h-3.5" />
                                {formatCurrency(job.budget)}
                                {job.budgetType === 'hourly' && '/hr'}
                                {job.budgetType === 'retainer' && '/month'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                <CurrencyDollarIcon className="w-3.5 h-3.5" />
                                Negotiable
                              </span>
                            )}

                            {job.location && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <MapPinIcon className="w-3.5 h-3.5" />
                                {job.location}
                              </span>
                            )}

                            <span className="flex items-center gap-1 text-slate-400">
                              <ClockIcon className="w-3.5 h-3.5" />
                              {timeAgo(job.createdAt)}
                            </span>

                            <span className="flex items-center gap-1 text-slate-400">
                              <UserGroupIcon className="w-3.5 h-3.5" />
                              {job.proposals?.length || 0} proposals
                            </span>
                          </div>

                          {/* Footer */}
                          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="sm:hidden">
                                {job.buyer?.avatar ? (
                                  <img src={job.buyer.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white text-[10px] font-bold">
                                    {getInitials(job.buyer?.firstName, job.buyer?.lastName)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">
                                  {job.buyer?.firstName} {job.buyer?.lastName}
                                </p>
                                {job.buyer?.headline && (
                                  <p className="text-[11px] text-slate-400">{job.buyer.headline}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleSaveJob(job.id)}
                                className={`p-2 rounded-lg transition-all ${
                                  isSaved
                                    ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-transparent'
                                }`}
                                title={isSaved ? 'Remove from saved' : 'Save job'}
                              >
                                {isSaved ? <BookmarkIconSolid className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
                              </button>

                              <Link
                                to={`/jobs/${job.id}`}
                                className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm active:scale-[0.98]"
                              >
                                View & Apply
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Empty State */}
              {filteredJobs.length === 0 && !isLoading && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 sm:p-16 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MagnifyingGlassIcon className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No jobs found</h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                    {searchQuery
                      ? 'Try adjusting your search terms.'
                      : 'No jobs match your filters. Try broadening your search.'}
                  </p>
                  {(activeFilterCount > 0 || searchQuery) && (
                    <button
                      onClick={() => { clearFilters(); setSearchQuery('') }}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-semibold text-xs hover:bg-emerald-100 transition-colors border border-emerald-200"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                        p === page
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Jobs