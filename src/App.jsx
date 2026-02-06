import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserDashboard from './pages/UserDashboard'
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
          <Route path="prospects-details" element={<UnderConstruction section="Prospects Details" />} />
          <Route path="nominal-roll" element={<UnderConstruction section="Nominal Roll" />} />
          <Route path="jatha-record" element={<UnderConstruction section="Jatha Record" />} />
          <Route path="visit-data" element={<UnderConstruction section="Visit Data" />} />
          <Route path="add-prospects" element={<UnderConstruction section="Add Prospects" />} />
        </Route>

        {/* User dashboard */}
        <Route
          path="/user"
          element={
            <ProtectedRoute requiredRole="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
