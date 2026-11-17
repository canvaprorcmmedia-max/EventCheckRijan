import { supabase } from './supabase'
import type { Guest, GuestCategory, GuestStatus } from '../types'

type GuestRow = {
  id: string
  event_id: string
  name: string
  institution: string | null
  category: string
  guest_group: string | null
  invitation_code: string
  invite_token: string
  status: string
  source: string
  created_at: string
  checked_in_at: string | null
}

type SupabaseInsertError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

const INVITATION_CODE_PREFIX = 'ER-'
// Karakter yang mudah dibedakan; 32 karakter = 5 bit per karakter.
const INVITATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITATION_CODE_LENGTH = 12
const INVITATION_CODE_UNIQUE_CONSTRAINT =
  'guests_event_id_invitation_code_key'
const MAX_CODE_INSERT_ATTEMPTS = 5

function generateInvitationCode(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error(
      'Browser tidak mendukung generator kode aman. Gunakan browser terbaru dan koneksi HTTPS.'
    )
  }

  const bytes = new Uint8Array(INVITATION_CODE_LENGTH)
  globalThis.crypto.getRandomValues(bytes)

  const randomPart = Array.from(
    bytes,
    byte => INVITATION_CODE_ALPHABET[byte % INVITATION_CODE_ALPHABET.length]
  ).join('')

  return `${INVITATION_CODE_PREFIX}${randomPart}`
}

function generateUniqueInvitationCodes(count: number): string[] {
  const codes = new Set<string>()

  while (codes.size < count) {
    codes.add(generateInvitationCode())
  }

  return Array.from(codes)
}

function isInvitationCodeConflict(
  error: SupabaseInsertError | null
): boolean {
  if (!error) return false

  const message = [
    error.message,
    error.details,
    error.hint
  ].filter(Boolean).join(' ').toLowerCase()

  return error.code === '23505' && (
    message.includes(INVITATION_CODE_UNIQUE_CONSTRAINT) ||
    message.includes('(event_id, invitation_code)')
  )
}

function mapGuest(row: GuestRow): Guest {
  const category: GuestCategory = row.category?.trim() || 'Lainnya'

  const status: GuestStatus =
    row.status === 'Hadir' ? 'Hadir' : 'Belum hadir'

  return {
    id: row.id,
    name: row.name,
    institution: row.institution ?? '',
    category,
    guestGroup: row.guest_group ?? undefined,
    invitationCode: row.invitation_code,
    inviteToken: row.invite_token,
    status,
    source: row.source === 'Walk-in' ? 'Walk-in' : 'Undangan',
    checkedInAt: row.checked_in_at ?? undefined
  }
}

const GUEST_SELECT = `
  id,
  event_id,
  name,
  institution,
  category,
  guest_group,
  invitation_code,
  invite_token,
  status,
  source,
  created_at,
  checked_in_at
`

export async function getGuestsByEvent(
  eventId: string
): Promise<Guest[]> {
  const { data, error } = await supabase
    .from('guests')
    .select(GUEST_SELECT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Gagal memuat tamu: ${error.message}`)
  }

  return (data as GuestRow[]).map(mapGuest)
}

export type GuestImportRow = {
  name: string
  institution: string
  category: GuestCategory
  guestGroup: string
}

function createGuestRow(eventId: string, guest: GuestImportRow) {
  return {
    event_id: eventId,
    name: guest.name.trim(),
    institution: guest.institution.trim() || null,
    category: guest.category.trim(),
    guest_group: guest.guestGroup.trim() || null,
    invitation_code: generateInvitationCode(),
    // Token QR dibuat terpisah dari kode pencarian portal.
    invite_token: globalThis.crypto.randomUUID(),
    status: 'Belum hadir',
    source: 'Undangan'
  }
}

export async function importGuestsToEvent(
  eventId: string,
  guests: GuestImportRow[]
): Promise<Guest[]> {
  if (!eventId) {
    throw new Error('Acara aktif belum dipilih.')
  }

  if (!guests.length) {
    throw new Error('Tidak ada data tamu untuk diimpor.')
  }

  // Semua baris di sini adalah tamu baru. Tidak ada UPDATE/UPSERT,
  // sehingga kode dan token milik tamu lama tidak disentuh.
  const rows = guests.map(guest => createGuestRow(eventId, guest))

  for (let attempt = 1; attempt <= MAX_CODE_INSERT_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('guests')
      .insert(rows)
      .select(GUEST_SELECT)

    if (!error) {
      return (data as GuestRow[]).map(mapGuest)
    }

    if (
      isInvitationCodeConflict(error as SupabaseInsertError) &&
      attempt < MAX_CODE_INSERT_ATTEMPTS
    ) {
      // Regenerasi hanya invitation_code. invite_token tetap sama
      // selama percobaan ulang karena belum ada baris yang tersimpan.
      const replacementCodes = generateUniqueInvitationCodes(rows.length)
      rows.forEach((row, index) => {
        row.invitation_code = replacementCodes[index]
      })
      continue
    }

    throw new Error(`Gagal mengimpor data tamu: ${error.message}`)
  }

  throw new Error(
    'Gagal membuat kode undangan unik setelah beberapa percobaan. Silakan ulangi.'
  )
}

export async function addGuestToEvent(
  eventId: string,
  guest: GuestImportRow
): Promise<Guest> {
  if (!eventId) {
    throw new Error('Acara aktif belum dipilih.')
  }

  if (!guest.name.trim()) {
    throw new Error('Nama tamu wajib diisi.')
  }

  const row = createGuestRow(eventId, guest)

  for (let attempt = 1; attempt <= MAX_CODE_INSERT_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('guests')
      .insert(row)
      .select(GUEST_SELECT)
      .single()

    if (!error) {
      return mapGuest(data as GuestRow)
    }

    if (
      isInvitationCodeConflict(error as SupabaseInsertError) &&
      attempt < MAX_CODE_INSERT_ATTEMPTS
    ) {
      row.invitation_code = generateInvitationCode()
      continue
    }

    throw new Error(`Gagal menambahkan tamu: ${error.message}`)
  }

  throw new Error(
    'Gagal membuat kode undangan unik setelah beberapa percobaan. Silakan ulangi.'
  )
}

export async function deleteGuestsFromEvent(
  eventId: string,
  guestIds: string[]
): Promise<void> {
  if (!eventId) {
    throw new Error('Acara belum dipilih.')
  }

  if (!guestIds.length) {
    throw new Error('Pilih minimal satu tamu.')
  }

  const { error } = await supabase
    .from('guests')
    .delete()
    .eq('event_id', eventId)
    .in('id', guestIds)

  if (error) {
    throw new Error(`Gagal menghapus data tamu: ${error.message}`)
  }
}

export async function checkInGuest(
  eventId: string,
  guestId: string
): Promise<string> {
  const checkedInAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('guests')
    .update({
      status: 'Hadir',
      checked_in_at: checkedInAt
    })
    .eq('event_id', eventId)
    .eq('id', guestId)
    .select('checked_in_at')
    .single()

  if (error) {
    throw new Error(`Gagal menyimpan check-in: ${error.message}`)
  }

  return data.checked_in_at
}
