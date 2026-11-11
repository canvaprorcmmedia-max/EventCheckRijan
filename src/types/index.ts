
export type GuestCategory = 'VVIP' | 'VIP' | 'Reguler' | 'Lainnya'

export type GuestStatus = 'Hadir' | 'Belum hadir'

export interface Guest {
  id: string
  name: string
  institution: string
  category: GuestCategory
  guestGroup?: string
  invitationCode: string
  inviteToken: string
  status: GuestStatus
  checkedInAt?: string
  source: 'Undangan' | 'Walk-in'
}
