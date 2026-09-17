import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

function AdminRoute() {
  const { isAuthenticated, isAdmin, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/feed" replace />
  }

  return <Outlet />
}

export default AdminRoute