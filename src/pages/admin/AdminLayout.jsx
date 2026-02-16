import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'

const sidebarItems = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: 'grid' },
  { label: 'Prospects Details', to: '/admin/prospects-details', icon: 'people' },
  { label: 'Nominal Roll', to: '/admin/nominal-roll', icon: 'checklist' },
  { label: 'Jatha Record', to: '/admin/jatha-record', icon: 'folder' },
  { label: 'Visit Data', to: '/admin/visit-data', icon: 'clipboard' },
  { label: 'Add Prospects', to: '/admin/add-prospects', icon: 'person-plus' },
]

function AdminLayout() {
  const location = useLocation()
  const [dashboardActions, setDashboardActions] = useState(null)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)

  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/dashboard'

  const renderTopBarRight = ({ handleLogout }) => (
    <>
      {/* Mobile: single Actions dropdown */}
      <div className="flex flex-1 justify-end md:hidden">
        <div className="relative">
          <button
            type="button"
            onClick={() => setActionsMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-expanded={actionsMenuOpen}
            aria-haspopup="true"
          >
            Actions
            <svg className={`h-4 w-4 transition ${actionsMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {actionsMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActionsMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {isDashboard && dashboardActions && (
                  <>
                    <button
                      type="button"
                      onClick={() => { dashboardActions.openBadgeModal(); setActionsMenuOpen(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Edit Badge Counts
                    </button>
                    <button
                      type="button"
                      onClick={() => { dashboardActions.openUserModal(); setActionsMenuOpen(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Add User
                    </button>
                    <button
                      type="button"
                      onClick={() => { dashboardActions.openExistingUsersModal(); setActionsMenuOpen(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Existing Users
                    </button>
                    <button
                      type="button"
                      onClick={() => { dashboardActions.openAttendanceModal(); setActionsMenuOpen(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Attendance
                    </button>
                    <button
                      type="button"
                      onClick={() => { dashboardActions.openCallLogsModal?.(); setActionsMenuOpen(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Call Logs
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { handleLogout(); setActionsMenuOpen(false) }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop: individual buttons */}
      <div className="hidden flex-wrap justify-end gap-2 md:flex">
        {isDashboard && dashboardActions && (
          <>
            <button
              type="button"
              onClick={dashboardActions.openBadgeModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Edit Badge Counts
            </button>
            <button
              type="button"
              onClick={dashboardActions.openUserModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Add User
            </button>
            <button
              type="button"
              onClick={dashboardActions.openExistingUsersModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Existing Users
            </button>
            <button
              type="button"
              onClick={dashboardActions.openAttendanceModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Attendance
            </button>
            <button
              type="button"
              onClick={() => dashboardActions.openCallLogsModal?.()}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Call Logs
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </>
  )

  return (
    <AppLayout
      sidebarItems={sidebarItems}
      roleLabel="Admin"
      brandLogo="CS"
      renderTopBarRight={renderTopBarRight}
      outletContext={{ setDashboardActions }}
    />
  )
}

export default AdminLayout
