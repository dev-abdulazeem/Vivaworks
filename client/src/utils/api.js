import axios from 'axios'

// Auto-detect: use IP for mobile devices, localhost for desktop
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const API_URL = isLocalhost 
  ? 'http://localhost:5000/api' 
  : 'http://172.20.10.4:5000/api'

// Authenticated API (for protected routes)
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }
  
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Public API — NO auth headers, NO 401 redirect (for share links, public pages)
const apiPublic = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

apiPublic.interceptors.request.use((config) => {
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

export { api, apiPublic }