import { clsx } from 'clsx'
import { AlertTriangle, Check, Copy, Inbox, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@/api/client'

/** {@code mono}: the title is an identifier (e.g. a feature key) and must be shown exactly, not uppercased. */
export function PageHeader({ title, subtitle, actions, mono }: { title: string; subtitle?: ReactNode; actions?: ReactNode; mono?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className={mono ? 'break-all font-mono text-2xl font-bold text-white' : 'headline text-3xl text-white'}>{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className }: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('rounded-xl border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <h2 className="text-sm font-bold">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

type Tone = 'neutral' | 'red' | 'green' | 'yellow' | 'outline'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-soft',
  red: 'bg-kto-red/15 text-kto-red',
  green: 'bg-kto-green/15 text-kto-green',
  yellow: 'bg-kto-yellow/15 text-kto-yellow',
  outline: 'border border-surface-3 text-soft',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold', TONES[tone], className)}>
      {children}
    </span>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted" role="status">
      <Loader2 className="size-4 animate-spin text-kto-red" /> {label}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-3 px-6 py-12 text-center">
      <Inbox className="size-8 text-kto-grey" />
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  )
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  const apiError = error instanceof ApiError ? error : null
  return (
    <div className="rounded-md border border-kto-red/50 bg-kto-red/10 px-4 py-3 text-sm" role="alert">
      <div className="flex items-center gap-2 font-semibold text-kto-red">
        <AlertTriangle className="size-4" />
        {error instanceof Error ? error.message : 'Unexpected error'}
        {apiError?.messageCode && <span className="font-mono text-xs opacity-80">{apiError.messageCode}</span>}
      </div>
      {apiError && apiError.details.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-6 font-mono text-xs text-soft">
          {apiError.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Monospace hash/key with a copy button; long values are shortened visually but copied in full. */
export function Code({ value, short, className }: { value: string; short?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false)
  const shown = short && value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs', className)}>
      <span title={value}>{shown}</span>
      <button
        type="button"
        aria-label="Copy"
        className="text-muted hover:text-white"
        onClick={(e) => {
          e.stopPropagation()
          navigator.clipboard?.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? <Check className="size-3 text-kto-green" /> : <Copy className="size-3" />}
      </button>
    </span>
  )
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={clsx('overflow-auto rounded-md bg-ink p-3 font-mono text-xs leading-relaxed text-soft', className)}>
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

/** Renders a flag value; numbers use KTO yellow (brand: numbers/figures). */
export function ValueChip({ value }: { value: unknown }) {
  if (typeof value === 'boolean') {
    return <Badge tone={value ? 'green' : 'neutral'}>{value ? 'true' : 'false'}</Badge>
  }
  if (typeof value === 'number') return <span className="font-mono text-xs font-semibold text-kto-yellow">{value}</span>
  if (typeof value === 'string') return <span className="font-mono text-xs text-white">"{value}"</span>
  if (value === null || value === undefined) return <span className="font-mono text-xs text-muted">null</span>
  const json = JSON.stringify(value)
  return <span className="font-mono text-xs text-soft" title={json}>{json.length > 40 ? `${json.slice(0, 40)}…` : json}</span>
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto rounded-xl border border-line', className)}>
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' })
}
