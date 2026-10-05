import { clsx } from 'clsx'
import { ChevronDown, ChevronRight, Pencil, Plus, Send, ShieldAlert, Trash2, Webhook as WebhookIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhookEvents,
  useWebhooks,
} from '@/api/hooks'
import type { CreatedWebhook, Webhook, WebhookDeliveryStatus, WebhookFormat } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Code, EmptyState, ErrorBanner, formatDate, PageHeader, Spinner } from '@/components/ui/Display'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { Toggle } from '@/components/ui/Toggle'

const STATUS_TONE: Record<WebhookDeliveryStatus, 'green' | 'yellow' | 'red' | 'neutral'> = {
  DELIVERED: 'green',
  PENDING: 'neutral',
  SENDING: 'neutral',
  RETRY: 'yellow',
  FAILED: 'red',
}

const FORMAT_LABEL: Record<WebhookFormat, string> = { GENERIC: 'JSON', SLACK: 'Slack' }

/** Notifications to Slack or any HTTP endpoint when drafts move, publications happen or rollbacks are made. */
export function WebhooksPage() {
  const { can } = useAuth()
  const webhooks = useWebhooks()
  const [editing, setEditing] = useState<Webhook | 'new' | null>(null)
  const [created, setCreated] = useState<CreatedWebhook | null>(null)

  if (!can('ktoggle-admin')) {
    return <EmptyState title="Admins only">Webhooks are managed by ktoggle admins.</EmptyState>
  }

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Notify Slack or any HTTP endpoint about reviews, publications, emergency publications, rollbacks and scheduled rules."
        actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> New webhook</Button>}
      />
      {webhooks.isLoading && <Spinner />}
      <ErrorBanner error={webhooks.error} />
      {webhooks.data && webhooks.data.length === 0 && (
        <EmptyState title="No webhooks yet">For example, post every production publication to a Slack channel.</EmptyState>
      )}
      <div className="space-y-4">
        {webhooks.data?.map((webhook) => (
          <WebhookCard key={webhook.id} webhook={webhook} onEdit={() => setEditing(webhook)} />
        ))}
      </div>
      {editing && (
        <WebhookDialog
          webhook={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(result) => {
            setEditing(null)
            setCreated(result)
          }}
        />
      )}
      {created && <SecretDialog created={created} onClose={() => setCreated(null)} />}
    </>
  )
}

function WebhookCard({ webhook, onEdit }: { webhook: Webhook; onEdit: () => void }) {
  const events = useWebhookEvents().data ?? []
  const update = useUpdateWebhook()
  const test = useTestWebhook()
  const remove = useDeleteWebhook()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const label = (code: string) => events.find((e) => e.code === code)?.label ?? code

  return (
    <div className={clsx('rounded-xl border bg-surface', webhook.enabled ? 'border-line' : 'border-dashed border-surface-3')}>
      <div className="flex flex-wrap items-start gap-4 p-4">
        <Toggle
          checked={webhook.enabled}
          label={`Webhook ${webhook.name} enabled`}
          disabled={update.isPending}
          onChange={(enabled) => update.mutate({ ...webhook, enabled })}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{webhook.name}</span>
            <Badge tone="outline">{FORMAT_LABEL[webhook.format]}</Badge>
            {!webhook.enabled && <Badge>paused</Badge>}
          </div>
          <p className="truncate font-mono text-xs text-muted" title={webhook.url}>{webhook.url}</p>
          <div className="flex flex-wrap gap-1.5">
            {webhook.events.map((e) => <Badge key={e}>{label(e)}</Badge>)}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" loading={test.isPending} onClick={() => test.mutate(webhook.id, { onSuccess: () => setOpen(true) })}>
            <Send className="size-3.5" /> Send test
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${webhook.name}`}><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${webhook.name}`}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <ErrorBanner error={update.error ?? test.error} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 border-t border-line px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted hover:text-white"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} Recent deliveries
      </button>
      {open && <Deliveries webhookId={webhook.id} label={label} />}
      {confirmDelete && (
        <Dialog
          open
          onOpenChange={(o) => !o && setConfirmDelete(false)}
          title={`Delete ${webhook.name}?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(webhook.id)}>Delete webhook</Button>
            </>
          }
        >
          <p className="text-sm text-soft">Pending deliveries are discarded and the endpoint stops receiving notifications.</p>
          <ErrorBanner error={remove.error} />
        </Dialog>
      )}
    </div>
  )
}

function Deliveries({ webhookId, label }: { webhookId: string; label: (code: string) => string }) {
  const deliveries = useWebhookDeliveries(webhookId, true)
  if (deliveries.isLoading) return <Spinner />
  if (!deliveries.data?.length) return <p className="px-4 pb-4 text-sm text-muted">Nothing sent yet. Use Send test to try it.</p>
  return (
    <div className="overflow-x-auto px-4 pb-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4 font-semibold">When</th>
            <th className="py-2 pr-4 font-semibold">Event</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 pr-4 font-semibold">Attempts</th>
            <th className="py-2 font-semibold">Response</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.data.map((d) => (
            <tr key={d.id} className="border-t border-line">
              <td className="py-2 pr-4 text-xs text-soft">{formatDate(d.createdAt)}</td>
              <td className="py-2 pr-4">{label(d.event)}</td>
              <td className="py-2 pr-4"><Badge tone={STATUS_TONE[d.status]}>{d.status.toLowerCase()}</Badge></td>
              <td className="py-2 pr-4 font-mono text-xs text-kto-yellow">{d.attempts}</td>
              <td className="py-2 text-xs text-muted">
                {d.lastError ?? (d.lastStatusCode ? `HTTP ${d.lastStatusCode}` : '—')}
                {d.status === 'RETRY' && <> · next try {formatDate(d.nextAttemptAt)}</>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WebhookDialog({ webhook, onClose, onCreated }: {
  webhook: Webhook | null
  onClose: () => void
  onCreated: (created: CreatedWebhook) => void
}) {
  const events = useWebhookEvents().data ?? []
  const create = useCreateWebhook()
  const update = useUpdateWebhook()
  const [name, setName] = useState(webhook?.name ?? '')
  const [url, setUrl] = useState(webhook?.url ?? '')
  const [format, setFormat] = useState<WebhookFormat>(webhook?.format ?? 'SLACK')
  const [selected, setSelected] = useState<string[]>(webhook?.events ?? ['draft.review_requested', 'draft.published', 'draft.emergency_published'])
  const busy = create.isPending || update.isPending

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = { name: name.trim(), url: url.trim(), format, events: selected }
    if (webhook) update.mutate({ id: webhook.id, ...body, enabled: webhook.enabled, version: webhook.version }, { onSuccess: onClose })
    else create.mutate(body, { onSuccess: onCreated })
  }

  return (
    <Dialog
      open
      wide
      onOpenChange={(open) => !open && onClose()}
      title={webhook ? `Edit ${webhook.name}` : 'New webhook'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="webhook-form" loading={busy} disabled={!name.trim() || !url.trim() || selected.length === 0}>
            {webhook ? 'Save' : 'Create webhook'}
          </Button>
        </>
      }
    >
      <form id="webhook-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Name">
            <Input id="webhook-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. #feature-flags on Slack" autoFocus />
          </Field>
          <Field label="Format">
            <Select id="webhook-format" value={format} onChange={(e) => setFormat(e.target.value as WebhookFormat)}>
              <option value="SLACK">Slack</option>
              <option value="GENERIC">JSON</option>
            </Select>
          </Field>
        </div>
        <Field
          label="URL"
          hint={format === 'SLACK' ? 'A Slack incoming webhook URL (https://hooks.slack.com/services/…).' : 'Receives a signed JSON POST for each event.'}
        >
          <Input id="webhook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="font-mono" />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-soft">Events</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {events.map((event) => (
              <Checkbox
                key={event.code}
                label={event.label}
                checked={selected.includes(event.code)}
                onChange={(checked) => setSelected(checked ? [...selected, event.code] : selected.filter((c) => c !== event.code))}
              />
            ))}
          </div>
        </div>
        <ErrorBanner error={create.error ?? update.error} />
      </form>
    </Dialog>
  )
}

function SecretDialog({ created, onClose }: { created: CreatedWebhook; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`Webhook ${created.webhook.name} created`} footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-4 text-sm">
        <p className="flex items-start gap-2 rounded-md border border-kto-yellow/40 bg-kto-yellow/10 px-3 py-2 text-soft">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-kto-yellow" />
          This is the signing secret. Store it where the receiver can read it: it is not shown again.
        </p>
        <div className="flex items-center gap-2">
          <WebhookIcon className="size-4 text-kto-red" />
          <Code value={created.secret} />
        </div>
        <p className="text-xs text-muted">
          Every request carries <span className="font-mono">X-Ktoggle-Signature: sha256=HMAC(secret, timestamp + "." + body)</span> and{' '}
          <span className="font-mono">X-Ktoggle-Timestamp</span>. Reject old timestamps and de-duplicate on{' '}
          <span className="font-mono">X-Ktoggle-Delivery</span>.
        </p>
      </div>
    </Dialog>
  )
}
