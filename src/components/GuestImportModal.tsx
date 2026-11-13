
import { useState } from 'react'
import ExcelJS from 'exceljs'
import { Download, FileSpreadsheet, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  importGuestsToEvent,
  type GuestImportRow
} from '../lib/guestService'

type Props = {
  eventId: string
  existingGuests: {
    name: string
    invitationCode: string
  }[]
  onClose: () => void
  onImported: () => Promise<void>
}

export default function GuestImportModal({
  eventId,
  existingGuests,
  onClose,
  onImported
}: Props) {
  const [rows, setRows] = useState<GuestImportRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [fileName, setFileName] = useState('')

  async function downloadTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('DATA TAMU')

    sheet.columns = [
      { header: 'Nama Tamu', key: 'name', width: 30 },
      { header: 'Instansi', key: 'institution', width: 35 },
      { header: 'Kategori', key: 'category', width: 18 },
      { header: 'Kelompok Tamu', key: 'guestGroup', width: 25 }
    ]

    sheet.addRows([
      {
        name: 'KH. Ahmad Fauzi',
        institution: 'PP Riyadlul Jannah',
        category: 'VVIP',
        guestGroup: 'Pengasuh Pondok'
      },
      {
        name: 'Ahmad Fikri',
        institution: 'Alumni',
        category: 'Reguler',
        guestGroup: 'Alumni'
      }
    ])

    sheet.getRow(1).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' }
    }
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF14532D' }
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = 'A1:D1'

    const categorySheet = workbook.addWorksheet('PETUNJUK')
    categorySheet.addRows([
      ['PETUNJUK PENGISIAN DATA TAMU'],
      ['Nama Tamu: wajib diisi'],
      ['Instansi: boleh dikosongkan'],
      ['Kategori: bebas diisi sesuai kebutuhan acara, contoh: VVIP, WISUDAWAN, DOSEN, PANITIA, ORANG TUA, atau nama lainnya.'],
      ['Kelompok Tamu: boleh dikosongkan'],
      ['Kategori tidak dibatasi daftar bawaan aplikasi.'],
      ['Hapus atau ganti data contoh sebelum mengimpor.']
    ])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Template_Data_Tamu_EventCheckRijan.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleFile(file?: File) {
    if (!file) return

    setRows([])
    setErrors([])
    setMessage('')
    setFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setErrors(['Gunakan file Excel dengan format .xlsx'])
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(await file.arrayBuffer())

      const sheet = workbook.getWorksheet('DATA TAMU') || workbook.worksheets[0]

      if (!sheet) {
        setErrors(['Worksheet DATA TAMU tidak ditemukan.'])
        return
      }

      const headers = ['Nama Tamu', 'Instansi', 'Kategori', 'Kelompok Tamu']
      const actualHeaders = headers.map((_, index) =>
        String(sheet.getRow(1).getCell(index + 1).value || '').trim()
      )

      if (!headers.every((header, index) => header === actualHeaders[index])) {
        setErrors([
          'Header kolom tidak sesuai. Gunakan template resmi EventCheckRijan.'
        ])
        return
      }

      const imported: GuestImportRow[] = []
      const validationErrors: string[] = []
      const seenNames = new Set(
        existingGuests.map(guest => guest.name.trim().toLowerCase())
      )

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        const name = String(row.getCell(1).text || '').trim()
        const institution = String(row.getCell(2).text || '').trim()
        const categoryText = String(row.getCell(3).text || '').trim()
        const guestGroup = String(row.getCell(4).text || '').trim()

        if (!name && !institution && !categoryText && !guestGroup) return

        if (!name) {
          validationErrors.push(`Baris ${rowNumber}: Nama Tamu wajib diisi.`)
          return
        }

        if (!categoryText) {
          validationErrors.push(`Baris ${rowNumber}: Kategori wajib diisi.`)
          return
        }

        const normalizedName = name.toLowerCase()

        if (seenNames.has(normalizedName)) {
          validationErrors.push(`Baris ${rowNumber}: Nama "${name}" terdeteksi ganda.`)
          return
        }

        seenNames.add(normalizedName)

        imported.push({
          name,
          institution,
          category: categoryText,
          guestGroup
        })
      })

      setRows(imported)
      setErrors(validationErrors)

      if (!imported.length && !validationErrors.length) {
        setErrors(['Tidak ditemukan data tamu pada file.'])
      }
    } catch (error) {
      console.error(error)
      setErrors(['File Excel gagal dibaca. Periksa format file.'])
    }
  }

  async function confirmImport() {
    if (!rows.length || errors.length) return

    setLoading(true)
    setMessage('')

    try {
      await importGuestsToEvent(eventId, rows)
      await onImported()
      setMessage(`${rows.length} tamu berhasil diimpor.`)
      setRows([])
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Import gagal dilakukan.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
     <section className="panel guest-import-panel">
        <div className="modal-header">
          <div>
            <h2>Import Data Tamu</h2>
            <p>Upload dan periksa data sebelum disimpan.</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <button className="btn-secondary" onClick={() => void downloadTemplate()}>
            <Download size={16} /> Download Template Excel
          </button>

          <label className="btn-primary" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Pilih File Excel
            <input
              type="file"
              accept=".xlsx"
              hidden
              onChange={event => void handleFile(event.target.files?.[0])}
            />
          </label>
        </div>

        {fileName && <p>File: {fileName}</p>}

        {errors.length > 0 && (
          <div className="notice notice-error">
            <AlertCircle size={17} />
            <div>
              <strong>Periksa data berikut:</strong>
              {errors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          </div>
        )}

        {message && (
          <div className="notice">
            <CheckCircle2 size={17} /> {message}
          </div>
        )}

        <div className="panel" style={{ marginTop: 15, padding: 12 }}>
          <div className="panel-heading">
            <div>
              <h3><FileSpreadsheet size={17} /> Preview Data Tamu</h3>
              <p>{rows.length} data siap diperiksa</p>
            </div>
          </div>

          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nama Tamu</th>
                  <th>Instansi</th>
                  <th>Kategori</th>
                  <th>Kelompok Tamu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((guest, index) => (
                  <tr key={index}>
                    <td>{guest.name}</td>
                    <td>{guest.institution}</td>
                    <td>{guest.category}</td>
                    <td>{guest.guestGroup}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!rows.length && (
              <p style={{ padding: 20, textAlign: 'center' }}>
                Belum ada data untuk ditampilkan.
              </p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn-primary"
            disabled={!rows.length || errors.length > 0 || loading}
            onClick={() => void confirmImport()}
          >
            {loading ? 'Menyimpan...' : `Konfirmasi Import (${rows.length})`}
          </button>
        </div>
  </section>
  )
}
