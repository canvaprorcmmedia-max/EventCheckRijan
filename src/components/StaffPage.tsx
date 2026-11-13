
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  UserPlus,
  Users,
  RefreshCw,
  ShieldCheck,
  CalendarDays
} from 'lucide-react'

type EventOption = {
  id: string
  name: string
  status: string
}

type StaffAssignment = {
  id: string
  staff_id: string
  event_id: string
  created_at: string
  profiles: {
    full_name: string
    role: string
  } | null
  events: {
    name: string
    status: string
  } | null
}

export default function StaffPage() {
  const [events, setEvents] = useState<EventOption[]>([])
  const [staff, setStaff] = useState<StaffAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [eventId, setEventId] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [eventResult, staffResult] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, status')
          .order('created_at', { ascending: false }),

        supabase
          .from('event_staff')
          .select(`
            id,
            staff_id,
            event_id,
            created_at,
            profiles:profiles!event_staff_staff_id_fkey (
              full_name,
              role
            ),
            events:events!event_staff_event_id_fkey (
              name,
              status
            )
          `)
          .order('created_at', { ascending: false })
      ])

      if (eventResult.error) {
        throw eventResult.error
      }

      setEvents((eventResult.data || []) as EventOption[])

      if (staffResult.error) {
        throw staffResult.error
      }

      setStaff(
        (staffResult.data || []) as unknown as StaffAssignment[]
      )
    } catch (err) {
      console.error('Gagal memuat data petugas:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data petugas.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function createStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!fullName.trim() || !email.trim() || !password || !eventId) {
      setError('Semua kolom wajib diisi.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke('create-staff', {
          body: {
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
            event_id: eventId
          }
        })

      if (functionError) {
        throw new Error(
          functionError.message || 'Gagal menghubungi server.'
        )
      }

      if (!data?.success) {
        throw new Error(
          data?.message || 'Gagal membuat akun petugas.'
        )
      }

      setNotice(
        `Akun ${data.staff.full_name} berhasil dibuat dan ditugaskan ke ${data.event.name}.`
      )

      setFullName('')
      setEmail('')
      setPassword('')
      setEventId('')

      await loadData()
    } catch (err) {
      console.error('Gagal membuat petugas:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat membuat akun.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="staff-page">
      <div className="stats-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Total penugasan</p>
              <h2>{staff.length}</h2>
            </div>
            <Users size={24} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p>Acara tersedia</p>
              <h2>{events.length}</h2>
            </div>
            <CalendarDays size={24} />
          </div>
        </div>
      </div>

      {notice && (
        <div className="panel">
          <p>{notice}</p>
        </div>
      )}

      {error && (
        <div className="panel">
          <p>{error}</p>
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Tambah akun petugas</h3>
            <p>Buat akun login dan hubungkan petugas dengan acara.</p>
          </div>
          <UserPlus size={22} />
        </div>

        <form onSubmit={createStaff}>
          <label className="form-label">Nama lengkap</label>
          <input
            className="form-input"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Nama petugas"
            required
          />

          <label className="form-label">Email</label>
          <input
            className="form-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="petugas@email.com"
            required
          />

          <label className="form-label">Password awal</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
            minLength={8}
            required
          />

          <label className="form-label">Tugaskan ke acara</label>
          <select
            className="form-input"
            value={eventId}
            onChange={e => setEventId(e.target.value)}
            required
          >
            <option value="">Pilih acara</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.name} ({event.status})
              </option>
            ))}
          </select>

          <div className="modal-actions">
            <button
              className="btn-primary"
              type="submit"
              disabled={saving || events.length === 0}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} /> Membuat akun...
                </>
              ) : (
                <>
                  <UserPlus size={16} /> Buat akun petugas
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Daftar penugasan petugas</h3>
            <p>Petugas yang telah dihubungkan dengan acara.</p>
          </div>

          <button
            className="btn-secondary"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw size={16} /> Perbarui
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            Memuat data petugas...
          </div>
        ) : staff.length === 0 ? (
          <div className="empty-state">
            Belum ada petugas yang ditugaskan.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>NAMA PETUGAS</th>
                  <th>ACARA</th>
                  <th>PERAN</th>
                  <th>TANGGAL DITUGASKAN</th>
                </tr>
              </thead>

              <tbody>
                {staff.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-person">
                        <div className="guest-avatar">
                          {(item.profiles?.full_name || 'P')
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                        <strong>
                          {item.profiles?.full_name || 'Nama tidak tersedia'}
                        </strong>
                      </div>
                    </td>

                    <td>
                      {item.events?.name || 'Acara tidak tersedia'}
                    </td>

                    <td>
                      <span className="category-badge regular">
                        <ShieldCheck size={12} /> Petugas
                      </span>
                    </td>

                    <td>
                      {new Date(item.created_at).toLocaleDateString(
                        'id-ID',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
