import AppLayout from '../components/AppLayout'

const sidebarItems = [
  { label: 'Prospects Details', to: '/user/prospects-details', icon: 'people' },
  { label: 'Nominal Roll', to: '/user/nominal-roll', icon: 'checklist' },
  { label: 'Jatha Record', to: '/user/jatha-record', icon: 'folder' },
  { label: 'Visit Data', to: '/user/visit-data', icon: 'clipboard' },
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
