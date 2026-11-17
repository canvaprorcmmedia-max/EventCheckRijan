import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  CalendarDays,
  MapPin,
  Search,
  ShieldCheck,
  Download,
  RefreshCw,
  Ticket,
  Building2,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type PortalBranding = {
  organization_name: string
  official_logo_url: string | null
  color_primary: string
  color_secondary: string
  color_accent: string
  color_background: string
  color_surface: string
  color_text: string
  event_logos: Array<{ display_name: string; logo_url: string }>
}

type LookupResponse = {
  success: true
  event: {
    name: string
    description: string | null
    event_date: string | null
    location: string | null
    branding: PortalBranding
  }
  guest: {
    name: string
    institution: string | null
    category: string
    guest_group: string | null
    invitation_code: string
    invite_token: string
    status: string
  }
}

function getPortalSlug(): string {
  const segment = window.location.pathname.split('/')[2] || ''
  try {
    return decodeURIComponent(segment)
  } catch {
    return ''
  }
}

function formatEventDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function PortalPage() {
  const slug = useMemo(getPortalSlug, [])
  const [code, setCode] = useState('')
  const [result, setResult] = useState<LookupResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function lookupInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)

    const normalizedCode = code.trim().toUpperCase()
    if (!slug || !normalizedCode) {
      setError('Masukkan kode undangan Anda terlebih dahulu.')
      return
    }

    setLoading(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'lookup-invitation',
        { body: { slug, code: normalizedCode } },
      )

      if (invokeError) {
        let message = 'Pencarian undangan belum berhasil. Silakan coba kembali.'
        const context = (invokeError as { context?: unknown }).context
        if (context instanceof Response) {
          try {
            const payload = await context.clone().json()
            if (typeof payload?.message === 'string') message = payload.message
          } catch {
            // Gunakan pesan umum jika respons tidak berupa JSON.
          }
        }
        throw new Error(message)
      }

      if (!data?.success || !data?.guest || !data?.event) {
        throw new Error(data?.message || 'Kode undangan tidak ditemukan.')
      }

      setResult(data as LookupResponse)
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : 'Terjadi kendala saat mencari undangan.',
      )
    } finally {
      setLoading(false)
    }
  }

  function downloadQr() {
    const svg = document.getElementById('portal-invite-qr')
    if (!(svg instanceof SVGSVGElement)) {
      setError('QR belum siap diunduh. Silakan coba kembali.')
      return
    }

    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', '320')
    clone.setAttribute('height', '320')
    const source = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `QR-Undangan-${result?.guest.invitation_code || 'EventCheckRijan'}.svg`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const branding = result?.event.branding
  const qrUrl = result
    ? `${window.location.origin}/undangan/${result.guest.invite_token}`
    : ''

  return (
    <main
      className="portal-page"
      style={{
        '--portal-primary': branding?.color_primary || '#2459c5',
        '--portal-secondary': branding?.color_secondary || '#3978df',
        '--portal-accent': branding?.color_accent || '#20a36f',
        '--portal-background': branding?.color_background || '#f2f5fa',
        '--portal-surface': branding?.color_surface || '#ffffff',
        '--portal-text': branding?.color_text || '#172b4d',
      } as React.CSSProperties}
    >
      <div className="portal-wrap">
        <header className="portal-header">
          <div className="portal-official-brand">
            {branding?.official_logo_url ? (
              <img src={branding.official_logo_url} alt={branding.organization_name || 'Logo resmi lembaga'} />
            ) : (
              <span className="portal-brand-fallback"><ShieldCheck size={22} /></span>
            )}
            <span>
              <strong>{branding?.organization_name || 'Riyadlul Jannah'}</strong>
              <small>PORTAL UNDANGAN DIGITAL</small>
            </span>
          </div>
          {branding?.event_logos?.length ? (
            <div className="portal-event-logos" aria-label="Logo pendukung acara">
              {branding.event_logos.map((logo, index) => (
                <img key={`${logo.logo_url}-${index}`} src={logo.logo_url} alt={logo.display_name} />
              ))}
            </div>
          ) : null}
        </header>

        <section className="portal-main-card">
          <div className="portal-heading">
            <span className="portal-kicker">UNDANGAN RESMI</span>
            <h1>Temukan Undangan Anda</h1>
            <p>Masukkan kode undangan yang tercantum pada undangan yang Anda terima.</p>
          </div>

          <form className="portal-search-form" onSubmit={lookupInvitation}>
            <label htmlFor="portal-invitation-code">Kode Undangan</label>
            <div className="portal-input-wrap">
              <Ticket size={19} />
              <input
                id="portal-invitation-code"
                type="text"
                value={code}
                onChange={event => setCode(event.target.value.toUpperCase())}
                placeholder="Contoh: ER-XXXXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                required
              />
            </div>
            <button className="portal-submit" type="submit" disabled={loading}>
              {loading ? <RefreshCw size={18} className="portal-spin" /> : <Search size={18} />}
              {loading ? 'Mencari undangan...' : 'Cari Undangan'}
            </button>
          </form>

          {error ? (
            <div className="portal-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          {result ? (
            <section className="portal-result" aria-live="polite">
              <div className="portal-result-heading">
                <span className="portal-result-check"><ShieldCheck size={19} /></span>
                <div>
                  <span>UNDANGAN DITEMUKAN</span>
                  <h2>{result.event.name}</h2>
                </div>
              </div>

              {result.event.description ? (
                <p className="portal-event-description">{result.event.description}</p>
              ) : null}

              <div className="portal-event-meta">
                {formatEventDate(result.event.event_date) ? (
                  <span><CalendarDays size={16} />{formatEventDate(result.event.event_date)}</span>
                ) : null}
                {result.event.location ? (
                  <span><MapPin size={16} />{result.event.location}</span>
                ) : null}
              </div>

              <div className="portal-guest-card">
                <span className="portal-guest-label">UNDANGAN DITUJUKAN KEPADA</span>
                <h3>{result.guest.name}</h3>
                {result.guest.institution ? (
                  <p><Building2 size={15} />{result.guest.institution}</p>
                ) : null}
                <div className="portal-guest-tags">
                  <span>{result.guest.category}</span>
                  {result.guest.guest_group ? <span>{result.guest.guest_group}</span> : null}
                </div>
                <div className="portal-code-display">
                  <small>KODE UNDANGAN</small>
                  <strong>{result.guest.invitation_code}</strong>
                </div>
              </div>

              <div className="portal-qr-section">
                <h3>QR Code Undangan</h3>
                <p>Tunjukkan QR ini kepada petugas saat registrasi.</p>
                <div className="portal-qr-frame">
                  <QRCodeSVG id="portal-invite-qr" value={qrUrl} size={220} level="H" includeMargin />
                </div>
                <button type="button" className="portal-download" onClick={downloadQr}>
                  <Download size={17} /> Unduh QR Undangan
                </button>
                <p className="portal-private-note">
                  QR ini bersifat pribadi. Jangan membagikan QR atau tautan undangan kepada orang lain.
                </p>
              </div>
            </section>
          ) : null}
        </section>

        <footer className="portal-footer">
          <span>© {new Date().getFullYear()} EventCheckRijan</span>
          <span>Portal Undangan Digital</span>
        </footer>
      </div>
    </main>
  )
}
