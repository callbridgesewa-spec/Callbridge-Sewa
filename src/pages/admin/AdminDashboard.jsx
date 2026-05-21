import { useOutletContext } from 'react-router-dom'
import Dashboard from '../Dashboard'

function AdminDashboard() {
  const { setDashboardActions } = useOutletContext()
  return <Dashboard readOnly={false} setDashboardActions={setDashboardActions} />
}

export default AdminDashboard
