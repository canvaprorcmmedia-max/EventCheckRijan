import { Bell, Menu, ChevronDown, Search } from 'lucide-react'
import type { Page } from './Sidebar'


const titles: Record<Page, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Pantau aktivitas dan kehadiran tamu acara Anda.'
  },
  checkin: {
    title: 'Check-in Tamu',
    subtitle: 'Verifikasi undangan dan catat kehadiran tamu.'
  },
  guests: {
    title: 'Data Tamu',
    subtitle: 'Kelola seluruh daftar undangan dan tamu acara.'
  },
  reports: {
    title: 'Laporan Kehadiran',
    subtitle: 'Ringkasan dan rekapitulasi kehadiran event.'
  },
  events: {
    title: 'Manajemen Event',
    subtitle: 'Kelola acara dan kategori tamu Anda.'
  },
  staff: {
    title: 'Kelola Petugas',
    subtitle: 'Buat akun petugas dan atur penugasan acara.'
  },
  settings: {
    title: 'Pengaturan',
    subtitle: 'Atur preferensi dan akses aplikasi.'
  },
}

interface TopbarProps { page: Page; onMenuClick: () => void }
export default function Topbar({ page, onMenuClick }: TopbarProps) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenuClick} aria-label="Buka menu"><Menu size={21}/></button>
      <div className="page-heading"><h1>{titles[page].title}</h1><p>{titles[page].subtitle}</p></div>
      <div className="topbar-actions">
        <button className="top-search" aria-label="Cari"><Search size={17}/><span>Cari sesuatu...</span><kbd>⌘ K</kbd></button>
        <button className="notification-button" aria-label="Notifikasi"><Bell size={19}/><i/></button>
        <div className="topbar-divider"/>
        <button className="profile-button"><div className="profile-avatar">AR</div><div className="profile-copy"><strong>Admin Rijan</strong><small>Administrator</small></div><ChevronDown size={15}/></button>
      </div>
    </header>
  )
}