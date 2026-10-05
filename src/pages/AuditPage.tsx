import { clsx } from 'clsx'
import { ChevronDown, ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Fragment, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAudit, useVerifyAudit, type AuditFilter } from '@/api/hooks'
import type { AuditEntry, EntityType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Badge, Code, EmptyState, ErrorBanner, JsonBlock, PageHeader, Spinner, Table, formatDate } from '@/components/ui/Display'
import { Field, Input, Select } from '@/components/ui/Form'

const PAGE_SIZE = 50
const ENTITY_TYPES: EntityType[] = ['FEATURE', 'PROJECT', 'ENVIRONMENT', 'ATTRIBUTE', 'SAVED_GROUP', 'SDK_CONNECTION', 'BUNDLE']

function ChainBadge() {
  const verify = useVerifyAudit()
  if (verify.isLoading) return <Badge>verifying…</Badge>
  if (verify.error || !verify.data) return <Badge tone="yellow">verification unavailable</Badge>
  const v = verify.data
  return v.valid ? (
    <Badge tone="green" className="px-2.5 py-1 text-xs">
      <ShieldCheck className="size-4" /> Chain verified · {v.checked} entries
    </Badge>
  ) : (
    <Badge tone="red" className="px-2.5 py-1 text-xs" >
      <ShieldAlert className="size-4" /> Chain broken at #{v.brokenAt ?? '?'}
      {v.message && <span title={v.message}> · {v.message}</span>}
    </Badge>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Top-level key view of a JSON side; keys whose value differs from the other side are highlighted. */
function DiffSide({ title, value, other }: { title: string; value: unknown; other: unknown }) {
  const body = isRecord(value) ? (
    <div className="overflow-auto rounded-md bg-ink p-3 font-mono text-xs leading-relaxed">
      {Object.entries(value).map(([key, v]) => {
        const changed = !isRecord(other) || JSON.stringify(other[key]) !== JSON.stringify(v)
        return (
          <div key={key} className={clsx('rounded px-1', changed ? 'bg-kto-red/15 text-white' : 'text-soft')}>
            <span className="text-muted">{key}:</span> {JSON.stringify(v)}
          </div>
        )
      })}
      {isRecord(other) &&
        Object.keys(other)
          .filter((k) => !(k in value))
          .map((k) => (
            <div key={k} className="rounded bg-kto-red/15 px-1 italic text-muted">
              {k}: (removido)
            </div>
          ))}
    </div>
  ) : (
    <JsonBlock value={value ?? null} />
  )
  return (
    <div className="min-w-0">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-soft">{title}</h4>
      {body}
    </div>
  )
}

function EntityCell({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone="outline">{entry.entityType}</Badge>
      {entry.entityType === 'FEATURE' ? (
        <Link to={`/features/${encodeURIComponent(entry.entityKey)}`} className="font-mono text-xs hover:text-kto-red">
          {entry.entityKey}
        </Link>
      ) : (
        <span className="font-mono text-xs">{entry.entityKey.length > 24 ? `${entry.entityKey.slice(0, 24)}…` : entry.entityKey}</span>
      )}
    </div>
  )
}

function Row({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="cursor-pointer hover:bg-surface" onClick={() => setOpen((o) => !o)}>
        <td className="px-4 py-3">
          <span className="flex items-center gap-1 font-mono text-xs font-semibold text-kto-yellow">
            {open ? <ChevronDown className="size-3.5 text-muted" /> : <ChevronRight className="size-3.5 text-muted" />}
            {entry.seq}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(entry.occurredAt)}</td>
        <td className="px-4 py-3">{entry.actor}</td>
        <td className="px-4 py-3"><Badge>{entry.action}</Badge></td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><EntityCell entry={entry} /></td>
        <td className="px-4 py-3 text-muted">{entry.reason || '—'}</td>
        <td className="px-4 py-3"><Code value={entry.hash} short /></td>
      </tr>
      {open && (
        <tr className="bg-surface/50">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DiffSide title="Before" value={entry.before} other={entry.after} />
              <DiffSide title="After" value={entry.after} other={entry.before} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** One page of the (accumulated) list; the last chunk renders the "load more" row. */
function Chunk({ filter, beforeSeq, isLast, onMore }: {
  filter: AuditFilter
  beforeSeq?: number
  isLast: boolean
  onMore: (beforeSeq: number) => void
}) {
  const audit = useAudit({ ...filter, beforeSeq, limit: PAGE_SIZE })
  const entries = audit.data
  const lowest = entries && entries.length > 0 ? Math.min(...entries.map((e) => e.seq)) : undefined
  return (
    <>
      {audit.isLoading && (
        <tr><td colSpan={7}><Spinner /></td></tr>
      )}
      {audit.error && (
        <tr><td colSpan={7} className="p-4"><ErrorBanner error={audit.error} /></td></tr>
      )}
      {entries?.map((entry) => <Row key={entry.id} entry={entry} />)}
      {isLast && entries && entries.length === 0 && beforeSeq === undefined && (
        <tr><td colSpan={7}><EmptyState title="No entries found" /></td></tr>
      )}
      {isLast && entries && entries.length >= PAGE_SIZE && lowest !== undefined && (
        <tr>
          <td colSpan={7} className="px-4 py-3 text-center">
            <Button variant="secondary" size="sm" onClick={() => onMore(lowest)}>Load more</Button>
          </td>
        </tr>
      )}
    </>
  )
}

export function AuditPage() {
  const [draft, setDraft] = useState({ entityType: '', entityKey: '', actor: '' })
  const [filter, setFilter] = useState<AuditFilter>({})
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined])

  const apply = (e: FormEvent) => {
    e.preventDefault()
    setFilter({
      entityType: draft.entityType || undefined,
      entityKey: draft.entityKey.trim() || undefined,
      actor: draft.actor.trim() || undefined,
    })
    setCursors([undefined])
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Hash-chained trail of every change: who, when, what and why."
        actions={<ChainBadge />}
      />
      <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Entity type" className="w-48">
          <Select value={draft.entityType} onChange={(e) => setDraft({ ...draft, entityType: e.target.value })}>
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Entity key" className="w-56">
          <Input value={draft.entityKey} onChange={(e) => setDraft({ ...draft, entityKey: e.target.value })} />
        </Field>
        <Field label="Actor" className="w-56">
          <Input value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} />
        </Field>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Table head={['Seq', 'When', 'Actor', 'Action', 'Entity', 'Reason', 'Hash']}>
        {cursors.map((cursor, i) => (
          <Fragment key={`${JSON.stringify(filter)}-${cursor ?? 'first'}`}>
            <Chunk
              filter={filter}
              beforeSeq={cursor}
              isLast={i === cursors.length - 1}
              onMore={(seq) => setCursors((c) => [...c, seq])}
            />
          </Fragment>
        ))}
      </Table>
    </>
  )
}
