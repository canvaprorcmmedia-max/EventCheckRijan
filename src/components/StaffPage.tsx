import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  UserPlus, Users, RefreshCw, ShieldCheck, CalendarDays,
  Eye, Trash2, UserX, KeyRound, X, Mail, CheckCircle2,
  AlertCircle, UserRound, CalendarCheck
} from 'lucide-react'

type EventOption = { id: string; name: string; status: string }
type StaffAssignment = {
  id: string
  event_id: string
  created_at: string
  event_name: string | null
  event_status: string | null
}
type StaffMember = {
  id: string
  full_name: string
  email: string
  is_active: boolean
  assignments: StaffAssignment[]
}
const STAFF_DRAFT_STORAGE_KEY = 'eventcheckrijan:staff-create-draft'

type StaffDraft = {
  fullName: string
  email: string
  eventId: string
}

function getSavedStaffDraft(): StaffDraft {
  const emptyDraft: StaffDraft = {
    fullName: '',
    email: '',
    eventId: ''
  }

  try {
    const saved = localStorage.getItem(STAFF_DRAFT_STORAGE_KEY)

    if (!saved) return emptyDraft

    const parsed = JSON.parse(saved) as Partial<StaffDraft>

    return {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      eventId: typeof parsed.eventId === 'string' ? parsed.eventId : ''
    }
  } catch {
    return emptyDraft
  }
}
export default function StaffPage() {
  const [events, setEvents] = useState<EventOption[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<StaffMember | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<StaffMember | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState<StaffMember | null>(null)

  const [fullName, setFullName] = useState(() => getSavedStaffDraft().fullName)
  const [email, setEmail] = useState(() => getSavedStaffDraft().email)
  const [password, setPassword] = useState('')
  const [eventId, setEventId] = useState(() => getSavedStaffDraft().eventId)

  async function manageStaff(payload: Record<string, string>) {
    const { data, error: functionError } = await supabase.functions.invoke('manage-staff', { body: payload })
    if (functionError) throw new Error(functionError.message || 'Gagal menghubungi server.')
    if (!data?.success) throw new Error(data?.message || 'Permintaan tidak berhasil.')
    return data
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [eventResult, staffResult] = await Promise.all([
        supabase.from('events').select('id,name,status').order('created_at', { ascending: false }),
        manageStaff({ action: 'list' })
      ])
      if (eventResult.error) throw eventResult.error
      setEvents((eventResult.data ?? []) as EventOption[])
      setStaff((staffResult.staff ?? []) as StaffMember[])
      if (selected) {
        const refreshed = (staffResult.staff ?? []).find((item: StaffMember) => item.id === selected.id)
        setSelected(refreshed ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data petugas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])
  useEffect(() => {
  const draft: StaffDraft = {
    fullName,
    email,
    eventId
  }

  try {
    const isEmpty =
      !fullName.trim() &&
      !email.trim() &&
      !eventId

    if (isEmpty) {
      localStorage.removeItem(STAFF_DRAFT_STORAGE_KEY)
    } else {
      localStorage.setItem(
        STAFF_DRAFT_STORAGE_KEY,
        JSON.stringify(draft)
      )
    }
  } catch (err) {
    console.warn('Gagal menyimpan draft petugas:', err)
  }
 }, [fullName, email, eventId])
  async function createStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password || !eventId) {
      setError('Semua kolom wajib diisi.')
      return
    }
    setSaving(true); setError(''); setNotice('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-staff', {
        body: { full_name: fullName.trim(), email: email.trim().toLowerCase(), password, event_id: eventId }
      })
      if (fnError) throw new Error(fnError.message || 'Gagal menghubungi server.')
      if (!data?.success) throw new Error(data?.message || 'Gagal membuat akun petugas.')
      setNotice(`Akun ${data.staff.full_name} berhasil dibuat dan ditugaskan ke ${data.event.name}.`)
      setFullName(''); setEmail(''); setPassword(''); setEventId('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat akun.')
    } finally { setSaving(false) }
  }

  async function removeAssignment(member: StaffMember, assignment: StaffAssignment) {
    const label = `remove:${assignment.id}`
    if (!window.confirm(`Hapus penugasan ${member.full_name} dari acara "${assignment.event_name || 'ini'}"? Akun petugas tetap aktif.`)) return
    setBusyAction(label); setError(''); setNotice('')
    try {
      const result = await manageStaff({ action: 'remove_assignment', staff_id: member.id, assignment_id: assignment.id })
      setNotice(result.message)
      await loadData()
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menghapus penugasan.') }
    finally { setBusyAction('') }
  }

  async function deactivateStaff() {
    if (!confirmDeactivate) return
    setBusyAction(`deactivate:${confirmDeactivate.id}`); setError(''); setNotice('')
    try {
      const result = await manageStaff({ action: 'deactivate', staff_id: confirmDeactivate.id })
      setNotice(result.message)
      setConfirmDeactivate(null)
      setSelected(null)
      await loadData()
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menonaktifkan akun.') }
    finally { setBusyAction('') }
  }

  async function resetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!passwordTarget) return
    if (newPassword.length < 8) { setError('Password baru minimal 8 karakter.'); return }
    if (newPassword !== confirmPassword) { setError('Konfirmasi password tidak sama.'); return }
    setBusyAction(`password:${passwordTarget.id}`); setError(''); setNotice('')
    try {
      const result = await manageStaff({ action: 'reset_password', staff_id: passwordTarget.id, password: newPassword })
      setNotice(result.message)
      setPasswordTarget(null); setNewPassword(''); setConfirmPassword('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal mengatur ulang password.') }
    finally { setBusyAction('') }
  }

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return staff
    return staff.filter(item => `${item.full_name} ${item.email}`.toLowerCase().includes(term))
  }, [staff, search])
  const activeCount = staff.filter(item => item.is_active).length
  const assignmentCount = staff.reduce((sum, item) => sum + item.assignments.length, 0)

  return (
    <div className="staff-page">
      <div className="stats-grid">
        <div className="panel"><div className="panel-heading"><div><p>Total akun petugas</p><h2>{staff.length}</h2></div><Users size={24} /></div></div>
        <div className="panel"><div className="panel-heading"><div><p>Akun aktif</p><h2>{activeCount}</h2></div><ShieldCheck size={24} /></div></div>
        <div className="panel"><div className="panel-heading"><div><p>Total penugasan</p><h2>{assignmentCount}</h2></div><CalendarDays size={24} /></div></div>
      </div>

      {notice && <div className="staff-admin-alert success"><CheckCircle2 size={18} />{notice}</div>}
      {error && <div className="staff-admin-alert error"><AlertCircle size={18} />{error}<button type="button" onClick={() => setError('')} aria-label="Tutup pesan"><X size={15} /></button></div>}

      <section className="panel">
        <div className="panel-heading"><div><h3>Tambah akun petugas</h3><p>Buat akun login dan hubungkan petugas dengan acara.</p></div><UserPlus size={22} /></div>
        <form onSubmit={createStaff}>
          <label className="form-label">Nama lengkap</label>
          <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama petugas" required />
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="petugas@email.com" required />
          <label className="form-label">Password awal</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 8 karakter" minLength={8} required />
          <label className="form-label">Tugaskan ke acara</label>
          <select className="form-input" value={eventId} onChange={e => setEventId(e.target.value)} required>
            <option value="">Pilih acara</option>
            {events.filter(event => event.status !== 'archived').map(event => <option key={event.id} value={event.id}>{event.name} ({event.status})</option>)}
          </select>
          <div className="modal-actions"><button className="btn-primary" type="submit" disabled={saving || events.every(event => event.status === 'archived')}>
            {saving ? <><RefreshCw size={16} /> Membuat akun...</> : <><UserPlus size={16} /> Buat akun petugas</>}
          </button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading staff-admin-list-heading">
          <div><h3>Daftar akun petugas</h3><p>Lihat detail, kelola penugasan, dan status akun petugas.</p></div>
          <button className="btn-secondary" onClick={() => void loadData()} disabled={loading}><RefreshCw size={16} /> Perbarui</button>
        </div>
        <input className="form-input staff-admin-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau email petugas..." />
        {loading ? <div className="empty-state">Memuat data petugas...</div> : filteredStaff.length === 0 ? <div className="empty-state">{staff.length ? 'Petugas tidak ditemukan.' : 'Belum ada akun petugas.'}</div> : (
          <div className="table-wrap"><table><thead><tr><th>NAMA PETUGAS</th><th>EMAIL</th><th>STATUS</th><th>PENUGASAN</th><th>AKSI</th></tr></thead>
            <tbody>{filteredStaff.map(member => <tr key={member.id}>
              <td><div className="table-person"><div className="guest-avatar">{member.full_name.slice(0,1).toUpperCase()}</div><strong>{member.full_name}</strong></div></td>
              <td>{member.email}</td>
              <td><span className={`staff-admin-status ${member.is_active ? 'active' : 'inactive'}`}>{member.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
              <td>{member.assignments.length} acara</td>
              <td><div className="staff-admin-actions">
                <button className="btn-secondary" type="button" title="Detail petugas" onClick={() => setSelected(member)}><Eye size={15} /> Detail</button>
                {member.is_active && <button className="btn-secondary" type="button" title="Atur ulang sandi" onClick={() => { setPasswordTarget(member); setError('') }}><KeyRound size={15} /> Sandi</button>}
                {member.is_active && <button className="btn-danger" type="button" title="Nonaktifkan akun" onClick={() => setConfirmDeactivate(member)}><UserX size={15} /> Nonaktifkan</button>}
              </div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>

      {selected && <div className="staff-admin-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null) }}>
        <section className="staff-admin-modal" role="dialog" aria-modal="true" aria-labelledby="staff-detail-title">
          <div className="staff-admin-modal-head"><div><span>DETAIL PETUGAS</span><h3 id="staff-detail-title">{selected.full_name}</h3></div><button type="button" className="staff-admin-icon-button" onClick={() => setSelected(null)}><X size={19} /></button></div>
          <div className="staff-admin-profile"><div className="staff-admin-large-avatar"><UserRound size={27} /></div><div><strong>{selected.full_name}</strong><span><Mail size={14} /> {selected.email}</span><span className={`staff-admin-status ${selected.is_active ? 'active' : 'inactive'}`}>{selected.is_active ? 'Akun aktif' : 'Akun nonaktif'}</span></div></div>
          <div className="staff-admin-assignment-title"><h4>Penugasan acara</h4><span>{selected.assignments.length} acara</span></div>
          {selected.assignments.length === 0 ? <p className="staff-admin-no-assignment">Belum ada penugasan acara.</p> : <div className="staff-admin-assignment-list">{selected.assignments.map(assignment => <div className="staff-admin-assignment" key={assignment.id}>
            <div><strong><CalendarCheck size={15} /> {assignment.event_name || 'Acara tidak tersedia'}</strong><small>Ditugaskan {new Date(assignment.created_at).toLocaleDateString('id-ID')}</small></div>
            {selected.is_active && <button className="btn-danger" type="button" disabled={busyAction === `remove:${assignment.id}`} onClick={() => void removeAssignment(selected, assignment)}><Trash2 size={14} /> Hapus</button>}
          </div>)}</div>}
          <div className="staff-admin-modal-foot"><button className="btn-secondary" type="button" onClick={() => setSelected(null)}>Tutup</button>{selected.is_active && <button className="btn-danger" type="button" onClick={() => { setConfirmDeactivate(selected); setSelected(null) }}><UserX size={15} /> Nonaktifkan akun</button>}</div>
        </section>
      </div>}

      {passwordTarget && <div className="staff-admin-overlay"><section className="staff-admin-modal" role="dialog" aria-modal="true" aria-labelledby="staff-password-title">
        <div className="staff-admin-modal-head"><div><span>KEAMANAN AKUN</span><h3 id="staff-password-title">Atur ulang password</h3><p>{passwordTarget.full_name} · {passwordTarget.email}</p></div><button type="button" className="staff-admin-icon-button" onClick={() => setPasswordTarget(null)}><X size={19} /></button></div>
        <form onSubmit={resetPassword}><label className="form-label">Password baru</label><input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
          <label className="form-label">Konfirmasi password baru</label><input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
          <p className="staff-admin-note">Password baru tidak akan ditampilkan kembali setelah disimpan.</p>
          <div className="staff-admin-modal-foot"><button className="btn-secondary" type="button" onClick={() => setPasswordTarget(null)}>Batal</button><button className="btn-primary" type="submit" disabled={busyAction === `password:${passwordTarget.id}`}>{busyAction === `password:${passwordTarget.id}` ? 'Menyimpan...' : <><KeyRound size={15} /> Simpan password</>}</button></div>
        </form>
      </section></div>}

      {confirmDeactivate && <div className="staff-admin-overlay"><section className="staff-admin-modal" role="alertdialog" aria-modal="true" aria-labelledby="staff-deactivate-title">
        <div className="staff-admin-modal-head"><div><span>KONFIRMASI TINDAKAN</span><h3 id="staff-deactivate-title">Nonaktifkan akun petugas?</h3></div><button type="button" className="staff-admin-icon-button" onClick={() => setConfirmDeactivate(null)}><X size={19} /></button></div>
        <p>Anda akan menonaktifkan akun <strong>{confirmDeactivate.full_name}</strong>. Petugas tidak dapat login lagi dan semua penugasannya akan dihapus.</p>
        <p className="staff-admin-note">Profil akun dan seluruh riwayat check-in tetap tersimpan. Tindakan ini tidak menghapus data tamu.</p>
        <div className="staff-admin-modal-foot"><button className="btn-secondary" type="button" onClick={() => setConfirmDeactivate(null)}>Batal</button><button className="btn-danger" type="button" disabled={busyAction === `deactivate:${confirmDeactivate.id}`} onClick={() => void deactivateStaff()}>{busyAction === `deactivate:${confirmDeactivate.id}` ? 'Memproses...' : <><UserX size={15} /> Ya, nonaktifkan</>}</button></div>
      </section></div>}
    </div>
  )
}
