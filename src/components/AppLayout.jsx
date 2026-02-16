import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

function SidebarIcon({ name }) {
  const iconClass = 'h-5 w-5 shrink-0'
  switch (name) {
    case 'grid':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    case 'people':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    case 'checklist':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    case 'folder':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    case 'person-plus':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    default:
      return null
  }
}

/**
 * Shared layout with sidebar for both admin and user.
 * @param {Object} props
 * @param {Array<{label: string, to: string, icon: string, underConstruction?: boolean}>} props.sidebarItems
 * @param {string} props.roleLabel - e.g. "Admin" or "User"
 * @param {string} props.brandLogo - "CS" for admin, "N" for user
 * @param {function({handleLogout: function}): React.ReactNode} props.renderTopBarRight - optional; default is Logout button
 * @param {Object} props.outletContext - optional context to pass to Outlet
 */
function AppLayout({ sidebarItems, roleLabel, brandLogo = 'CS', renderTopBarRight, outletContext = {} }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const closeSidebar = () => setSidebarOpen(false)

  const topBarContent = renderTopBarRight
    ? renderTopBarRight({ handleLogout })
    : (
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Logout
        </button>
      )

  return (
    <div className="flex min-h-screen bg-[#e0f2f7]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - same as admin panel */}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-200 bg-white
          px-4 py-5 shadow-lg transition-transform duration-200 ease-out
          md:relative md:left-auto md:top-auto md:z-auto md:h-auto md:w-56 md:translate-x-0 md:shadow-sm
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-white">
            {brandLogo}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">C.S for Sangat</p>
            <p className="text-[11px] text-slate-500">{roleLabel}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 text-sm">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition',
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')
              }
            >
              <SidebarIcon name={item.icon} />
              <span className="text-[13px]">{item.label}</span>
              {item.underConstruction && (
                <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  Soon
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-600">
            <p className="truncate font-medium text-slate-900">{user?.email}</p>
            <p className="text-[11px] capitalize text-slate-400">{role || 'user'}</p>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 md:justify-end md:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex flex-1 justify-end gap-2">
            {topBarContent}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#e0f2f7] px-4 py-5 md:px-6">
          <Outlet context={outletContext} />
        </div>
      </main>
    </div>
  )
}

export default AppLayout
export { SidebarIcon }
