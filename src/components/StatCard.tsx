import type { LucideIcon } from 'lucide-react'
interface StatCardProps { label: string; value: string; note: string; icon: LucideIcon; tone: 'blue' | 'green' | 'amber' | 'violet'; trend?: string }
export default function StatCard({ label, value, note, icon: Icon, tone, trend }: StatCardProps) {
  return <article className="stat-card">
    <div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={19}/></div></div>
    <div className="stat-value">{value}</div>
    <div className="stat-bottom"><span>{note}</span>{trend && <span className="stat-trend">{trend}</span>}</div>
  </article>
}