
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import StaffDashboard from './StaffDashboard'
import {
  CalendarCheck,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ScanLine,
  ArrowLeft
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type UserProfile = {
  full_name: string
  role: 'admin' | 'staff'
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
        .select('full_name, role')
        .eq('id', session.user.id)
        .single()

      if (!active) return

      if (error) {
        setError('Profil akun tidak ditemukan atau tidak dapat diakses.')
        setProfile(null)
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
        <section className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <CalendarCheck size={27} />
            </div>
            <div>
              <strong>EventCheck<span>Rijan</span></strong>
              <small>EVENT MANAGEMENT SYSTEM</small>
            </div>
          </div>

          {!selectedRole ? (
            <>
              <div className="auth-heading">
                <span>SELAMAT DATANG</span>
                <h1>Pilih akses masuk</h1>
                <p>
                  Silakan pilih jenis akun untuk melanjutkan ke EventCheckRijan.
                </p>
              </div>

              <div className="auth-role-options">
                <button
                  type="button"
                  className="auth-role-card"
                  onClick={() => chooseRole('admin')}
                >
                  <span className="auth-role-icon admin">
                    <ShieldCheck size={27} />
                  </span>
                  <strong>Login Admin</strong>
                  <small>
                    Kelola acara, data tamu, petugas, dan laporan.
                  </small>
                  <span className="auth-role-action">Masuk sebagai Admin →</span>
                </button>

                <button
                  type="button"
                  className="auth-role-card"
                  onClick={() => chooseRole('staff')}
                >
                  <span className="auth-role-icon staff">
                    <ScanLine size={27} />
                  </span>
                  <strong>Login Petugas</strong>
                  <small>
                    Scan QR undangan dan konfirmasi kehadiran tamu.
                  </small>
                  <span className="auth-role-action">Masuk sebagai Petugas →</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="auth-back"
                onClick={() => {
                  setSelectedRole(null)
                  setError('')
                  setPassword('')
                }}
              >
                <ArrowLeft size={16} />
                Kembali pilih akses
              </button>

              <div className="auth-heading">
                <span>LOGIN {selectedRole === 'admin' ? 'ADMIN' : 'PETUGAS'}</span>
                <h1>Masuk ke akun Anda</h1>
                <p>
                  Gunakan email dan password akun{' '}
                  {selectedRole === 'admin' ? 'Admin' : 'Petugas'} yang terdaftar.
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <label className="auth-label" htmlFor="login-email">
                  Email
                </label>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="username"
                    required
                  />
                </div>

                <label className="auth-label" htmlFor="login-password">
                  Password
                </label>
                <div className="auth-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && <div className="auth-error">{error}</div>}

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Memproses...' : `Masuk sebagai ${selectedRole === 'admin' ? 'Admin' : 'Petugas'}`}
                </button>
              </form>
            </>
          )}

          <div className="auth-security">
            <ShieldCheck size={16} />
            <span>Akses terlindungi dengan autentikasi akun.</span>
          </div>
        </section>

        <p className="auth-footer">© 2026 EventCheckRijan</p>
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
