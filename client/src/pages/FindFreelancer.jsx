import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  StarIcon,
  CheckCircleIcon,
  ClockIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

function FindFreelancer() {
  const [freelancers, setFreelancers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  
  const [filters, setFilters] = useState({
    skills: '',
    minRating: '',
    maxRate: '',
    isAvailable: '',
  })

  const fetchFreelancers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      if (searchQuery) params.append('query', searchQuery)
      if (filters.skills) params.append('skills', filters.skills)
      if (filters.minRating) params.append('minRating', filters.minRating)
      if (filters.maxRate) params.append('maxRate', filters.maxRate)
      if (filters.isAvailable) params.append('isAvailable', filters.isAvailable)

      const response = await api.get(`/freelancers/search?${params.toString()}`)
      setFreelancers(response.data.freelancers || [])
    } catch (err) {
      console.error('Fetch freelancers error:', err)
      setError(err.response?.data?.message || 'Failed to load freelancers.')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, searchQuery, filters])

  useEffect(() => {
    fetchFreelancers()
  }, [fetchFreelancers])

  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length
  const clearFilters = () => {
    setFilters({ skills: '', minRating: '', maxRate: '', isAvailable: '' })
    setPage(1)
  }

  // Helper to format Naira currency
  const formatNaira = (amount) => {
    if (!amount) return 'Negotiable'
    return `₦${Number(amount).toLocaleString()}/hr`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Talent Search</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
            Find the Right Freelancer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLoading ? 'Searching talent pool...' : `${freelancers.length} freelancers found`}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {/* Search & Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills, e.g. web developer, content writing..."
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
                onClick={fetchFreelancers}
                disabled={isLoading}
                className="flex items-center justify-center w-11 h-11 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200 transition-all disabled:opacity-50"
                title="Refresh"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Skills</label>
                  <input
                    type="text"
                    value={filters.skills}
                    onChange={(e) => { setFilters({ ...filters, skills: e.target.value }); setPage(1) }}
                    placeholder="e.g. react, node.js"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Min Rating</label>
                  <select
                    value={filters.minRating}
                    onChange={(e) => { setFilters({ ...filters, minRating: e.target.value }); setPage(1) }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">Any Rating</option>
                    <option value="4.5">4.5+ Stars</option>
                    <option value="4.0">4.0+ Stars</option>
                    <option value="3.5">3.5+ Stars</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max Hourly Rate (₦)</label>
                  <input
                    type="number"
                    value={filters.maxRate}
                    onChange={(e) => { setFilters({ ...filters, maxRate: e.target.value }); setPage(1) }}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Availability</label>
                  <select
                    value={filters.isAvailable}
                    onChange={(e) => { setFilters({ ...filters, isAvailable: e.target.value }); setPage(1) }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">Any</option>
                    <option value="true">Available Now</option>
                    <option value="false">Unavailable</option>
                  </select>
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

        {/* Results List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 rounded w-2/3" />
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
          <div className="space-y-3">
            {freelancers.map((freelancer) => {
              // 🎯 Get real-time review count from backend
              const reviewCount = freelancer.reviewCount || freelancer._count?.reviews || 0
              const completedJobs = freelancer._count?.contracts || 0

              return (
                <div
                  key={freelancer.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-md hover:shadow-slate-100 transition-all duration-200 group"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 hidden sm:block">
                        {freelancer.avatar ? (
                          <img src={freelancer.avatar} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {freelancer.firstName?.[0]}{freelancer.lastName?.[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {freelancer.match_score > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[11px] font-bold rounded-md">
                              {Math.round(freelancer.match_score * 100)}% Match
                            </span>
                          )}
                          {freelancer.isAvailable && (
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[11px] font-bold rounded-md border border-sky-100">
                              Available
                            </span>
                          )}
                        </div>
                        
                        <Link to={`/freelancers/${freelancer.id}`} className="block group-hover:text-emerald-700 transition-colors">
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                            {freelancer.firstName} {freelancer.lastName}
                          </h3>
                          <p className="text-sm text-slate-500 mt-0.5">{freelancer.headline}</p>
                        </Link>

                        {freelancer.skills && freelancer.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {freelancer.skills.slice(0, 5).map((skill) => (
                              <span key={skill} className="px-2.5 py-1 bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg border border-slate-100">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 🎯 Real-time Stats Row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs">
                          {/* Dynamic Rating & Real Review Count */}
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            {freelancer.rating ? freelancer.rating.toFixed(1) : 'New'}
                            <span className="text-slate-400 font-normal">
                              ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                            </span>
                          </span>
                          
                          {/* 🎯 Naira Currency Format */}
                          {freelancer.hourlyRate && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              {formatNaira(freelancer.hourlyRate)}
                            </span>
                          )}
                          
                          <span className="flex items-center gap-1 text-slate-400">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            {completedJobs} {completedJobs === 1 ? 'Job' : 'Jobs'}
                          </span>
                          
                          <span className="flex items-center gap-1 text-slate-400">
                            <ClockIcon className="w-3.5 h-3.5" />
                            {freelancer.responseRate || 0}% Response
                          </span>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                          <p className="text-xs text-slate-500 line-clamp-1 max-w-md">
                            {freelancer.bio || 'No bio provided.'}
                          </p>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/freelancers/${freelancer.id}`}
                              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors"
                            >
                              View Profile
                            </Link>
                            <Link
                              to={`/jobs/post?invite=${freelancer.id}`}
                              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              Invite to Job
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {freelancers.length === 0 && !isLoading && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 sm:p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MagnifyingGlassIcon className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No freelancers found</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Try adjusting your search terms or filters to find more talent.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FindFreelancer