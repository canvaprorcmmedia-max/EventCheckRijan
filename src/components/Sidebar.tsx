
import {
  LayoutDashboard, ScanLine, Users, ChartNoAxesCombined, CalendarDays,
  Settings, LogOut, CalendarCheck, X, UserCog
} from 'lucide-react'

export type Page =
  | 'dashboard'
  | 'checkin'
  | 'guests'
  | 'reports'
  | 'events'
  | 'staff'
  | 'settings'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  mobileOpen: boolean
  onClose: () => void
  onLogout: () => void
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'checkin' as Page, label: 'Check-in Tamu', icon: ScanLine },
  { id: 'guests' as Page, label: 'Data Tamu', icon: Users },
  { id: 'reports' as Page, label: 'Laporan', icon: ChartNoAxesCombined },
]

const managementItems = [
  { id: 'events' as Page, label: 'Manajemen Event', icon: CalendarDays },
  { id: 'staff' as Page, label: 'Kelola Petugas', icon: UserCog },
  { id: 'settings' as Page, label: 'Pengaturan', icon: Settings },
]

export default function Sidebar({
  activePage,
  onNavigate,
  mobileOpen,
  onClose,
  onLogout
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          className="mobile-backdrop"
          onClick={onClose}
          aria-label="Tutup menu"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <CalendarCheck size={23} />
          </div>

          <div>
            <strong>EventCheck<span>Rijan</span></strong>
            <small>EVENT MANAGEMENT</small>
          </div>

          <button
            className="icon-button sidebar-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={19}/>
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <div className="event-switcher">
          <div className="event-avatar">W</div>
          <div className="event-switcher-copy">
            <strong>Wisuda 2026</strong>
            <small>Event aktif</small>
          </div>
          <span className="status-dot" />
        </div>

        <div className="nav-label">MENU UTAMA</div>

        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activePage === id ? 'active' : ''}`}
              onClick={() => {
                onNavigate(id)
                onClose()
              }}
            >
              <Icon size={19}/>
              <span>{label}</span>
              {id === 'checkin' && <span className="nav-live">LIVE</span>}
            </button>
          ))}
        </nav>

        <div className="nav-label management-label">PENGELOLAAN</div>

        <nav className="nav-list">
          {managementItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activePage === id ? 'active' : ''}`}
              onClick={() => {
                onNavigate(id)
                onClose()
              }}
            >
              <Icon size={19}/>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>
            <strong>Butuh bantuan?</strong>
            <p>Hubungi administrator jika mengalami kendala.</p>
          </div>

          <button
            className="nav-item logout-button"
            onClick={onLogout}
          >
            <LogOut size={18}/>
            <span>Keluar</span>
          </button>

          <div className="sidebar-version">
            EventCheckRijan <span>v0.1.0</span>
          </div>
        </div>
      </aside>
    </>
  )
}
