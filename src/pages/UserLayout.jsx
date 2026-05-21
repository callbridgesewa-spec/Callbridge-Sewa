import AppLayout from '../components/AppLayout'

const sidebarItems = [
  { label: 'Dashboard', to: '/user/dashboard', icon: 'grid' },
  { label: 'Prospects Details', to: '/user/prospects-details', icon: 'people' },
]

function UserLayout() {
  return (
    <AppLayout
      sidebarItems={sidebarItems}
      roleLabel="User"
      brandLogo="N"
    />
  )
}

export default UserLayout
