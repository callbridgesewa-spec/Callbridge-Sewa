import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import ProspectsDetailsPage from './pages/admin/ProspectsDetailsPage'
import AdminNominalRollPage from './pages/admin/NominalRollPage'
import VisitDataPage from './pages/admin/VisitDataPage'
import JathaRecordPage from './pages/admin/JathaRecordPage'
import UserLayout from './pages/UserLayout'
import UserDashboard from './pages/UserDashboard'
import UserNominalRollPage from './pages/NominalRollPage'
import UserVisitDataPage from './pages/VisitDataPage'
import UserJathaRecordPage from './pages/JathaRecordPage'
import UnderConstruction from './pages/UnderConstruction'
import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="prospects-details" element={<ProspectsDetailsPage />} />
          <Route path="nominal-roll" element={<AdminNominalRollPage />} />
          <Route path="jatha-record" element={<JathaRecordPage />} />
          <Route path="visit-data" element={<VisitDataPage />} />
          <Route path="add-prospects" element={<UnderConstruction section="Add Prospects" />} />
        </Route>

        {/* User routes */}
        <Route
          path="/user"
          element={
            <ProtectedRoute requiredRole="user">
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<UserDashboard />} />
          <Route path="prospects-details" element={<UserDashboard />} />
          <Route path="nominal-roll" element={<UserNominalRollPage />} />
          <Route path="jatha-record" element={<UserJathaRecordPage />} />
          <Route path="visit-data" element={<UserVisitDataPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
