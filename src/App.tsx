import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  getGuestsByEvent,
  deleteGuestsFromEvent,
  addGuestToEvent,
  checkInGuest
} from './lib/guestService'
import EventsPage from './components/EventsPage'
import StaffPage from './components/StaffPage'
import GuestImportModal from './components/GuestImportModal'
import { QRCodeSVG } from 'qrcode.react'
import {
  Users, UserCheck, UserRoundX, Crown, ArrowUpRight, Download, Plus,
  Search, Filter, MoreHorizontal, CheckCircle2, ScanLine,
  Upload, CalendarDays, MapPin, ChevronRight, X,
  QrCode, UserPlus, Check, Info, ChartNoAxesCombined
} from 'lucide-react'
import Sidebar, { type Page } from './components/Sidebar'
import Topbar from './components/Topbar'
import StatCard from './components/StatCard'
import type { Guest, GuestCategory } from './types'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

type ActiveEvent = {
  id: string
  name: string
  description: string | null
  event_date: string | null
  location: string | null
  status: 'draft' | 'active' | 'archived'
}
function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([])
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null)
  const [eventLoading, setEventLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadActiveEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, description, event_date, location, status')
        .eq('status', 'active')
        .order('event_date', { ascending: false })

      if (cancelled) return
      if (error) {
        console.error('Gagal mengambil event aktif:', error.message)
        setActiveEvents([])
        setActiveEvent(null)
      } else {
        const available = (data || []) as ActiveEvent[]
        setActiveEvents(available)
        const savedId = window.localStorage.getItem('eventcheckrijan:selected-event-id')
        const selected = available.find(event => event.id === savedId) || available[0] || null
        setActiveEvent(selected)
        if (selected) window.localStorage.setItem('eventcheckrijan:selected-event-id', selected.id)
        else window.localStorage.removeItem('eventcheckrijan:selected-event-id')
      }
      setEventLoading(false)
    }
    void loadActiveEvents()
    return () => { cancelled = true }
  }, [])

  function selectActiveEvent(eventId: string) {
    const selected = activeEvents.find(event => event.id === eventId) || null
    setActiveEvent(selected)
    if (selected) window.localStorage.setItem('eventcheckrijan:selected-event-id', selected.id)
  }


const [guests, setGuests] = useState<Guest[]>([])
const [guestsLoading, setGuestsLoading] = useState(false)
const [guestsError, setGuestsError] = useState('')

useEffect(() => {
  let cancelled = false

  async function loadGuests() {
    if (!activeEvent?.id) {
      setGuests([])
      setGuestsLoading(false)
      setGuestsError('')
      return
    }

    setGuestsLoading(true)
    setGuestsError('')

    try {
      const data = await getGuestsByEvent(activeEvent.id)

      if (!cancelled) {
        setGuests(data)
      }
    } catch (error) {
      if (!cancelled) {
        console.error('Gagal memuat data tamu:', error)
        setGuestsError(
          error instanceof Error
            ? error.message
            : 'Gagal memuat data tamu.'
        )
        setGuests([])
      }
    } finally {
      if (!cancelled) {
        setGuestsLoading(false)
      }
    }
  }

  void loadGuests()

  return () => {
    cancelled = true
  }
}, [activeEvent?.id])

  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<GuestCategory>('Reguler')
  const [notice, setNotice] = useState('')
  const [inviteGuest, setInviteGuest] = useState<Guest | null>(null)

  // Simpan data demo di browser agar link undangan tetap bisa diuji setelah refresh.
  
  // Halaman undangan publik: dapat dibuka tanpa masuk ke dashboard admin.
  const inviteTokenFromUrl = window.location.pathname.startsWith('/undangan/')
    ? window.location.pathname.split('/')[2]
    : null
  const publicInviteGuest = inviteTokenFromUrl
    ? guests.find(g => g.inviteToken === inviteTokenFromUrl)
    : null

  const present = guests.filter(g => g.status === 'Hadir').length
  const recent = guests.filter(g => g.status === 'Hadir').slice().reverse().slice(0, 5)
  const filtered = useMemo(() => guests.filter(g => `${g.name} ${g.invitationCode} ${g.institution}`.toLowerCase().includes(search.toLowerCase())), [guests, search])

  async function checkIn(id: string) {
  const target = guests.find(g => g.id === id)

  if (!target) return

  if (target.status === 'Hadir') {
    setNotice(`${target.name} sudah tercatat hadir.`)
    return
  }

  if (!activeEvent?.id) {
    setNotice('Tidak ada acara aktif.')
    return
  }

  try {
    const checkedInAt = await checkInGuest(
      activeEvent.id,
      id
    )

    setGuests(current =>
      current.map(g =>
        g.id === id
          ? {
              ...g,
              status: 'Hadir',
              checkedInAt
            }
          : g
      )
    )

    setNotice(
      `${target.name} berhasil check-in.`
    )

    window.setTimeout(() => setNotice(''), 3500)

  } catch (error) {
    console.error('Gagal check-in:', error)

    setNotice(
      error instanceof Error
        ? error.message
        : 'Gagal menyimpan check-in.'
    )
  }
}
  
async function addGuest() {
  if (!activeEvent?.id) {
    setNotice('Belum ada acara aktif. Aktifkan acara terlebih dahulu.')
    return
  }

  if (!newName.trim()) return

  try {
    const newGuest = await addGuestToEvent(activeEvent.id, {
      name: newName.trim(),
      institution: 'Tamu undangan',
      category: newCategory,
      guestGroup: ''
    })

    setGuests(current => [newGuest, ...current])
    setNewName('')
    setNewCategory('Reguler')
    setShowAdd(false)
    setPage('guests')
    setInviteGuest(newGuest)

    setNotice('Tamu berhasil disimpan ke database Supabase.')
    window.setTimeout(() => setNotice(''), 3500)
  } catch (error) {
    console.error('Gagal menambahkan tamu:', error)

    setNotice(
      error instanceof Error
        ? error.message
        : 'Gagal menyimpan data tamu.'
    )
  }
}


async function handleDeleteGuests(guestIds: string[]) {
  if (!activeEvent?.id) {
    setNotice('Tidak ada acara aktif. Data tamu tidak dapat dihapus.')
    return
  }

  if (guestIds.length === 0) {
    setNotice('Pilih data tamu yang ingin dihapus.')
    return
  }

  const confirmed = window.confirm(
    `Yakin ingin menghapus ${guestIds.length} data tamu yang dipilih? Tindakan ini tidak dapat dibatalkan.`
  )

  if (!confirmed) return

  try {
    await deleteGuestsFromEvent(activeEvent.id, guestIds)

    const updatedGuests = await getGuestsByEvent(activeEvent.id)
    setGuests(updatedGuests)

    setNotice(`${guestIds.length} data tamu berhasil dihapus.`)
    window.setTimeout(() => setNotice(''), 3500)
  } catch (error) {
    console.error('Gagal menghapus tamu:', error)
    setNotice(
      error instanceof Error
        ? error.message
        : 'Gagal menghapus data tamu.'
    )
  }
}

async function downloadInviteQR() {
  const svg = document.getElementById(
    'invite-qr-svg'
  ) as SVGSVGElement | null

  if (!svg || !inviteGuest) {
    setNotice('QR Code tidak ditemukan.')
    return
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 680

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Canvas tidak dapat dibuat.')
    }

    // Background kartu
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1200, 680)

    // Bingkai kartu
    ctx.strokeStyle = '#171717'
    ctx.lineWidth = 8
    ctx.strokeRect(8, 8, 1184, 664)

    // Ornamen geometris sisi kanan
    ctx.save()
    ctx.strokeStyle = '#171717'
    ctx.lineWidth = 20

    const circles = [
      [1130, 80, 120],
      [1180, 300, 170],
      [1100, 590, 130],
      [950, 30, 100],
      [1000, 680, 160]
    ]

    circles.forEach(([x, y, radius]) => {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()
    })

    ctx.restore()

    // Area putih untuk QR
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(735, 105, 410, 460)

    // Identitas aplikasi
    ctx.fillStyle = '#171717'
    ctx.font = 'bold 34px Arial'
    ctx.fillText('EVENTCHECK', 75, 85)

    ctx.font = 'bold 19px Arial'
    ctx.fillText('RIJAN', 75, 112)

    ctx.fillRect(75, 135, 530, 4)

    // Label undangan
    ctx.font = 'bold 20px Arial'
    ctx.fillText('UNDANGAN RESMI', 75, 190)

    // Nama acara
    const eventName = activeEvent?.name || 'Acara EventCheckRijan'

    ctx.font = '24px Arial'
    ctx.fillStyle = '#555555'
    ctx.fillText(eventName.substring(0, 48), 75, 230)

    // Nama tamu
    ctx.fillStyle = '#111111'

    let nameSize = 52
    while (nameSize > 28) {
      ctx.font = `bold ${nameSize}px Arial`

      if (ctx.measureText(inviteGuest.name).width <= 590) {
        break
      }

      nameSize -= 2
    }

    ctx.fillText(inviteGuest.name, 75, 325)

    // Informasi tamu
    ctx.font = '23px Arial'
    ctx.fillStyle = '#555555'

    ctx.fillText(
      inviteGuest.institution || '-',
      75,
      375
    )

    ctx.font = 'bold 19px Arial'
    ctx.fillStyle = '#171717'

    ctx.fillText(
      `KATEGORI: ${inviteGuest.category}`,
      75,
      425
    )

    ctx.font = '19px Arial'
    ctx.fillText(
      `KELOMPOK: ${inviteGuest.guestGroup || '-'}`,
      75,
      465
    )

    // Kode undangan
    ctx.fillRect(75, 505, 530, 2)

    ctx.font = 'bold 24px Arial'
    ctx.fillText(
      `KODE: ${inviteGuest.invitationCode}`,
      75,
      550
    )

    // Tanggal acara
    const eventDate = activeEvent?.event_date
      ? new Date(
          activeEvent.event_date +
          (activeEvent.event_date.length === 10
            ? 'T00:00:00'
            : '')
        ).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        })
      : ''

    ctx.font = '17px Arial'
    ctx.fillStyle = '#666666'
    ctx.fillText(eventDate, 75, 595)

    // Buat QR dari SVG asli
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement
    clonedSvg.setAttribute('width', '500')
    clonedSvg.setAttribute('height', '500')

    const svgData = new XMLSerializer().serializeToString(clonedSvg)

    const svgBlob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8'
    })

    const svgUrl = URL.createObjectURL(svgBlob)
    const qrImage = new Image()

    qrImage.onload = () => {
      try {
        // Panel QR
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(755, 125, 370, 370)

        // QR besar
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(qrImage, 770, 140, 340, 340)

        // Label scan
        ctx.fillStyle = '#171717'
        ctx.textAlign = 'center'
        ctx.font = 'bold 22px Arial'
        ctx.fillText('SCAN UNTUK CHECK-IN', 940, 535)

        ctx.font = '16px Arial'
        ctx.fillStyle = '#555555'
        ctx.fillText('Tunjukkan kartu ini kepada petugas', 940, 565)

        ctx.textAlign = 'left'

        canvas.toBlob(blob => {
          URL.revokeObjectURL(svgUrl)

          if (!blob) {
            setNotice('Gagal membuat kartu undangan.')
            return
          }

          const downloadUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')

          link.href = downloadUrl
          link.download = `Kartu-${inviteGuest.invitationCode}.png`
          link.click()

          URL.revokeObjectURL(downloadUrl)

          setNotice('Kartu undangan berhasil diunduh.')
          setTimeout(() => setNotice(''), 3500)
        }, 'image/png')
      } catch (error) {
        URL.revokeObjectURL(svgUrl)
        console.error(error)
        setNotice('Gagal membuat kartu undangan.')
      }
    }

    qrImage.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      setNotice('Gagal memproses QR Code.')
    }

    qrImage.src = svgUrl

  } catch (error) {
    console.error('Gagal mengunduh kartu:', error)
    setNotice('Gagal membuat kartu undangan.')
  }
}

const pageContent = () => {
  if (guestsLoading) {
    return <div className="empty-state">Memuat data tamu...</div>
  }

  if (guestsError) {
    return <div className="empty-state">{guestsError}</div>
  }

  if (page === 'dashboard') return (
    <Dashboard
      guests={guests}
      present={present}
      recent={recent}
      onNavigate={setPage}
      activeEvent={activeEvent}
      eventLoading={eventLoading}
    />
  )

  if (page === 'checkin') {
    return (
      <Checkin
  guests={guests}
  search={search}
  setSearch={setSearch}
  onCheckin={checkIn}
  onAdd={() => setShowAdd(true)}
/>
    )
  }

  if (page === 'guests') {
  return (
    <GuestsPage
      guests={filtered}
      search={search}
      setSearch={setSearch}
      onCheckin={checkIn}
      onDelete={handleDeleteGuests}
      onAdd={() => setShowAdd(true)}
      onInvite={setInviteGuest}
      onImport={() => setShowImport(true)}
      showImport={showImport}
      eventId={activeEvent?.id || ''}
      onCloseImport={() => setShowImport(false)}
      onImported={async () => {
        if (!activeEvent?.id) return
        const updatedGuests = await getGuestsByEvent(activeEvent.id)
        setGuests(updatedGuests)
      }}
    />
  )
}

  if (page === 'reports') {
  return (
    <Reports
      guests={guests}
      present={present}
      activeEvent={activeEvent}
    />
  )
}

  if (page === 'events') return <EventsPage onEventsChanged={async () => {
    const { data } = await supabase.from('events').select('id, name, description, event_date, location, status').eq('status', 'active').order('event_date', { ascending: false })
    const available = (data || []) as ActiveEvent[]
    setActiveEvents(available)
    const stillSelected = available.find(event => event.id === activeEvent?.id) || available[0] || null
    setActiveEvent(stillSelected)
    if (stillSelected) window.localStorage.setItem('eventcheckrijan:selected-event-id', stillSelected.id)
    else window.localStorage.removeItem('eventcheckrijan:selected-event-id')
  }} />

  if (page === 'staff') return <StaffPage />

  return <SettingsPage />
}

  // Tampilkan halaman undangan publik ketika URL berisi token undangan.
  if (inviteTokenFromUrl) {
    if (eventLoading || guestsLoading) {
      return <main className="public-invite-page"><p>Memuat undangan...</p></main>
    }

    if (publicInviteGuest) {
      return <PublicInvitation guest={publicInviteGuest} eventName={activeEvent?.name || 'EventCheckRijan'} />
    }

    return (
      <main className="public-invite-page">
        <section className="public-invite-card">
          <h1>Undangan tidak ditemukan</h1>
          <p>Link undangan tidak valid atau acara tidak tersedia.</p>
        </section>
      </main>
    )
  }

  return <div className="app-shell">
    <Sidebar
  activePage={page}
  activeEvents={activeEvents}
  selectedEventId={activeEvent?.id || ''}
  onSelectEvent={selectActiveEvent}
  onNavigate={setPage}
  mobileOpen={mobileOpen}
  onClose={() => setMobileOpen(false)}
  onLogout={() => {
    void supabase.auth.signOut()
  }}
/>
    <main className="main-area">
      <Topbar page={page} onMenuClick={() => setMobileOpen(true)} />
      <div className="content-area">{pageContent()}</div>
      <footer className="footer"><span>© 2026 EventCheckRijan</span><span>Event Guest Management System <b>•</b> Versi 0.1.0</span></footer>
    </main>
    {notice && <div className="toast"><CheckCircle2 size={18}/>{notice}<button onClick={() => setNotice('')}><X size={16}/></button></div>}
    
    {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><h2>Daftarkan tamu undangan</h2><p>Tamu akan menerima link undangan dan QR pribadi.</p></div><button className="icon-button" onClick={() => setShowAdd(false)}><X size={19}/></button></div>
      <label className="form-label">Nama lengkap</label><input className="form-input" autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Masukkan nama tamu"/>
      <label className="form-label">Kategori tamu</label><select className="form-input" value={newCategory} onChange={e => setNewCategory(e.target.value as GuestCategory)}><option value="VVIP">VVIP</option><option value="VIP">VIP</option><option value="Reguler">Reguler</option><option value="Lainnya">Lainnya</option></select>
      
<div className="modal-actions">
  <button
    className="btn-secondary"
    onClick={() => setShowAdd(false)}
  >
    Batal
  </button>

  <button
    className="btn-primary"
    onClick={addGuest}
    disabled={!newName.trim()}
  >
    <UserPlus size={16} /> Simpan & Buat Undangan
  </button>
</div>

      


    </div></div>}
    
{inviteGuest && (
  <div
    className="modal-backdrop"
    onClick={() => setInviteGuest(null)}
  >
    <div
      className="modal invitation-modal"
      onClick={e => e.stopPropagation()}
    >
      <div className="modal-head">
        <div>
          <h2>Undangan tamu</h2>
          <p>Bagikan link ini kepada {inviteGuest.name}.</p>
        </div>
        <button
          className="icon-button"
          onClick={() => setInviteGuest(null)}
        >
          <X size={19} />
        </button>
      </div>

      <div className="invite-qr">
        <QRCodeSVG
          id="invite-qr-svg"
          value={`${window.location.origin}/undangan/${inviteGuest.inviteToken}`}
          size={190}
          level="H"
          includeMargin
        />
      </div>

      <div className="invite-code">
        {inviteGuest.invitationCode}
      </div>

      <label className="form-label">
        Link undangan pribadi
      </label>

      <input
        className="form-input"
        readOnly
        value={`${window.location.origin}/undangan/${inviteGuest.inviteToken}`}
        onFocus={e => e.currentTarget.select()}
      />

      
      <div className="modal-actions">
        <button
          className="btn-secondary"
          onClick={() => {
            navigator.clipboard?.writeText(
              `${window.location.origin}/undangan/${inviteGuest.inviteToken}`
            )
            setNotice('Link undangan disalin.')
          }}
        >
          Salin link
        </button>

        <button
          className="btn-secondary"
          onClick={downloadInviteQR}
        >
          <Download size={16} /> Download QR
        </button>

        <button
          className="btn-primary"
          onClick={() => setInviteGuest(null)}
        >
          Selesai
        </button>
      </div>

    </div>
  </div>
)}

</div>
  }
  
function Dashboard({
  guests,
  present,
  recent,
  onNavigate,
  activeEvent,
  eventLoading
}: {
  guests: Guest[]
  present: number
  recent: Guest[]
  onNavigate: (p: Page) => void
  activeEvent: ActiveEvent | null
  eventLoading: boolean
}) {
  const total = guests.length
  const percent = total ? Math.round(present / total * 100) : 0
  const bars = [18, 28, 24, 42, 35, 57, 48, 68, 52, 78, 63, 91]
  return <>
    <div className="event-banner">
  <div className="event-banner-icon">
    <CalendarDays size={22} />
  </div>

  <div className="event-banner-copy">
    <span>
      {eventLoading
        ? 'MEMUAT EVENT'
        : activeEvent
          ? 'EVENT SEDANG BERLANGSUNG'
          : 'BELUM ADA EVENT AKTIF'}
    </span>

    <h2>
      {eventLoading
        ? 'Memuat informasi...'
        : activeEvent?.name || 'Belum ada event aktif'}
    </h2>

    <p>
      {activeEvent?.event_date && (
        <>
          <CalendarDays size={14} />
          {new Date(`${activeEvent.event_date}T00:00:00`).toLocaleDateString(
            'id-ID',
            { day: 'numeric', month: 'long', year: 'numeric' }
          )}
        </>
      )}

      {activeEvent?.event_date && activeEvent?.location && <i />}

      {activeEvent?.location && (
        <>
          <MapPin size={14} />
          {activeEvent.location}
        </>
      )}

      {!eventLoading && !activeEvent && 'Silakan aktifkan event melalui Manajemen Event.'}
    </p>
  </div>

  <button
    className="banner-button"
    onClick={() => onNavigate('events')}
  >
    Detail event <ChevronRight size={16} />
  </button>
</div>
    <div className="section-title-row"><div><h2>Ringkasan kehadiran</h2><p>Berikut kondisi kehadiran tamu pada event aktif.</p></div><span className="live-indicator"><i/> Data demo</span></div>
    <div className="stats-grid">
      <StatCard label="Total Tamu" value={String(total)} note="Seluruh data tamu" icon={Users} tone="blue"/>
      <StatCard label="Sudah Hadir" value={String(present)} note={`${percent}% dari total tamu`} icon={UserCheck} tone="green"/>
      <StatCard label="Belum Hadir" value={String(total - present)} note="Menunggu check-in" icon={UserRoundX} tone="amber"/>
      <StatCard label="Jumlah Kategori" value={String(new Set(guests.map(g => g.category.trim()).filter(Boolean)).size)} note="Kategori dari data tamu" icon={Crown} tone="violet"/>
    </div>
    <section className="panel dashboard-category-panel">
      <div className="panel-heading"><div><h3>Ringkasan per kategori</h3><p>Jumlah tamu, sudah hadir, dan belum hadir untuk setiap kategori dari Excel.</p></div></div>
      {guests.length ? <div className="category-summary-grid">
        {Array.from(new Set(guests.map(g => g.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id')).map(category => {
          const categoryGuests = guests.filter(g => g.category.trim() === category)
          const categoryPresent = categoryGuests.filter(g => g.status === 'Hadir').length
          const categoryAbsent = categoryGuests.length - categoryPresent
          const categoryPercent = categoryGuests.length ? Math.round(categoryPresent / categoryGuests.length * 100) : 0
          return <article className="category-summary-card" key={category}>
            <div className="category-summary-heading"><CategoryBadge category={category}/><span>{categoryPercent}% hadir</span></div>
            <div className="category-summary-total">{categoryGuests.length}<small> total tamu</small></div>
            <div className="category-summary-stats"><span><i className="category-dot present-dot"/>Hadir <strong>{categoryPresent}</strong></span><span><i className="category-dot absent-dot"/>Belum hadir <strong>{categoryAbsent}</strong></span></div>
            <div className="category-summary-progress"><i style={{width: `${categoryPercent}%`}}/></div>
          </article>
        })}
      </div> : <div className="empty-state">Belum ada data tamu untuk ditampilkan.</div>}
    </section>
    <div className="dashboard-grid">
      <section className="panel attendance-panel">
        <div className="panel-heading"><div><h3>Statistik kehadiran</h3><p>Perkembangan check-in hari ini</p></div><button className="select-chip">Hari ini <ChevronRight size={14}/></button></div>
        <div className="chart-summary"><strong>{present} <small>tamu hadir</small></strong><span className="chart-percent"><ArrowUpRight size={15}/>{percent}%</span></div>
        <div className="bar-chart">{bars.map((height, i) => <div className="bar-column" key={i}><div className={`bar ${i === 11 ? 'bar-current' : ''}`} style={{ height: `${height}%` }}/><span>{['07','08','09','10','11','12','13','14','15','16','17','18'][i]}</span></div>)}</div>
        <div className="chart-legend"><span><i/> Jumlah check-in</span><span>Ilustrasi visual — data demo</span></div>
      </section>
      <section className="panel progress-panel">
        <div className="panel-heading"><div><h3>Progres kehadiran</h3><p>Persentase tamu yang hadir</p></div><MoreHorizontal size={20}/></div>
        <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#2563eb ${percent}%, #edf1f7 0)` }}><div><strong>{percent}%</strong><small>Hadir</small></div></div></div>
        <div className="progress-legend"><div><span><i className="legend-blue"/>Sudah hadir</span><strong>{present}</strong></div><div><span><i className="legend-gray"/>Belum hadir</span><strong>{total - present}</strong></div></div>
      </section>
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><h3>Aktivitas check-in terbaru</h3><p>Daftar tamu yang terakhir melakukan check-in.</p></div><button className="text-button" onClick={() => onNavigate('guests')}>Lihat semua <ArrowUpRight size={15}/></button></div>
      <GuestTable guests={recent} compact/>
    </section>
  </>
}

function Checkin({ guests, search, setSearch, onCheckin, onAdd }: { guests: Guest[]; search: string; setSearch: (s: string) => void; onCheckin: (id: string) => void; onAdd: () => void }) {
  const results = guests.filter(g => g.name.toLowerCase().includes(search.toLowerCase()) || g.invitationCode.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
  return <div className="checkin-page">
    <div className="checkin-intro"><div className="checkin-icon"><ScanLine size={26}/></div><div><h2>Meja registrasi tamu</h2><p>Cari nama atau pindai QR Code undangan untuk mencatat kehadiran.</p></div><span className="live-indicator"><i/> Siap digunakan</span></div>
    <div className="checkin-layout">
      <section className="panel search-panel"><div className="panel-heading"><div><h3>Verifikasi undangan</h3><p>Masukkan nama atau nomor undangan tamu.</p></div></div>
        <div className="large-search"><Search size={21}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama tamu / nomor undangan..."/>{search && <button onClick={() => setSearch('')}><X size={17}/></button>}</div>
        <div className="search-hint"><Info size={15}/> Pencarian akan menampilkan data tamu yang cocok.</div>
        <div className="result-heading"><strong>Hasil pencarian</strong><span>{results.length} tamu ditemukan</span></div>
        {results.length ? results.map(g => <div className="checkin-result" key={g.id}><div className="guest-avatar">{g.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</div><div className="result-copy"><strong>{g.name}</strong><span>{g.invitationCode} · {g.institution}</span><div><CategoryBadge category={g.category}/></div></div>{g.status === 'Hadir' ? <span className="already-checkin"><Check size={14}/> Sudah hadir</span> : <button className="btn-primary small" onClick={() => onCheckin(g.id)}>Check-in</button>}</div>) : <div className="empty-state"><Users size={25}/><strong>Tamu tidak ditemukan</strong><span>Coba periksa ejaan atau tambahkan sebagai tamu baru.</span><button className="btn-primary" onClick={onAdd}><Plus size={16}/> Tambah tamu baru</button></div>}
        <div className="walkin-box"><div><UserPlus size={18}/><span><strong>Tamu belum terdaftar?</strong><small>Catat tamu walk-in secara langsung.</small></span></div><button className="btn-secondary" onClick={onAdd}><Plus size={16}/> Tambah tamu</button></div>
      </section>
      <aside className="scan-side"><section className="panel qr-panel"><div className="qr-illustration"><QrCode size={72}/><span className="scan-line"/></div><h3>Scan QR Code</h3><p>Fitur pemindaian kamera akan diaktifkan pada tahap integrasi QR.</p><button className="btn-secondary full" disabled><ScanLine size={16}/> Segera hadir</button></section><section className="panel quick-info"><h3>Petunjuk check-in</h3><div><span className="step-number">1</span><p>Cari nama atau nomor undangan tamu.</p></div><div><span className="step-number">2</span><p>Pastikan identitas dan kategori sudah benar.</p></div><div><span className="step-number">3</span><p>Tekan tombol check-in untuk menyimpan kehadiran.</p></div></section></aside>
    </div>
  </div>
}


function GuestsPage({
  guests,
  search,
  setSearch,
  onCheckin,
  onDelete,
  onAdd,
  onInvite,
  onImport,
  showImport,
  eventId,
  onCloseImport,
  onImported
  
}: {
  guests: Guest[]
  search: string
  setSearch: (s: string) => void
  onCheckin: (id: string) => void
  onDelete: (ids: string[]) => void
  onAdd: () => void
  onInvite: (guest: Guest) => void
  onImport: () => void
  showImport: boolean
  eventId: string
  onCloseImport: () => void
  onImported: () => Promise<void>
}) {
  return (
    <>
      <div className="toolbar-row">
        <div className="toolbar-search">
          <Search size={17} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, institusi, atau kode..."
          />
        </div>

        <button className="btn-secondary" onClick={onImport}>
          <Upload size={16} /> Import data
        </button>

        <button
          className="btn-secondary"
          onClick={() => alert('Fitur ekspor akan dibuat pada tahap laporan.')}
        >
          <Download size={16} /> Export
        </button>

        <button className="btn-primary" onClick={onAdd}>
          <Plus size={16} /> Tambah tamu
        </button>
      </div>

      {showImport && eventId && (
        <GuestImportModal
          eventId={eventId}
          existingGuests={guests}
          onClose={onCloseImport}
          onImported={onImported}
        />
      )}

      <section className="panel guest-list-panel">
        <div className="panel-heading">
          <div>
            <h3>Daftar seluruh tamu</h3>
            <p>{guests.length} data tamu ditampilkan · acara aktif</p>
          </div>
          <button className="select-chip">
            <Filter size={14} /> Filter
          </button>
        </div>

        <GuestTable
          guests={guests}
          onCheckin={onCheckin}
          onInvite={onInvite}
          onDelete={onDelete}
        />
      </section>
    </>
  )
}
function GuestTable({
  guests,
  compact = false,
  onCheckin,
  onInvite,
  onDelete
}: {
  guests: Guest[]
  compact?: boolean
  onCheckin?: (id: string) => void
  onInvite?: (guest: Guest) => void
  onDelete?: (ids: string[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    setSelectedIds(current =>
      current.filter(id => guests.some(g => g.id === id))
    )
  }, [guests])

  const allSelected =
    guests.length > 0 &&
    guests.every(g => selectedIds.includes(g.id))

  function toggleGuest(id: string) {
    setSelectedIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    )
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : guests.map(g => g.id))
  }

  return (
    <div>
      {!compact && onDelete && (
        <div className="table-selection-toolbar">
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
            />
            Pilih semua
          </label>

          <span>{selectedIds.length} tamu dipilih</span>

          <button
            className="btn-secondary"
            disabled={selectedIds.length === 0}
            onClick={() => {
              onDelete(selectedIds)
              setSelectedIds([])
            }}
          >
            Hapus yang dipilih
          </button>

          <button
            className="btn-secondary"
            disabled={guests.length === 0}
            onClick={() => onDelete(guests.map(g => g.id))}
          >
            Hapus semua
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {!compact && <th>PILIH</th>}
              <th>NAMA TAMU</th>
              <th>KATEGORI</th>
              {!compact && <th>SUMBER</th>}
              <th>STATUS</th>
              <th>WAKTU</th>
              {!compact && <th>AKSI</th>}
            </tr>
          </thead>

          <tbody>
            {guests.map(g => (
              <tr key={g.id}>
                {!compact && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(g.id)}
                      onChange={() => toggleGuest(g.id)}
                    />
                  </td>
                )}

                <td>
                  <div className="table-person">
                    <div className="guest-avatar">
                      {g.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <strong>{g.name}</strong>
                      <small>{g.invitationCode}</small>
                    </div>
                  </div>
                </td>

                <td><CategoryBadge category={g.category} /></td>

                {!compact && (
                  <td><span className="source-label">{g.source}</span></td>
                )}

                <td><StatusBadge status={g.status} /></td>

                <td>
  <span className="time-label">
    {g.checkedInAt
      ? new Date(g.checkedInAt).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
      : '—'
    }
  </span>
</td>

                {!compact && (
                  <td>
                    <div className="table-actions">
                      {onInvite && (
                        <button
                          className="table-action"
                          onClick={() => onInvite(g)}
                        >
                          Undangan / QR
                        </button>
                      )}

                      {g.status === 'Belum hadir' && onCheckin && (
                        <button
                          className="table-action"
                          onClick={() => onCheckin(g.id)}
                        >
                          Check-in
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {!guests.length && (
          <div className="empty-table">
            Tidak ada data tamu yang cocok.
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryBadge({ category }: { category: GuestCategory }) {
  const style =
    category === 'VVIP' ? 'vvip' :
    category === 'VIP' ? 'vip' :
    category === 'Lainnya' ? 'other' :
    'regular'

  return (
    <span className={`category-badge ${style}`}>
      {(category === 'VVIP' || category === 'VIP') && <Crown size={11}/>}
      {category}
    </span>
  )
}
function StatusBadge({ status }: { status: Guest['status'] }) { return <span className={`status-badge ${status === 'Hadir' ? 'present' : 'absent'}`}><i/>{status}</span> }



function Reports({
  guests,
  present,
  activeEvent
}: {
  guests: Guest[]
  present: number
  activeEvent: ActiveEvent | null
}) {
  const [reportFilter, setReportFilter] = useState<
    'all' | 'present' | 'absent'
  >('all')

  const categories = Array.from(
    new Set(guests.map(guest => guest.category.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'id'))

  const filterLabels = {
    all: 'Semua Tamu',
    present: 'Hadir',
    absent: 'Belum Hadir'
  }

  const filteredGuests = guests.filter(guest => {
    if (reportFilter === 'present') {
      return guest.status === 'Hadir'
    }

    if (reportFilter === 'absent') {
      return guest.status === 'Belum hadir'
    }

    return true
  })

  const eventName = activeEvent?.name || 'EventCheckRijan'
  const eventDate = activeEvent?.event_date
    ? new Date(
        activeEvent.event_date + (
          activeEvent.event_date.length === 10 ? 'T00:00:00' : ''
        )
      ).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : '-'

  const safeFileName = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const fileName = `${safeFileName(eventName)}-${reportFilter}`

  const formatCheckIn = (value?: string) => {
    if (!value) return '-'

    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString('id-ID')
  }

  // EXPORT EXCEL
  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'EventCheckRijan'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Laporan Tamu')

      worksheet.columns = [
        { key: 'number', width: 8 },
        { key: 'name', width: 28 },
        { key: 'institution', width: 25 },
        { key: 'category', width: 14 },
        { key: 'group', width: 24 },
        { key: 'code', width: 20 },
        { key: 'status', width: 18 },
        { key: 'checkin', width: 25 },
        { key: 'source', width: 16 }
      ]

      worksheet.mergeCells('A1:I1')
      worksheet.getCell('A1').value = 'LAPORAN KEHADIRAN TAMU'
      worksheet.getCell('A1').font = {
        bold: true,
        size: 16
      }

      worksheet.getCell('A2').value = 'Nama Acara'
      worksheet.getCell('B2').value = eventName
      worksheet.getCell('A3').value = 'Tanggal Acara'
      worksheet.getCell('B3').value = eventDate
      worksheet.getCell('A4').value = 'Jenis Laporan'
      worksheet.getCell('B4').value = filterLabels[reportFilter]
      worksheet.getCell('A5').value = 'Jumlah Tamu'
      worksheet.getCell('B5').value = filteredGuests.length

      const headerRow = worksheet.addRow([
        'No',
        'Nama Tamu',
        'Instansi',
        'Kategori',
        'Kelompok Tamu',
        'Kode Undangan',
        'Status',
        'Waktu Check-in',
        'Sumber'
      ])

      headerRow.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      }

      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF26352D' }
      }

      filteredGuests.forEach((guest, index) => {
        worksheet.addRow([
          index + 1,
          guest.name,
          guest.institution || '-',
          guest.category,
          guest.guestGroup || '-',
          guest.invitationCode,
          guest.status,
          formatCheckIn(guest.checkedInAt),
          guest.source
        ])
      })

      worksheet.views = [
        { state: 'frozen', ySplit: 6 }
      ]

      const buffer = await workbook.xlsx.writeBuffer()

      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `${fileName}.xlsx`
      link.click()

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Gagal ekspor Excel:', error)
      alert('Gagal membuat file Excel.')
    }
  }

  // EXPORT PDF
  const exportPDF = () => {
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      pdf.setFontSize(16)
      pdf.text('LAPORAN KEHADIRAN TAMU', 14, 15)

      pdf.setFontSize(10)
      pdf.text(`Nama Acara: ${eventName}`, 14, 23)
      pdf.text(`Tanggal Acara: ${eventDate}`, 14, 29)
      pdf.text(
        `Jenis Laporan: ${filterLabels[reportFilter]}`,
        150,
        23
      )
      pdf.text(
        `Jumlah Tamu: ${filteredGuests.length}`,
        150,
        29
      )

      autoTable(pdf, {
        startY: 36,
        head: [[
          'No',
          'Nama Tamu',
          'Instansi',
          'Kategori',
          'Kelompok',
          'Kode Undangan',
          'Status',
          'Waktu Check-in',
          'Sumber'
        ]],
        body: filteredGuests.map((guest, index) => [
          index + 1,
          guest.name,
          guest.institution || '-',
          guest.category,
          guest.guestGroup || '-',
          guest.invitationCode,
          guest.status,
          formatCheckIn(guest.checkedInAt),
          guest.source
        ]),
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [38, 53, 45],
          textColor: 255
        },
        margin: {
          left: 10,
          right: 10
        }
      })

      pdf.save(`${fileName}.pdf`)
    } catch (error) {
      console.error('Gagal ekspor PDF:', error)
      alert('Gagal membuat file PDF.')
    }
  }

  return (
    <>
      <div className="stats-grid">
        <StatCard
          label="Total tamu"
          value={String(guests.length)}
          note="Seluruh kategori"
          icon={Users}
          tone="blue"
        />

        <StatCard
          label="Hadir"
          value={String(present)}
          note="Check-in tercatat"
          icon={UserCheck}
          tone="green"
        />

        <StatCard
          label="Belum hadir"
          value={String(guests.length - present)}
          note="Belum check-in"
          icon={UserRoundX}
          tone="amber"
        />

        <StatCard
          label="Persentase hadir"
          value={`${guests.length ? Math.round(present / guests.length * 100) : 0}%`}
          note="Dari total tamu"
          icon={ChartNoAxesCombined}
          tone="violet"
        />
      </div>

      <section className="panel report-panel">
        <div className="panel-heading">
          <div>
            <h3>Rekap berdasarkan kategori</h3>
            <p>
              Distribusi kehadiran setiap kategori tamu.
            </p>
          </div>
        </div>

        {categories.map(cat => {
          const total = guests.filter(
            guest => guest.category === cat
          ).length

          const checked = guests.filter(
            guest =>
              guest.category === cat &&
              guest.status === 'Hadir'
          ).length

          return (
            <div className="report-row" key={cat}>
              <div>
                <CategoryBadge category={cat} />
                <span>{checked} dari {total} hadir</span>
              </div>

              <div className="report-progress">
                <i
                  style={{
                    width: `${total ? checked / total * 100 : 0}%`
                  }}
                />
              </div>

              <strong>
                {total
                  ? Math.round(checked / total * 100)
                  : 0}%
              </strong>
            </div>
          )
        })}
      </section>

      <section className="panel report-panel">
        <div className="panel-heading">
          <div>
            <h3>Ekspor Laporan</h3>
            <p>
              Unduh data kehadiran untuk acara {eventName}.
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center'
        }}>
          <select
            className="form-input"
            value={reportFilter}
            onChange={event =>
              setReportFilter(
                event.target.value as typeof reportFilter
              )
            }
            style={{
              maxWidth: '240px',
              minWidth: '190px'
            }}
          >
            <option value="all">Semua Tamu</option>
            <option value="present">Hanya Hadir</option>
            <option value="absent">Hanya Belum Hadir</option>
          </select>

          <button
            className="btn-secondary"
            onClick={exportExcel}
            disabled={filteredGuests.length === 0}
          >
            <Download size={16} />
            Unduh Excel
          </button>

          <button
            className="btn-primary"
            onClick={exportPDF}
            disabled={filteredGuests.length === 0}
          >
            <Download size={16} />
            Unduh PDF
          </button>
        </div>

        <p style={{
          marginTop: '14px',
          fontSize: '13px',
          color: 'var(--text-muted, #777)'
        }}>
          {filterLabels[reportFilter]}: {filteredGuests.length} data tamu.
        </p>
      </section>
    </>
  )
}

function SettingsPage() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Pengaturan Aplikasi</h3>
          <p>Informasi dan pengaturan EventCheckRijan.</p>
        </div>
      </div>

      <div className="settings-content">
        <div className="report-row">
          <div>
            <strong>Nama aplikasi</strong>
            <p>EventCheckRijan</p>
          </div>
        </div>

        <div className="report-row">
          <div>
            <strong>Versi aplikasi</strong>
            <p>0.1.0</p>
          </div>
        </div>

        <div className="report-row">
          <div>
            <strong>Database</strong>
            <p>Supabase</p>
          </div>
        </div>
      </div>
    </section>
  )
}
export default App
function PublicInvitation({ guest, eventName }: { guest: Guest; eventName: string }) {
  const invitationUrl = `${window.location.origin}/undangan/${guest.inviteToken}`
  return <main className="public-invite-page">
    <section className="public-invite-card">
      <div className="public-invite-brand"><CalendarDays size={20}/> EventCheckRijan</div>
      <span className="public-invite-eyebrow">UNDANGAN RESMI</span>
      <h1>{eventName}</h1>
      <p className="public-invite-subtitle">Dengan hormat, kami mengundang:</p>
      <h2>{guest.name}</h2>
      <div className="public-invite-meta"><span>{guest.category}</span><span>Kode: {guest.invitationCode}</span></div>
      <div className="public-invite-qr"><QRCodeSVG value={invitationUrl} size={210} level="H" includeMargin /></div>
      <strong className="public-invite-status">{guest.status === 'Hadir' ? 'Check-in telah tercatat' : 'Tunjukkan QR ini kepada petugas saat tiba'}</strong>
      <p className="public-invite-note">QR ini merupakan identitas undangan pribadi. Simpan link ini dan jangan bagikan kepada orang lain.</p>
    </section>
  </main>
}
