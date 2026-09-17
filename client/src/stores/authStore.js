// stores/authStore.js
import { create } from 'zustand'
import { api } from '../utils/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export const useAuthStore = create((set, get) => ({
  // ── State ──────────────────────────────────
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAuthReady: false,
  isAdmin: false,

  // ── Helpers ────────────────────────────────
  _persistUser: (user) => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
  },

  _clearStorage: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
  },

  _setAuthState: (user) => {
    const newUser = user ? { ...user } : null
    set({
      user: newUser,
      isAuthenticated: !!newUser,
      isAdmin: newUser?.isAdmin || false,
    })
  },

  // ── Actions ────────────────────────────────
  setUser: (user) => {
    get()._setAuthState(user)
    if (user) get()._persistUser(user)
  },

  initializeAuth: async () => {
    const token = localStorage.getItem('accessToken')
    const savedUser = localStorage.getItem('user')

    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser)
        get()._setAuthState(user)
        // Fetch fresh data in background
        get().fetchUser()
      } catch {
        get()._clearStorage()
      }
    }

    set({ isLoading: false, isAuthReady: true })
  },

  fetchUser: async () => {
    try {
      const res = await api.get('/users/me')
      const user = res.data.user
      if (user) {
        get()._persistUser(user)
        get()._setAuthState(user)
      }
      return user
    } catch (error) {
      console.error('Fetch user error:', error)
      return null
    }
  },

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { accessToken, user } = res.data

    localStorage.setItem('accessToken', accessToken)
    get()._persistUser(user)
    get()._setAuthState(user)

    return res.data
  },

  register: async (userData) => {
    const res = await api.post('/auth/register', userData)
    return res.data
  },

  verifyEmail: async (email, code) => {
    const res = await api.post('/auth/verify-email', { email, code })
    const { accessToken, user } = res.data

    localStorage.setItem('accessToken', accessToken)
    get()._persistUser(user)
    get()._setAuthState(user)

    return res.data
  },

  resendCode: async (email) => {
    const res = await api.post('/auth/resend-code', { email })
    return res.data
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    }

    get()._clearStorage()
    set({ user: null, isAuthenticated: false, isAdmin: false })
  },

  updateProfile: async (profileData) => {
    const res = await api.patch('/users/profile', profileData)
    const updatedUser = { ...get().user, ...res.data.user }

    get()._persistUser(updatedUser)
    set({ user: updatedUser })

    return res.data
  },

  updateAvatar: async (formData) => {
    const res = await api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const updatedUser = { ...get().user, avatar: res.data.avatar }

    get()._persistUser(updatedUser)
    set({ user: updatedUser })

    return res.data
  },

  updateBanner: async (formData) => {
    const res = await api.post('/users/banner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const updatedUser = { ...get().user, banner: res.data.banner }

    get()._persistUser(updatedUser)
    set({ user: updatedUser })

    return res.data
  },

  googleLogin: () => {
    window.location.href = `${API_URL}/auth/google`
  },

  handleGoogleCallback: (token, user) => {
    localStorage.setItem('accessToken', token)
    get()._persistUser(user)
    get()._setAuthState(user)
  },
}))