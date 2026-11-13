
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import StaffDashboard from './StaffDashboard'
import {
  CalendarCheck,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ScanLine,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type UserProfile = {
  full_name: string
  role: 'admin' | 'staff'
  is_active: boolean
}

type LoginRole = 'admin' | 'staff'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Halaman undangan publik tidak memerlukan login.
  const isPublicInvitation = window.location.pathname.startsWith('/undangan/')

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return

      if (error) setError(error.message)
      setSession(data.session)
      setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setProfile(null)

      if (!session) {
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, is_active')
        .eq('id', session.user.id)
        .single()

      if (!active) return

      if (error) {
        setError('Profil akun tidak ditemukan atau tidak dapat diakses.')
        setProfile(null)
      } else if (data.is_active !== true) {
        setError('Akun Anda telah dinonaktifkan oleh Admin. Hubungi Admin untuk bantuan.')
        setProfile(null)
        setProfileLoading(false)
        await supabase.auth.signOut({ scope: 'global' })
        return
      } else if (data.role === 'admin' || data.role === 'staff') {
        // Pastikan pilihan login sesuai dengan role akun sebenarnya.
        if (selectedRole && data.role !== selectedRole) {
          setError(
            `Akun ini terdaftar sebagai ${
              data.role === 'admin' ? 'Admin' : 'Petugas'
            }. Silakan pilih jenis login yang sesuai.`
          )

          setProfile(null)
          setProfileLoading(false)
          void supabase.auth.signOut()
          return
        }

        setProfile(data as UserProfile)
        setError('')
      } else {
        setError('Role akun tidak dikenali.')
        setProfile(null)
      }

      setProfileLoading(false)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [session, selectedRole])

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedRole) {
      setError('Silakan pilih Login Admin atau Login Petugas.')
      return
    }

    setError('')
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    if (error) {
      setError('Login gagal. Periksa email dan password akun.')
    }

    setSubmitting(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setProfile(null)
    setPassword('')
    setEmail('')
    setSelectedRole(null)
    setError('')
  }

  function chooseRole(role: LoginRole) {
    setSelectedRole(role)
    setError('')
    setPassword('')
  }

  if (isPublicInvitation) return <>{children}</>

  if (checking || (session && profileLoading)) {
    return (
      <div className="auth-loading">
        <CalendarCheck size={34} />
        <strong>EventCheckRijan</strong>
        <span>Memeriksa sesi akun...</span>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="auth-page">
        <section className="auth-layout">
          <aside className="auth-hero">
            <div className="auth-hero-glow auth-hero-glow-one" />
            <div className="auth-hero-glow auth-hero-glow-two" />
            <div className="auth-hero-brand">
              <span className="auth-hero-brand-icon"><CalendarCheck size={22} /></span>
              <span>EventCheck<span>Rijan</span></span>
            </div>
            <div className="auth-hero-copy">
              <span className="auth-eyebrow">EVENT MANAGEMENT SYSTEM</span>
              <h1>Kelola acara jadi lebih mudah.</h1>
              <p>Satu tempat untuk mengelola acara, memantau tamu, dan memastikan proses check-in berjalan lancar.</p>
            </div>
            <div className="auth-visual" aria-hidden="true">
              <div className="auth-visual-orbit auth-visual-orbit-one" />
              <div className="auth-visual-orbit auth-visual-orbit-two" />
              <div className="auth-visual-card auth-visual-card-main">
                <div className="auth-visual-card-top"><span /><span /><span /></div>
                <div className="auth-visual-calendar"><CalendarCheck size={58} strokeWidth={1.5} /></div>
                <div className="auth-visual-lines"><i /><i /><i /></div>
                <div className="auth-visual-check"><ShieldCheck size={23} /></div>
              </div>
              <div className="auth-visual-float auth-visual-float-top"><ScanLine size={19} /><span>QR Check-in</span><b>Aktif</b></div>
              <div className="auth-visual-float auth-visual-float-bottom"><span className="auth-visual-avatar">ER</span><span><b>Event siap</b><small>Semua terpantau</small></span><ShieldCheck size={19} /></div>
            </div>
            <div className="auth-hero-note"><span className="auth-note-dot" /> Sistem manajemen acara yang praktis dan aman</div>
          </aside>
          <main className="auth-panel">
            <div className="auth-panel-inner">
              <div className="auth-brand">
                <div className="auth-brand-icon"><CalendarCheck size={25} /></div>
                <div><strong>EventCheck<span>Rijan</span></strong><small>EVENT MANAGEMENT SYSTEM</small></div>
              </div>
              <div className="auth-heading">
                <span>SELAMAT DATANG KEMBALI</span>
                <h2>Masuk ke akun Anda</h2>
                <p>Pilih jenis akses, lalu masukkan email dan password untuk melanjutkan.</p>
              </div>
              <div className="auth-role-label">Pilih jenis akun</div>
              <div className="auth-role-options">
                <button type="button" className={`auth-role-card ${selectedRole === 'admin' ? 'selected' : ''}`} aria-pressed={selectedRole === 'admin'} onClick={() => chooseRole('admin')}>
                  <span className="auth-role-icon admin"><ShieldCheck size={21} /></span>
                  <span className="auth-role-copy"><strong>Admin</strong><small>Kelola seluruh acara</small></span>
                  <span className="auth-role-radio" />
                </button>
                <button type="button" className={`auth-role-card ${selectedRole === 'staff' ? 'selected' : ''}`} aria-pressed={selectedRole === 'staff'} onClick={() => chooseRole('staff')}>
                  <span className="auth-role-icon staff"><ScanLine size={21} /></span>
                  <span className="auth-role-copy"><strong>Petugas</strong><small>Scan QR dan check-in</small></span>
                  <span className="auth-role-radio" />
                </button>
              </div>
              {selectedRole ? (
                <form className="auth-form" onSubmit={handleLogin}>
                  <div className="auth-form-caption">Login {selectedRole === 'admin' ? 'Admin' : 'Petugas'}</div>
                  <label className="auth-label" htmlFor="login-email">Email</label>
                  <div className="auth-input-wrap"><Mail size={18} /><input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="username" required /></div>
                  <label className="auth-label" htmlFor="login-password">Password</label>
                  <div className="auth-input-wrap"><LockKeyhole size={18} /><input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" autoComplete="current-password" required /></div>
                  {error && <div className="auth-error" role="alert">{error}</div>}
                  <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Memproses...' : `Login sebagai ${selectedRole === 'admin' ? 'Admin' : 'Petugas'}`}</button>
                </form>
              ) : (
                <div className="auth-select-hint"><ShieldCheck size={17} /> Pilih Admin atau Petugas untuk menampilkan form login.</div>
              )}
              {!selectedRole && error && <div className="auth-error" role="alert">{error}</div>}
              <div className="auth-security"><ShieldCheck size={16} /><span>Akses terlindungi dengan autentikasi akun.</span></div>
            </div>
            <p className="auth-footer">© 2026 EventCheckRijan</p>
          </main>
        </section>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="auth-loading">
        <LockKeyhole size={32} />
        <strong>Akses belum tersedia</strong>
        <span>{error || 'Profil akun belum dapat diverifikasi.'}</span>
        <button className="auth-submit auth-logout" onClick={handleLogout}>
          Keluar
        </button>
      </div>
    )
  }

  if (profile.role === 'staff') {
    return (
      <StaffDashboard
        userId={session.user.id}
        fullName={profile.full_name}
        onLogout={() => {
          void handleLogout()
        }}
      />
    )
  }

  return <>{children}</>
}
