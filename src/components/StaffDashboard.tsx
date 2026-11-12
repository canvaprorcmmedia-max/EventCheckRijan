
import { useEffect, useState } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  MapPin,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ScanLine,
  Camera,
  X,
  UserRound,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Keyboard,
  UserPlus
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'

type AssignedEvent = {
  id: string
  name: string
  event_date: string | null
  location: string | null
  status: string
}

type AssignmentRow = {
  event_id: string
  events: AssignedEvent | AssignedEvent[] | null
}

type GuestRecord = {
  id: string
  name: string
  institution: string | null
  category: string
  guest_group: string | null
  invitation_code: string
  invite_token: string
  status: string
  checked_in_at?: string | null
}

type Props = {
  userId: string
  fullName: string
  onLogout: () => void
}

function QrCamera({
  onDecoded,
  onClose
}: {
  onDecoded: (value: string) => void
  onClose: () => void
}) {
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    const scanner = new Html5Qrcode('staff-qr-reader')
    let cancelled = false
    let started = false
    let handled = false

    async function startCamera() {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1
          },
          decodedText => {
            if (handled || cancelled) return

            handled = true
            onDecoded(decodedText)
          },
          () => {
            // Kesalahan pembacaan per frame tidak perlu ditampilkan.
          }
        )

        started = true

        if (cancelled) {
          await scanner.stop().catch(() => {})
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            'Kamera tidak dapat dibuka. Periksa izin kamera pada browser dan pastikan perangkat mendukung kamera.'
          )
        }
      }
    }

    void startCamera()

    return () => {
      cancelled = true

      if (started) {
        void scanner.stop().catch(() => {})
      }
    }
  }, [onDecoded])

  return (
    <section className="staff-scanner-panel">
      <div className="staff-scanner-heading">
        <div>
          <span>PEMINDAI UNDANGAN</span>
          <h3>Scan QR Tamu</h3>
        </div>

        <button
          className="btn-secondary"
          onClick={onClose}
          type="button"
        >
          <X size={16} />
          Tutup
        </button>
      </div>

      <div id="staff-qr-reader" />

      {cameraError && (
        <div className="staff-message staff-error">
          <AlertCircle size={17} />
          {cameraError}
        </div>
      )}

      <p className="staff-scanner-hint">
        Arahkan kamera ke QR Code pada undangan tamu.
      </p>
    </section>
  )
}

export default function StaffDashboard({
  userId,
  fullName,
  onLogout
}: Props) {
  const [events, setEvents] = useState<AssignedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] =
    useState<AssignedEvent | null>(null)

  const [scannerOpen, setScannerOpen] = useState(false)
  const [checkInMode, setCheckInMode] = useState<'scan' | 'manual'>('scan')
  const [manualName, setManualName] = useState('')
  const [manualInstitution, setManualInstitution] = useState('')
  const [manualCategory, setManualCategory] = useState('Reguler')
  const [manualGroup, setManualGroup] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [scannedGuest, setScannedGuest] =
    useState<GuestRecord | null>(null)

  const [scanLoading, setScanLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [scanMessageType, setScanMessageType] =
    useState<'success' | 'error' | 'warning'>('success')

  async function loadEvents() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('event_staff')
      .select(`
        event_id,
        events (
          id,
          name,
          event_date,
          location,
          status
        )
      `)
      .eq('staff_id', userId)

    if (error) {
      setError('Gagal mengambil daftar acara. Silakan coba lagi.')
      setEvents([])
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as AssignmentRow[]

    const assignedEvents = rows
      .map(row => {
        if (Array.isArray(row.events)) {
          return row.events[0] ?? null
        }

        return row.events
      })
      .filter(
        (event): event is AssignedEvent =>
          event !== null && event.status !== 'archived'
      )

    setEvents(assignedEvents)
    setLoading(false)
  }

  useEffect(() => {
    void loadEvents()
  }, [userId])

  function formatDate(date: string | null) {
    if (!date) return 'Tanggal belum ditentukan'

    return new Date(`${date}T00:00:00`).toLocaleDateString(
      'id-ID',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    )
  }

  async function getCheckInTimestamp(eventId: string, guestId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('check_ins')
      .select('checked_in_at')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Gagal mengambil waktu check-in:', error.message)
      return null
    }

    return data?.checked_in_at ?? null
  }

  function formatCheckInTime(value?: string | null) {
    if (!value) return 'Waktu tidak tersedia'

    return new Date(value).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' WIB'
  }

  function extractToken(qrValue: string) {
    const value = qrValue.trim()

    try {
      const url = new URL(value)
      const match = url.pathname.match(/\/undangan\/([^/]+)/)

      if (match) return decodeURIComponent(match[1])
    } catch {
      // QR mungkin berisi token langsung, bukan URL.
    }

    return value
  }

  async function handleQrDecoded(qrValue: string) {
    setScannerOpen(false)
    setScanLoading(true)
    setScannedGuest(null)
    setScanMessage('')

    const token = extractToken(qrValue)

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidPattern.test(token)) {
      setScanMessage('QR tidak valid atau format undangan tidak dikenali.')
      setScanMessageType('error')
      setScanLoading(false)
      return
    }

    if (!selectedEvent) {
      setScanMessage('Silakan pilih acara terlebih dahulu.')
      setScanMessageType('error')
      setScanLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('guests')
      .select(`
  id,
  name,
  institution,
  category,
  guest_group,
  invitation_code,
  invite_token,
  status
`)
      .eq('event_id', selectedEvent.id)
      .eq('invite_token', token)
      .maybeSingle()

    if (error || !data) {
      setScanMessage(
        'QR tidak ditemukan pada acara ini. Pastikan undangan sesuai dengan acara yang dipilih.'
      )
      setScanMessageType('error')
      setScanLoading(false)
      return
    }

    let guest = data as GuestRecord
    if (guest.status === 'Hadir') {
      const checkedInAt = await getCheckInTimestamp(selectedEvent.id, guest.id)
      guest = { ...guest, checked_in_at: checkedInAt }
    }
    setScannedGuest(guest)

    if (guest.status === 'Hadir') {
      setScanMessage('Tamu ini sudah tercatat hadir sebelumnya.')
      setScanMessageType('warning')
    } else {
      setScanMessage('Identitas ditemukan. Periksa data tamu sebelum konfirmasi.')
      setScanMessageType('success')
    }

    setScanLoading(false)
  }

  async function confirmCheckIn() {
    if (!selectedEvent || !scannedGuest) return

    if (scannedGuest.status === 'Hadir') {
      setScanMessage('Tamu ini sudah check-in. Tidak dapat diproses ulang.')
      setScanMessageType('warning')
      return
    }

    setConfirmLoading(true)
    setScanMessage('')

    const { data, error } = await supabase.rpc(
      'confirm_check_in',
      {
        p_event_id: selectedEvent.id,
        p_invite_token: scannedGuest.invite_token
      }
    )

    if (error) {
      setScanMessage(error.message || 'Check-in gagal disimpan.')
      setScanMessageType('error')
      setConfirmLoading(false)
      return
    }

    if (data?.already_checked_in) {
      const checkedInAt = await getCheckInTimestamp(selectedEvent.id, scannedGuest.id)
      setScannedGuest({
        ...scannedGuest,
        status: 'Hadir',
        checked_in_at: checkedInAt
      })

      setScanMessage('Tamu ini sudah check-in sebelumnya.')
      setScanMessageType('warning')
      setConfirmLoading(false)
      return
    }

    if (!data?.success) {
      setScanMessage('Check-in belum berhasil. Silakan coba lagi.')
      setScanMessageType('error')
      setConfirmLoading(false)
      return
    }

    const checkedInAt = await getCheckInTimestamp(selectedEvent.id, scannedGuest.id)
    setScannedGuest({
      ...scannedGuest,
      status: 'Hadir',
      checked_in_at: checkedInAt
    })

    setScanMessage('Check-in berhasil! Kehadiran tamu telah tersimpan.')
    setScanMessageType('success')
    setConfirmLoading(false)
  }

  
  async function handleManualCheckIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedEvent) return
    if (!manualName.trim() || !manualCategory.trim()) {
      setScanMessage('Nama dan kategori tamu wajib diisi.')
      setScanMessageType('error')
      return
    }

    setManualLoading(true)
    setScanMessage('')
    setScannedGuest(null)

    try {
      const { data, error } = await supabase.rpc('staff_add_guest_manual', {
        p_event_id: selectedEvent.id,
        p_name: manualName.trim(),
        p_institution: manualInstitution.trim() || null,
        p_category: manualCategory.trim(),
        p_guest_group: manualGroup.trim() || null
      })

      if (error) throw error

      const inserted = Array.isArray(data) ? data[0] : data
      if (!inserted?.invite_token) {
        throw new Error('Data tamu tersimpan, tetapi respons server tidak lengkap. Muat ulang daftar tamu untuk memeriksa data.')
      }

      const newGuest = inserted as GuestRecord
      setScannedGuest(newGuest)

      const { data: checkInData, error: checkInError } = await supabase.rpc(
        'confirm_check_in',
        {
          p_event_id: selectedEvent.id,
          p_invite_token: newGuest.invite_token
        }
      )

      if (checkInError) throw checkInError

      if (!checkInData?.success && !checkInData?.already_checked_in) {
        setScanMessage('Tamu berhasil ditambahkan, tetapi check-in belum berhasil. Silakan coba konfirmasi kembali melalui data tamu.')
        setScanMessageType('warning')
      } else {
        const checkedInAt = await getCheckInTimestamp(selectedEvent.id, newGuest.id)
        setScannedGuest({ ...newGuest, status: 'Hadir', checked_in_at: checkedInAt })
        setScanMessage('Tamu berhasil ditambahkan dan langsung tercatat check-in.')
        setScanMessageType('success')
        setManualName('')
        setManualInstitution('')
        setManualGroup('')
      }
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : 'Gagal menambahkan tamu secara manual.')
      setScanMessageType('error')
    } finally {
      setManualLoading(false)
    }
  }

  function resetScan() {
    setScannedGuest(null)
    setScanMessage('')
    setScannerOpen(false)
    setCheckInMode('scan')
  }

  function chooseEvent(event: AssignedEvent) {
    setSelectedEvent(event)
    resetScan()
  }

  return (
    <div className="staff-dashboard">
      <header className="staff-topbar">
        <div className="staff-brand">
          <div className="staff-brand-icon">
            <CalendarCheck size={24} />
          </div>
          <div>
            <strong>EventCheck<span>Rijan</span></strong>
            <small>DASHBOARD PETUGAS</small>
          </div>
        </div>

        <button className="btn-secondary" onClick={onLogout}>
          <LogOut size={15} />
          Keluar
        </button>
      </header>

      <main className="staff-content">
        <section className="staff-welcome">
          <div>
            <span className="staff-eyebrow">PANEL PETUGAS</span>
            <h1>Halo, {fullName}</h1>
            <p>
              Pilih acara tugas Anda untuk memulai proses check-in tamu.
            </p>
          </div>

          <div className="staff-shield">
            <ShieldCheck size={30} />
          </div>
        </section>

        <section className="staff-summary">
          <div className="staff-summary-icon">
            <CalendarDays size={22} />
          </div>
          <div>
            <strong>{events.length}</strong>
            <span>Acara yang ditugaskan kepada Anda</span>
          </div>
        </section>

        <div className="staff-section-heading">
          <div>
            <h2>Acara Tugas Saya</h2>
            <p>Pilih acara untuk membuka scanner QR.</p>
          </div>

          <button
            className="btn-secondary"
            onClick={() => void loadEvents()}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Muat ulang
          </button>
        </div>

        {loading ? (
          <div className="staff-empty">
            <RefreshCw size={25} />
            <strong>Memuat daftar acara...</strong>
          </div>
        ) : error ? (
          <div className="staff-message staff-error">
            {error}
            <button
              className="btn-secondary"
              onClick={() => void loadEvents()}
            >
              Coba lagi
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="staff-empty">
            <CalendarDays size={35} />
            <strong>Belum ada acara yang ditugaskan</strong>
            <span>
              Hubungi Admin untuk mendapatkan penugasan acara.
            </span>
          </div>
        ) : (
          <div className="staff-event-list">
            {events.map(event => (
              <article className="staff-event-card" key={event.id}>
                <div className="staff-event-icon">
                  <CalendarCheck size={23} />
                </div>

                <div className="staff-event-info">
                  <span className={`staff-event-status ${event.status}`}>
                    {event.status === 'active' ? 'SEDANG AKTIF' : 'DRAF'}
                  </span>

                  <h3>{event.name}</h3>

                  <div className="staff-event-meta">
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(event.event_date)}
                    </span>

                    <span>
                      <MapPin size={14} />
                      {event.location || 'Lokasi belum ditentukan'}
                    </span>
                  </div>
                </div>

                <button
                  className="btn-primary staff-select-button"
                  onClick={() => chooseEvent(event)}
                >
                  <ScanLine size={15} />
                  {selectedEvent?.id === event.id ? 'Terpilih' : 'Pilih Acara'}
                </button>
              </article>
            ))}
          </div>
        )}

        {selectedEvent && (
          <section className="staff-selected-event">
            <div className="staff-selected-heading">
              <div>
                <span>ACARA DIPILIH</span>
                <h3>{selectedEvent.name}</h3>
                <p>{formatDate(selectedEvent.event_date)}</p>
              </div>

              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedEvent(null)
                  resetScan()
                }}
              >
                Ganti Acara
              </button>
            </div>

            <div className="staff-checkin-tabs" role="tablist" aria-label="Metode check-in">
              <button
                type="button"
                className={`staff-checkin-tab ${checkInMode === 'scan' ? 'active' : ''}`}
                onClick={() => { resetScan(); setCheckInMode('scan') }}
              >
                <Camera size={17} /> Scan QR
              </button>
              <button
                type="button"
                className={`staff-checkin-tab ${checkInMode === 'manual' ? 'active' : ''}`}
                onClick={() => { resetScan(); setCheckInMode('manual') }}
              >
                <Keyboard size={17} /> Tulis Manual
              </button>
            </div>

            {checkInMode === 'scan' && !scannerOpen && (
              <button
                className="btn-primary staff-open-scanner"
                onClick={() => {
                  resetScan()
                  setCheckInMode('scan')
                  setScannerOpen(true)
                }}
              >
                <Camera size={18} />
                Buka Kamera Scan QR
              </button>
            )}

            {checkInMode === 'manual' && (
              <form className="staff-manual-form" onSubmit={handleManualCheckIn}>
                <div className="staff-manual-heading">
                  <UserPlus size={20} />
                  <div>
                    <h4>Tambah tamu tanpa QR Code</h4>
                    <p>Isi data tamu. Sistem akan menyimpan undangan dan langsung mencatat check-in.</p>
                  </div>
                </div>
                <div className="staff-manual-grid">
                  <label>Nama lengkap *
                    <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nama lengkap tamu" required />
                  </label>
                  <label>Instansi
                    <input value={manualInstitution} onChange={e => setManualInstitution(e.target.value)} placeholder="Instansi / organisasi" />
                  </label>
                  <label>Kategori *
                    <input value={manualCategory} onChange={e => setManualCategory(e.target.value)} placeholder="Contoh: VIP, Reguler, Panitia" required />
                  </label>
                  <label>Kelompok / keterangan
                    <input value={manualGroup} onChange={e => setManualGroup(e.target.value)} placeholder="Opsional" />
                  </label>
                </div>
                <button className="btn-primary staff-confirm-checkin" type="submit" disabled={manualLoading}>
                  <UserPlus size={17} />
                  {manualLoading ? 'Menyimpan dan check-in...' : 'Simpan Tamu & Check-in'}
                </button>
              </form>
            )}

            {checkInMode === 'scan' && scannerOpen && (
              <QrCamera
                onDecoded={handleQrDecoded}
                onClose={() => setScannerOpen(false)}
              />
            )}

            {scanLoading && (
              <div className="staff-empty">
                <RefreshCw size={22} />
                <strong>Memeriksa data undangan...</strong>
              </div>
            )}

            {scanMessage && (
              <div className={`staff-message staff-${scanMessageType}`}>
                {scanMessageType === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                {scanMessage}
              </div>
            )}

            {scannedGuest && (
              <div className="staff-guest-result">
                <div className="staff-guest-result-heading">
                  <div className="staff-guest-avatar">
                    <UserRound size={25} />
                  </div>
                  <div>
                    <span>IDENTITAS TAMU</span>
                    <h3>{scannedGuest.name}</h3>
                  </div>
                </div>

                <div className="staff-guest-details">
                  <div>
                    <span>Instansi</span>
                    <strong>{scannedGuest.institution || '-'}</strong>
                  </div>

                  <div>
                    <span>Kategori</span>
                    <strong>{scannedGuest.category}</strong>
                  </div>

                  <div>
                    <span>Kelompok</span>
                    <strong>{scannedGuest.guest_group || '-'}</strong>
                  </div>

                  <div>
                    <span>Kode Undangan</span>
                    <strong>{scannedGuest.invitation_code}</strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong className={
                      scannedGuest.status === 'Hadir'
                        ? 'staff-status-present'
                        : 'staff-status-pending'
                    }>
                      {scannedGuest.status}
                    </strong>
                  </div>
                  {scannedGuest.status === 'Hadir' && (
                    <div className="staff-checkin-time">
                      <span>Waktu Check-in</span>
                      <strong>{formatCheckInTime(scannedGuest.checked_in_at)}</strong>
                    </div>
                  )}
                </div>

                {scannedGuest.status !== 'Hadir' && (
                  <button
                    className="btn-primary staff-confirm-checkin"
                    onClick={() => void confirmCheckIn()}
                    disabled={confirmLoading}
                  >
                    <CheckCircle2 size={18} />
                    {confirmLoading
                      ? 'Menyimpan Check-in...'
                      : 'Konfirmasi Check-in'}
                  </button>
                )}

                {scannedGuest.status === 'Hadir' && (
                  <div className="staff-already-present">
                    <CheckCircle2 size={18} />
                    Tamu sudah tercatat hadir.
                  </div>
                )}

                <button
                  className="btn-secondary staff-rescan"
                  onClick={resetScan}
                  disabled={confirmLoading}
                >
                  <RotateCcw size={15} />
                  Scan Tamu Berikutnya
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="staff-footer">
          © 2026 EventCheckRijan · Sistem Petugas
        </footer>
      </main>
    </div>
  )
}
