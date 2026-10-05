import { clsx } from 'clsx'
import { AlertTriangle, CheckCircle2, GitMerge, MessageSquare, ShieldAlert, XCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useDraft, useDraftAction, usePublishDraft, useRebaseDraft, useSavedGroups } from '@/api/hooks'
import type { DraftView, EnvironmentSettings, Json, SectionChange } from '@/api/types'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, ErrorBanner, formatDate, JsonBlock, Spinner, ValueChip } from '@/components/ui/Display'
import { Textarea } from '@/components/ui/Form'
import { EVENT_LABEL, sectionLabel, STATUS_LABEL, STATUS_TONE } from './draftLabels'
import { RuleSummary } from './EnvironmentPanel'

/**
 * "Review & publish", as in GrowthBook: side-by-side diff of what is live vs what would be published, conflicts
 * with changes published meanwhile, the review conversation and only the actions the current user is allowed to do.
 */
export function DraftReviewDialog({ draftId, open, onOpenChange, onPublished }: {
  draftId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublished: () => void
}) {
  const view = useDraft(open ? draftId : null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange} wide title="Review & publish"
      description="Compare what is live with what will be published. Nothing changes for SDKs until you publish.">
      {view.isLoading && <Spinner />}
      <ErrorBanner error={view.error} />
      {view.data && <ReviewBody view={view.data} onPublished={() => { onOpenChange(false); onPublished() }} />}
    </Dialog>
  )
}

function ReviewBody({ view, onPublished }: { view: DraftView; onPublished: () => void }) {
  const { draft, permissions } = view
  const action = useDraftAction()
  const publish = usePublishDraft()
  const rebase = useRebaseDraft()
  const [comment, setComment] = useState('')
  const [confirm, setConfirm] = useState<'publish' | 'bypass' | null>(null)
  const error = action.error ?? publish.error ?? rebase.error

  const run = (kind: 'request-review' | 'approve' | 'request-changes' | 'comments') =>
    action.mutate({ id: draft.id, action: kind, comment: comment.trim() || undefined }, { onSuccess: () => setComment('') })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={STATUS_TONE[draft.status]}>{STATUS_LABEL[draft.status]}</Badge>
        {draft.title && <span className="font-semibold">{draft.title}</span>}
        <span className="text-muted">
          by {draft.createdBy} · based on revision <span className="font-mono text-kto-yellow">#{draft.baseRevision}</span>
          {view.liveRevision !== draft.baseRevision && (
            <> · live: <span className="font-mono text-kto-yellow">#{view.liveRevision}</span></>
          )}
        </span>
      </div>

      {view.reviewEnvironments.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-kto-yellow/40 bg-kto-yellow/10 px-4 py-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-kto-yellow" />
          <span>
            Affects <b>{view.reviewEnvironments.join(', ')}</b>, which requires approval from someone else before publishing.
          </span>
        </div>
      )}

      {view.conflicts.length > 0 && (
        <div className="space-y-3 rounded-md border border-kto-red/50 bg-kto-red/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-kto-red">
            <AlertTriangle className="size-4" /> Conflicts with changes published after this draft was created
          </p>
          <p className="text-soft">Conflicting sections: {view.conflicts.map(sectionLabel).join(', ')}.</p>
          {permissions.edit && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={rebase.isPending}
                onClick={() => rebase.mutate({ id: draft.id, keepDraft: true, version: draft.version })}>
                <GitMerge className="size-3.5" /> Update, keeping my draft
              </Button>
              <Button size="sm" variant="ghost" loading={rebase.isPending}
                onClick={() => rebase.mutate({ id: draft.id, keepDraft: false, version: draft.version })}>
                Update, keeping what is live
              </Button>
            </div>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-bold">Changes ({view.changes.length})</h3>
        {view.changes.length === 0 ? (
          <p className="text-sm text-muted">No differences from what is live.</p>
        ) : (
          view.changes.map((change) => <ChangeDiff key={change.section} change={change} conflict={view.conflicts.includes(change.section)} />)
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">History & comments</h3>
        <ol className="space-y-2 border-l border-line pl-4">
          {view.events.map((event) => (
            <li key={event.id} className="text-sm">
              <span className={clsx('font-semibold', event.type === 'BYPASS_PUBLISHED' && 'text-kto-red')}>{event.actor}</span>{' '}
              <span className={clsx(event.type === 'BYPASS_PUBLISHED' ? 'text-kto-red' : 'text-muted')}>{EVENT_LABEL[event.type]}</span>
              <span className="text-xs text-kto-grey"> · {formatDate(event.occurredAt)}</span>
              {event.comment && <p className="mt-0.5 text-soft">“{event.comment}”</p>}
            </li>
          ))}
        </ol>
        {draft.status !== 'PUBLISHED' && draft.status !== 'DISCARDED' && (
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (required to request changes)" className="font-sans text-sm" />
        )}
      </section>

      {view.blockers.length > 0 && draft.status !== 'PUBLISHED' && draft.status !== 'DISCARDED' && (
        <ul className="space-y-1 text-xs text-muted">
          {view.blockers.map((b) => (
            <li key={b} className="flex items-center gap-1.5"><XCircle className="size-3.5 text-kto-grey" /> {b}</li>
          ))}
        </ul>
      )}

      <ErrorBanner error={error} />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" disabled={!comment.trim()} loading={action.isPending} onClick={() => run('comments')}>
          <MessageSquare className="size-4" /> Comment
        </Button>
        {permissions.requestReview && view.reviewEnvironments.length > 0 && (
          <Button variant="secondary" loading={action.isPending} onClick={() => run('request-review')}>Request review</Button>
        )}
        {permissions.review && (
          <>
            <Button variant="danger" disabled={!comment.trim()} loading={action.isPending} onClick={() => run('request-changes')}>
              Request changes
            </Button>
            <Button variant="positive" loading={action.isPending} onClick={() => run('approve')}>
              <CheckCircle2 className="size-4" /> Approve
            </Button>
          </>
        )}
        {permissions.bypass && (
          <Button variant="danger" onClick={() => setConfirm('bypass')}>
            <ShieldAlert className="size-4" /> Publish without approval
          </Button>
        )}
        {permissions.publish && <Button onClick={() => setConfirm('publish')}>Publish</Button>}
      </div>

      <ReasonDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'bypass' ? 'Emergency publication' : 'Publish draft'}
        description={confirm === 'bypass'
          ? 'Publishes without the required approval. It is flagged in the audit trail as BYPASS — use only during incidents.'
          : 'Creates a new revision and a new signed bundle for the connections of the affected environments.'}
        required={confirm === 'bypass'}
        danger={confirm === 'bypass'}
        confirmLabel={confirm === 'bypass' ? 'Publish anyway' : 'Publish'}
        onConfirm={async (reason) => {
          await publish.mutateAsync({ id: draft.id, bypass: confirm === 'bypass', reason })
          onPublished()
        }}
      />
    </div>
  )
}

function ChangeDiff({ change, conflict }: { change: SectionChange; conflict: boolean }) {
  const isEnvironment = change.section.startsWith('environments.')
  return (
    <div className={clsx('rounded-lg border', conflict ? 'border-kto-red' : 'border-line')}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm font-semibold">
        {sectionLabel(change.section)}
        {conflict && <Badge tone="red">conflito</Badge>}
      </div>
      <div className="grid divide-x divide-line md:grid-cols-2">
        <DiffSide title="Live" tone="muted">
          {isEnvironment ? <EnvironmentView settings={change.live as unknown as EnvironmentSettings | null} /> : <FieldView value={change.live} />}
        </DiffSide>
        <DiffSide title="After publishing" tone="red">
          {isEnvironment ? <EnvironmentView settings={change.proposed as unknown as EnvironmentSettings | null} /> : <FieldView value={change.proposed} />}
        </DiffSide>
      </div>
    </div>
  )
}

function DiffSide({ title, tone, children }: { title: string; tone: 'muted' | 'red'; children: ReactNode }) {
  return (
    <div className="min-w-0 p-4">
      <p className={clsx('mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider', tone === 'red' ? 'text-kto-red' : 'text-muted')}>{title}</p>
      {children}
    </div>
  )
}

function FieldView({ value }: { value: Json }) {
  if (Array.isArray(value)) return <span className="text-sm">{value.length ? value.join(', ') : '—'}</span>
  if (value !== null && typeof value === 'object') return <JsonBlock value={value} />
  return <ValueChip value={value} />
}

function EnvironmentView({ settings }: { settings: EnvironmentSettings | null }) {
  const groups = useSavedGroups().data ?? []
  const groupName = (key: string) => groups.find((g) => g.key === key)?.name ?? key
  if (!settings) return <span className="text-sm text-muted">not configured (off)</span>
  return (
    <div className="space-y-3">
      <Badge tone={settings.enabled ? 'green' : 'neutral'}>{settings.enabled ? 'On' : 'Off'}</Badge>
      {settings.rules.length === 0 ? (
        <p className="text-sm text-muted">No rules</p>
      ) : (
        <ol className="space-y-2">
          {settings.rules.map((rule, i) => (
            <li key={rule.id ?? i} className={clsx('rounded-md border border-line p-2.5', !rule.enabled && 'opacity-50')}>
              <p className="mb-1 font-mono text-[0.6875rem] text-kto-grey">
                #{i + 1} {rule.type} {rule.description ? `· ${rule.description}` : ''} {!rule.enabled && '· disabled'}
              </p>
              <RuleSummary rule={rule} groupName={groupName} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
