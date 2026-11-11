
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
}

function mapGuest(row: GuestRow): Guest {
  const validCategories: GuestCategory[] = [
    'VVIP',
    'VIP',
    'Reguler',
    'Lainnya'
  ]

  const category: GuestCategory = validCategories.includes(
    row.category as GuestCategory
  )
    ? (row.category as GuestCategory)
    : 'Lainnya'

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
    source: row.source === 'Walk-in' ? 'Walk-in' : 'Undangan'
  }
}

export async function getGuestsByEvent(
  eventId: string
): Promise<Guest[]> {
  const { data, error } = await supabase
    .from('guests')
    .select(`
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
      created_at
    `)
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

  const rows = guests.map(guest => ({
    event_id: eventId,
    name: guest.name.trim(),
    institution: guest.institution.trim() || null,
    category: guest.category,
    guest_group: guest.guestGroup.trim() || null,
    invitation_code: `ER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    invite_token: crypto.randomUUID(),
    status: 'Belum hadir',
    source: 'Undangan'
  }))

  const { data, error } = await supabase
    .from('guests')
    .insert(rows)
    .select(`
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
      created_at
    `)

  if (error) {
    throw new Error(`Gagal mengimpor data tamu: ${error.message}`)
  }

  return (data as GuestRow[]).map(mapGuest)
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

  const row = {
    event_id: eventId,
    name: guest.name.trim(),
    institution: guest.institution.trim() || null,
    category: guest.category,
    guest_group: guest.guestGroup.trim() || null,
    invitation_code: `ER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    invite_token: crypto.randomUUID(),
    status: 'Belum hadir',
    source: 'Undangan'
  }

  const { data, error } = await supabase
    .from('guests')
    .insert(row)
    .select(`
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
      created_at
    `)
    .single()

  if (error) {
    throw new Error(`Gagal menambahkan tamu: ${error.message}`)
  }

  return mapGuest(data as GuestRow)
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