import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import PostJob from './pages/PostJob'
import JobProposals from './pages/JobProposals'
import Proposals from './pages/Proposals'
import Contracts from './pages/Contracts'
import ContractDetail from './pages/ContractDetail'
import Wallet from './pages/Wallet'
import EditProposal from './pages/EditProposal'
import EditJob from './pages/EditJob'
import Messages from './pages/Messages'
import Notifications from './pages/Notifications'
import Connections from './pages/Connections'
import AdminDashboard from './pages/AdminDashboard'
import AdminVerifications from './pages/AdminVerifications'
import DocumentVerification from './pages/DocumentVerification'
import Disputes from './pages/Disputes'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import AdminWithdrawals from './pages/AdminWithdrawals'
import SharePage from './pages/SharePage'
import Settings from './pages/Settings'
import AudioRoom from './pages/AudioRoom'
import VivaRoomsList from './pages/VivaRoomsList'

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth)

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public Routes */}
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="share/:shareLink" element={<SharePage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="feed" element={<Feed />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile/:userId?" element={<Profile />} />
          
          {/* Jobs - specific routes BEFORE dynamic :jobId */}
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/post-job" element={<PostJob />} />
          <Route path="jobs/:jobId/proposals" element={<JobProposals />} />
          <Route path="jobs/:jobId" element={<JobDetail />} />
          
          <Route path="proposals" element={<Proposals />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="contracts/:contractId" element={<ContractDetail />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="messages/:userId?" element={<Messages />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="connections" element={<Connections />} />
          <Route path="proposals/:proposalId/edit" element={<EditProposal />} />
          <Route path="jobs/:jobId/edit" element={<EditJob />} />
          
          {/* Document Verification - after email verify, before full access */}
          <Route path="document-verification" element={<DocumentVerification />} />
          
          {/* VivaRoom Routes */}
          <Route path="vivarooms" element={<VivaRoomsList />} />
          <Route path="vivaroom/:id" element={<AudioRoom />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/disputes" element={<Disputes />} />
          <Route path="admin/verifications" element={<AdminVerifications />} />
          <Route path="admin/withdrawals" element={<AdminWithdrawals />} />
        </Route>

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App