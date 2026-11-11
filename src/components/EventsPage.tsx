
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  MapPin,
  Plus,
  RefreshCw,
  CheckCircle2,
  Power,
  Archive
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type EventItem = {
  id: string
  name: string
  description: string | null
  event_date: string | null
  location: string | null
  status: 'draft' | 'active' | 'archived'
  created_at: string
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('events')
      .select('id, name, description, event_date, location, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setError(`Gagal mengambil data acara: ${error.message}`)
      setEvents([])
    } else {
      setEvents((data || []) as EventItem[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  async function handleCreateEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!name.trim()) {
      setError('Nama acara wajib diisi.')
      return
    }

    setSaving(true)

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setError('Sesi akun tidak ditemukan. Silakan login kembali.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase
      .from('events')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        event_date: eventDate || null,
        location: location.trim() || null,
        status: 'draft',
        created_by: userData.user.id
      })

    if (insertError) {
      setError(`Acara gagal disimpan: ${insertError.message}`)
      setSaving(false)
      return
    }

    setName('')
    setDescription('')
    setEventDate('')
    setLocation('')
    setShowForm(false)
    setSuccess('Acara baru berhasil dibuat.')

    await loadEvents()
    setSaving(false)
  }

  async function handleActivateEvent(event: EventItem) {
    if (event.status === 'active' || event.status === 'archived') return

    const currentActive = events.find(item => item.status === 'active')

    const confirmation = currentActive
      ? `Aktifkan "${event.name}"?\n\nEvent "${currentActive.name}" akan kembali menjadi Draft.`
      : `Aktifkan event "${event.name}"?`

    if (!window.confirm(confirmation)) return

    setError('')
    setSuccess('')
    setActivatingId(event.id)

    const { error: activateError } = await supabase.rpc(
      'activate_event',
      { p_event_id: event.id }
    )

    if (activateError) {
      setError(`Gagal mengaktifkan acara: ${activateError.message}`)
    } else {
      setSuccess(`Event "${event.name}" sekarang aktif.`)
      await loadEvents()
    }

    setActivatingId(null)
  }

  function statusLabel(status: EventItem['status']) {
    if (status === 'active') return 'Aktif'
    if (status === 'archived') return 'Diarsipkan'
    return 'Draft'
  }

  return (
    <section className="events-page">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Manajemen Event</h3>
            <p>Kelola seluruh acara dalam satu aplikasi.</p>
          </div>

          <div className="events-actions">
            <button
              className="btn-secondary"
              onClick={() => void loadEvents()}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Muat ulang
            </button>

            <button
              className="btn-primary"
              onClick={() => {
                setError('')
                setSuccess('')
                setShowForm(!showForm)
              }}
            >
              <Plus size={16} />
              Buat event
            </button>
          </div>
        </div>

        {error && <div className="events-message events-error">{error}</div>}
        {success && <div className="events-message events-success">{success}</div>}

        {showForm && (
          <form className="event-form" onSubmit={handleCreateEvent}>
            <h3>Buat acara baru</h3>

            <label className="form-label">Nama acara *</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Wisuda ke-4"
              required
            />

            <label className="form-label">Deskripsi acara</label>
            <textarea
              className="form-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Keterangan singkat acara"
              rows={3}
            />

            <label className="form-label">Tanggal acara</label>
            <input
              className="form-input"
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />

            <label className="form-label">Lokasi acara</label>
            <input
              className="form-input"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Contoh: Aula Pondok Pesantren"
            />

            <p className="event-form-note">
              Acara baru akan dibuat dengan status Draft.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Batal
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !name.trim()}
              >
                {saving ? 'Menyimpan...' : 'Simpan acara'}
              </button>
            </div>
          </form>
        )}

        <div className="events-list">
          {loading ? (
            <p className="events-empty">Memuat data acara...</p>
          ) : events.length === 0 ? (
            <div className="events-empty">
              <CalendarDays size={30} />
              <strong>Belum ada acara</strong>
              <span>Buat acara pertama untuk mulai menggunakan EventCheckRijan.</span>
            </div>
          ) : (
            events.map(event => (
              <article className="event-item" key={event.id}>
                <div className="event-item-icon">
                  <CalendarDays size={22} />
                </div>

                <div className="event-item-info">
                  <strong>{event.name}</strong>

                  {event.description && <p>{event.description}</p>}

                  <div className="event-item-meta">
                    <span>
                      <CalendarDays size={14} />
                      {event.event_date
                        ? new Date(`${event.event_date}T00:00:00`).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : 'Tanggal belum ditentukan'}
                    </span>

                    <span>
                      <MapPin size={14} />
                      {event.location || 'Lokasi belum ditentukan'}
                    </span>
                  </div>
                </div>

                <div className="event-item-controls">
                  <span className={`event-status status-${event.status}`}>
                    {statusLabel(event.status)}
                  </span>

                  {event.status === 'draft' && (
                    <button
                      className="btn-primary event-activate-btn"
                      onClick={() => void handleActivateEvent(event)}
                      disabled={activatingId !== null}
                    >
                      <Power size={14} />
                      {activatingId === event.id ? 'Mengaktifkan...' : 'Aktifkan Event'}
                    </button>
                  )}

                  {event.status === 'active' && (
                    <span className="event-active-label">
                      <CheckCircle2 size={15} />
                      Sedang dikelola
                    </span>
                  )}

                  {event.status === 'archived' && (
                    <span className="event-archived-label">
                      <Archive size={14} />
                      Arsip
                    </span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
