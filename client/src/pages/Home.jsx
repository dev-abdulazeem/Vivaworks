import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  Briefcase,
  Users,
  ShieldCheck,
  Search,
  Clock,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  Play,
  Heart,
  ArrowUpRight,
  Globe,
  Zap,
  Star,
  Sparkles,
  Handshake,
  Coffee,
  Smile,
  ThumbsUp,
  Award,
  Rocket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

function Home() {
  const { isAuthenticated } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleSections, setVisibleSections] = useState(new Set())
  const [currentSlide, setCurrentSlide] = useState(0)
  const sectionRefs = useRef({})

  // Real human stories instead of generic slides
  const stories = [
    {
      id: 1,
      name: 'Samuel O.',
      role: 'Product Designer',
      quote: 'Found a developer in 4 hours. We shipped in 2 weeks.',
      tag: 'client story',
    },
    {
      id: 2,
      name: 'Faith A.',
      role: 'Content Writer',
      quote: 'Got paid the same day I delivered. No chasing anyone.',
      tag: 'freelancer story',
    },
    {
      id: 3,
      name: 'Tunde & Co.',
      role: 'Startup Team',
      quote: 'Hired 3 freelancers, saved millions in salaries.',
      tag: 'agency story',
    },
  ]

  const popularServices = [
    'Website Development',
    'Logo Design',
    'SEO',
    'Video Editing',
    'Content Writing',
    'Mobile Apps',
  ]

  const categories = [
    { name: 'Web Development', icon: '💻', jobs: '2,400+', color: 'from-emerald-50 to-teal-50' },
    { name: 'Graphic Design', icon: '🎨', jobs: '1,800+', color: 'from-sky-50 to-blue-50' },
    { name: 'Writing & Copy', icon: '✍️', jobs: '3,200+', color: 'from-amber-50 to-orange-50' },
    { name: 'Digital Marketing', icon: '📈', jobs: '1,500+', color: 'from-violet-50 to-purple-50' },
    { name: 'Mobile Apps', icon: '📱', jobs: '980+', color: 'from-rose-50 to-pink-50' },
    { name: 'Video & Animation', icon: '🎬', jobs: '1,100+', color: 'from-cyan-50 to-teal-50' },
    { name: 'Data Science', icon: '📊', jobs: '760+', color: 'from-indigo-50 to-blue-50' },
    { name: 'Virtual Assistant', icon: '🤝', jobs: '2,100+', color: 'from-lime-50 to-emerald-50' },
  ]

  const howItWorks = [
    {
      step: '01',
      title: 'Share what you need',
      desc: 'Post your job. Describe the work, set your budget, and wait. Real people apply, not bots.',
      icon: Briefcase,
    },
    {
      step: '02',
      title: 'Meet your match',
      desc: 'Review proposals, check portfolios, and chat directly. No algorithms, just humans talking.',
      icon: Users,
    },
    {
      step: '03',
      title: 'Pay with peace',
      desc: 'Funds are held safely until you are happy. If it is not right, you do not pay. Simple.',
      icon: ShieldCheck,
    },
  ]

  const testimonials = [
    {
      name: 'Chidi O.',
      role: 'Freelance Developer',
      content: 'I have been on 3 platforms. This one actually pays. The escrow thing is not a joke. I get paid on time, every time.',
      avatar: 'CO',
      color: 'bg-emerald-600',
      location: 'Lagos',
    },
    {
      name: 'Zainab K.',
      role: 'Creative Director',
      content: 'Found my go-to designer here. We have worked on 12 projects together. It just feels like a real community.',
      avatar: 'ZK',
      color: 'bg-teal-600',
      location: 'Abuja',
    },
    {
      name: 'Emeka N.',
      role: 'Startup Founder',
      content: 'I was skeptical at first. Now I do not hire anywhere else. The talent is vetted, and the process is smooth.',
      avatar: 'EN',
      color: 'bg-emerald-500',
      location: 'Port Harcourt',
    },
  ]

  const features = [
    {
      icon: ShieldCheck,
      title: 'Escrow that protects both sides',
      desc: 'Money is held until you approve the work. No more "I paid and they disappeared."',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: MessageSquare,
      title: 'Chat like humans',
      desc: 'No weird interfaces. Just real conversations with file sharing and instant replies.',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      icon: Clock,
      title: 'Milestones that make sense',
      desc: 'Break big projects into small wins. Know exactly what is done and what is next.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: TrendingUp,
      title: 'People, not profiles',
      desc: 'Real portfolios, real reviews, real humans. You are hiring a person, not a picture.',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      icon: Zap,
      title: 'Fast, but not frantic',
      desc: 'Get quality proposals within hours. No spam, no noise. Just people who actually read your job.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: Globe,
      title: 'Built for Nigeria',
      desc: 'Local payment methods. No crazy conversions. Talent that understands your market and your people.',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
  ]

  const stats = [
    { value: '12,000+', label: 'Freelancers' },
    { value: '2.4B+', label: 'Paid out' },
    { value: '98%', label: 'Happy clients' },
    { value: '50+', label: 'Categories' },
  ]

  const trustBadges = [
    'Escrow Protected Payments',
    'No Hidden Fees',
    'Verified Freelancers',
    'Money-Back Guarantee',
  ]

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set([...prev, entry.target.dataset.section]))
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  // Auto-slide for stories
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % stories.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [stories.length])

  const handleSearch = (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    window.location.href = `/jobs?search=${encodeURIComponent(searchQuery)}`
  }

  const isVisible = (key) => visibleSections.has(key)

  const goToSlide = (index) => setCurrentSlide(index)

  return (
    <div className="min-h-screen bg-white">
      
      {/* ===== HERO ===== */}
      <section
        className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 overflow-hidden py-20 lg:py-28"
        data-section="hero"
        ref={(el) => (sectionRefs.current.hero = el)}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <span className="inline-block bg-white/10 backdrop-blur-sm text-emerald-200 text-sm font-medium px-4 py-1.5 rounded-full border border-white/10 mb-6">
                Nigeria's trusted freelance marketplace
              </span>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
                Hire people who
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-white">
                  actually get it done
                </span>
              </h1>

              <p className="text-emerald-100/70 text-lg max-w-lg mb-8">
                Stop chasing freelancers. Stop chasing payments. Find vetted talent and pay securely — all in one place.
              </p>

              <form onSubmit={handleSearch} className="relative max-w-md mb-6">
                <div className="flex items-center bg-white rounded-full overflow-hidden shadow-xl shadow-emerald-950/30">
                  <div className="pl-4">
                    <Search className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="What do you need help with?"
                    className="flex-1 px-3 py-3.5 text-slate-700 placeholder-slate-400 outline-none text-base"
                  />
                  <button
                    type="submit"
                    className="m-1.5 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-full hover:bg-emerald-700 transition-all duration-300 shadow-lg shadow-emerald-600/25"
                  >
                    Search
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white/40 text-xs font-medium">Popular:</span>
                {popularServices.slice(0, 4).map((tag) => (
                  <Link
                    key={tag}
                    to={`/jobs?search=${encodeURIComponent(tag)}`}
                    className="px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/15 text-white/80 text-xs rounded-full hover:bg-emerald-500/30 hover:border-emerald-400/40 transition-all duration-300"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right - Human stories */}
            <div className="hidden lg:block">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h3 className="text-white/60 text-sm font-medium mb-4">Real stories</h3>
                <div className="relative h-48">
                  {stories.map((story, index) => (
                    <div
                      key={story.id}
                      className={`absolute inset-0 transition-all duration-700 ${
                        index === currentSlide 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 translate-x-8'
                      }`}
                    >
                      <div className="bg-white/10 rounded-xl p-6">
                        <span className="text-emerald-300 text-xs font-medium uppercase tracking-wider">
                          {story.tag}
                        </span>
                        <p className="text-white text-lg font-medium mt-2 leading-snug">
                          "{story.quote}"
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center text-white font-bold">
                            {story.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{story.name}</p>
                            <p className="text-emerald-200/60 text-xs">{story.role}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-2 mt-4">
                  {stories.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        index === currentSlide ? 'w-6 bg-emerald-400' : 'w-1.5 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <div className="bg-emerald-950 py-4 border-b border-emerald-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-emerald-200/60 text-sm">
            {trustBadges.map((badge) => (
              <span key={badge} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ===== CATEGORIES ===== */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
        data-section="categories"
        ref={(el) => (sectionRefs.current.categories = el)}
      >
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible('categories') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3 border border-emerald-200">
            Browse Categories
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-2">
            Find talent by category
          </h2>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            From code to copy, design to data — whatever you need, someone here does it well.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((cat, index) => (
            <Link
              key={cat.name}
              to="/jobs"
              className={`group relative bg-gradient-to-br ${cat.color} border border-emerald-100 rounded-2xl p-4 sm:p-6 hover:shadow-lg hover:shadow-emerald-100/40 transition-all duration-500 hover:-translate-y-1 overflow-hidden ${
                isVisible('categories') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${index * 60}ms` }}
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/50 rounded-full -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-700" />
              <div className="relative">
                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                  {cat.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-0.5">{cat.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{cat.jobs} jobs</p>
                <div className="mt-2 sm:mt-3 flex items-center gap-1 text-emerald-600 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-4px] group-hover:translate-x-0">
                  Explore <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section
        className="bg-slate-50 py-16 sm:py-24 relative overflow-hidden"
        data-section="howitworks"
        ref={(el) => (sectionRefs.current.howitworks = el)}
      >
        <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-100/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-teal-100/40 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center mb-12 sm:mb-16 transition-all duration-700 ${isVisible('howitworks') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3 border border-emerald-200">
              Simple Process
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-2">
              How it works
            </h2>
            <p className="text-slate-500 text-base max-w-lg mx-auto">
              Three steps. No fine print.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6 relative">
            <div className="hidden sm:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-emerald-200 via-teal-200 to-emerald-200" />

            {howItWorks.map((item, index) => (
              <div
                key={item.step}
                className={`relative text-center group transition-all duration-700 ${
                  isVisible('howitworks') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-md shadow-emerald-100/40 mb-5 sm:mb-6 border border-emerald-100 group-hover:shadow-lg group-hover:shadow-emerald-200/40 transition-all duration-300 group-hover:-translate-y-1">
                  <item.icon className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-emerald-600 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-md">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
        data-section="features"
        ref={(el) => (sectionRefs.current.features = el)}
      >
        <div className={`text-center mb-12 sm:mb-16 transition-all duration-700 ${isVisible('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3 border border-emerald-200">
            Why Choose Us
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-2">
            Built for people who actually work
          </h2>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            We did not copy this from a template. We built it because we were frustrated with the alternatives.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f, index) => (
            <div
              key={f.title}
              className={`group p-6 sm:p-8 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50/50 transition-all duration-500 hover:-translate-y-1 ${
                isVisible('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <div className={`inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 ${f.bg} rounded-xl mb-4 sm:mb-5 group-hover:scale-110 transition-transform duration-300`}>
                <f.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${f.color}`} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section
        className="bg-emerald-950 py-16 sm:py-24 relative overflow-hidden"
        data-section="testimonials"
        ref={(el) => (sectionRefs.current.testimonials = el)}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center mb-12 sm:mb-16 transition-all duration-700 ${isVisible('testimonials') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <span className="inline-block px-3 py-1 bg-emerald-800/40 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-full mb-3 border border-emerald-700/40">
              Testimonials
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2">
              Real people, real results
            </h2>
            <p className="text-emerald-200/60 text-base max-w-lg mx-auto">
              Not paid actors. Not stock photos. Just people who use this and like it.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((t, index) => (
              <div
                key={t.name}
                className={`group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 hover:bg-white/8 hover:border-emerald-500/25 transition-all duration-500 hover:-translate-y-1 ${
                  isVisible('testimonials') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <div className="absolute top-5 right-5 text-emerald-500/15">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>

                <div className="flex gap-0.5 mb-4 sm:mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>

                <p className="text-emerald-100/85 text-sm leading-relaxed mb-6 sm:mb-8 italic">"{t.content}"</p>

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${t.color} flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-lg`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{t.name}</p>
                    <p className="text-xs text-emerald-300/70">{t.role}</p>
                    <p className="text-[10px] sm:text-xs text-emerald-400/50 mt-0.5">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section
        className="bg-white py-14 sm:py-16 border-y border-slate-100"
        data-section="stats"
        ref={(el) => (sectionRefs.current.stats = el)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`text-center transition-all duration-700 ${
                  isVisible('stats') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className="text-2xl sm:text-4xl font-bold text-emerald-600 mb-1">{stat.value}</div>
                <div className="text-slate-500 text-xs sm:text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
        data-section="cta"
        ref={(el) => (sectionRefs.current.cta = el)}
      >
        <div className={`relative overflow-hidden rounded-3xl transition-all duration-700 ${isVisible('cta') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700" />
          <div className="absolute top-0 right-0 w-72 h-72 sm:w-96 sm:h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-teal-400/10 rounded-full blur-3xl" />

          <div className="relative px-6 sm:px-12 lg:px-16 py-12 sm:py-20 text-center">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 leading-tight">
              Ready to stop messing around?
            </h2>
            <p className="text-emerald-100/75 text-sm sm:text-lg mb-8 sm:mb-10 max-w-md sm:max-w-lg mx-auto">
              Join the people who already figured out that hiring and getting hired does not have to be painful. It is free to sign up.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/register"
                    className="group flex items-center gap-2 px-7 py-3.5 sm:px-8 sm:py-4 bg-white text-emerald-700 font-bold rounded-full hover:bg-emerald-50 transition-all duration-300 shadow-xl shadow-emerald-900/20 active:scale-95 w-full sm:w-auto justify-center"
                  >
                    Sign Up Free
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/jobs"
                    className="flex items-center gap-2 px-7 py-3.5 sm:px-8 sm:py-4 border-2 border-white/25 text-white font-semibold rounded-full hover:bg-white/10 hover:border-white/40 transition-all duration-300 w-full sm:w-auto justify-center"
                  >
                    <Play className="w-4 h-4" />
                    Browse Jobs
                  </Link>
                </>
              ) : (
                <Link
                  to="/jobs"
                  className="group flex items-center gap-2 px-7 py-3.5 sm:px-8 sm:py-4 bg-white text-emerald-700 font-bold rounded-full hover:bg-emerald-50 transition-all duration-300 shadow-xl shadow-emerald-900/20 active:scale-95"
                >
                  Find Work
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>

            <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-emerald-200/50 text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                Secure Payments
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3" />
                No Hidden Fees
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="w-3 h-3" />
                Free to Join
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home