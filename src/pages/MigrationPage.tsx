import { clsx } from 'clsx'
import { ArrowRightLeft, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useImport, useMigrationStatus, useRunShadow, useShadowRuns, useShadowStatus } from '@/api/hooks'
import type { ImportAction, ImportReport, ShadowConnectionStatus, ShadowStatus } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Card, Code, EmptyState, ErrorBanner, formatDate, JsonBlock, PageHeader, Spinner, ValueChip } from '@/components/ui/Display'
import { Input } from '@/components/ui/Form'

const ACTION_TONE: Record<ImportAction, 'green' | 'yellow' | 'neutral' | 'red' | 'outline'> = {
  CREATE: 'green',
  UPDATE: 'yellow',
  UNCHANGED: 'outline',
  UNSUPPORTED: 'neutral',
  FAILED: 'red',
}

const STATUS_TONE: Record<ShadowStatus, 'green' | 'red' | 'neutral' | 'yellow'> = {
  MATCH: 'green',
  DIVERGENT: 'red',
  NOT_IN_GROWTHBOOK: 'neutral',
  NOT_IN_KTOGGLE: 'yellow',
  ERROR: 'red',
}

const STATUS_LABEL: Record<ShadowStatus, string> = {
  MATCH: 'match',
  DIVERGENT: 'divergent',
  NOT_IN_GROWTHBOOK: 'not in GrowthBook',
  NOT_IN_KTOGGLE: 'not published in ktoggle',
  ERROR: 'error',
}

/**
 * Migration from an existing GrowthBook: import its configuration, then prove, client key by client key, that
 * ktoggle serves the same values (shadow mode) before any consumer is switched. Read-only towards GrowthBook.
 */
export function MigrationPage() {
  const { can } = useAuth()
  const status = useMigrationStatus()

  if (!can('ktoggle-admin')) return <EmptyState title="Admins only">The GrowthBook migration is run by ktoggle admins.</EmptyState>
  if (status.isLoading) return <Spinner />

  const s = status.data
  return (
    <>
      <PageHeader
        title="GrowthBook migration"
        subtitle="Import GrowthBook's configuration, then compare both systems in shadow mode until every client key matches."
      />
      <ErrorBanner error={status.error} />
      {s && (
        <div className="space-y-6">
          <Card title="Connection to GrowthBook">
            {s.configured ? (
              <dl className="grid gap-4 text-sm sm:grid-cols-4">
                <Field label="API host"><span className="font-mono text-xs">{s.apiHost}</span></Field>
                <Field label="Import">{s.canImport ? <Badge tone="green">ready</Badge> : <Badge>needs a secret key</Badge>}</Field>
                <Field label="Shadow mode">
                  {s.shadowEnabled ? <Badge tone="green">every {s.shadowInterval.replace('PT', '').toLowerCase()}</Badge> : <Badge>on demand</Badge>}
                </Field>
                <Field label="Ready to migrate after"><span className="font-mono text-kto-yellow">{s.readyAfter}</span> clean runs of {s.samples} users</Field>
              </dl>
            ) : (
              <p className="text-sm text-soft">
                Not configured, so ktoggle never calls GrowthBook. Set <code className="font-mono text-xs">KTOGGLE_GROWTHBOOK_API_HOST</code> and a
                read-only <code className="font-mono text-xs">KTOGGLE_GROWTHBOOK_SECRET_KEY</code> to enable the import and the shadow comparison.
              </p>
            )}
          </Card>
          {s.configured && s.canImport && <ImportCard />}
          {s.configured && <ShadowCard readyAfter={s.readyAfter} />}
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  )
}

function ImportCard() {
  const run = useImport()
  const [mapping, setMapping] = useState<{ from: string; to: string }[]>([])
  const [report, setReport] = useState<ImportReport | null>(null)
  const [confirm, setConfirm] = useState(false)
  const environmentMapping = Object.fromEntries(mapping.filter((m) => m.from.trim() && m.to.trim()).map((m) => [m.from.trim(), m.to.trim()]))

  const execute = (dryRun: boolean) =>
    run.mutate({ dryRun, environmentMapping }, { onSuccess: (r) => { setReport(r); setConfirm(false) } })

  return (
    <Card
      title={<span className="flex items-center gap-2"><Upload className="size-4 text-kto-red" /> Import</span>}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={run.isPending && !confirm} onClick={() => execute(true)}>Dry run</Button>
          <Button size="sm" disabled={!report?.dryRun} onClick={() => setConfirm(true)}>Import</Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-soft">
          Reads projects, environments, attributes, saved groups, features and SDK connections. Client keys, rule ids, rollout seeds and
          experiment hashing are kept, so users keep their values and variations. Run a dry run first; importing again only applies what
          changed.
        </p>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-soft">Environment mapping (optional)</p>
          {mapping.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="max-w-48" placeholder="GrowthBook (e.g. production)" value={m.from}
                onChange={(e) => setMapping(mapping.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} aria-label="GrowthBook environment" />
              <ArrowRightLeft className="size-4 text-muted" />
              <Input className="max-w-48" placeholder="ktoggle (e.g. prd)" value={m.to}
                onChange={(e) => setMapping(mapping.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} aria-label="ktoggle environment" />
              <button type="button" aria-label="Remove mapping" className="rounded p-1.5 text-muted hover:text-kto-red"
                onClick={() => setMapping(mapping.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setMapping([...mapping, { from: '', to: '' }])}><Plus className="size-3.5" /> Map an environment</Button>
          <p className="text-xs text-muted">Unmapped GrowthBook environments are imported under their own name.</p>
        </div>
        <ErrorBanner error={run.error} />
        {report && <ReportView report={report} />}
      </div>
      {confirm && (
        <Dialog
          open
          onOpenChange={(open) => !open && setConfirm(false)}
          title="Import from GrowthBook?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
              <Button loading={run.isPending} onClick={() => execute(false)}>Import now</Button>
            </>
          }
        >
          <p className="text-sm text-soft">
            Creates and updates what the dry run listed. Features are published directly (audited as an import) and SDK connections keep
            their client keys. GrowthBook itself is not changed.
          </p>
        </Dialog>
      )}
    </Card>
  )
}

function ReportView({ report }: { report: ImportReport }) {
  const [showUnchanged, setShowUnchanged] = useState(false)
  const items = report.items.filter((i) => showUnchanged || i.action !== 'UNCHANGED')
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-soft">{report.dryRun ? 'Dry run' : 'Imported'}</span>
        {(Object.keys(report.totals) as ImportAction[]).map((a) => (
          <Badge key={a} tone={ACTION_TONE[a]}>{a.toLowerCase()} <span className="font-mono">{report.totals[a]}</span></Badge>
        ))}
        <button type="button" className="ml-auto text-xs text-muted hover:text-white" onClick={() => setShowUnchanged(!showUnchanged)}>
          {showUnchanged ? 'Hide unchanged' : 'Show unchanged'}
        </button>
      </div>
      <div className="max-h-96 overflow-auto rounded-md border border-line">
        <table className="w-full text-left text-sm">
          <tbody>
            {items.map((item) => (
              <tr key={item.type + item.key} className="border-b border-line last:border-0">
                <td className="px-3 py-2 text-xs text-muted">{item.type}</td>
                <td className="px-3 py-2 font-mono text-xs text-white">{item.key}</td>
                <td className="px-3 py-2"><Badge tone={ACTION_TONE[item.action]}>{item.action.toLowerCase()}</Badge></td>
                <td className="px-3 py-2 text-xs text-soft">{item.messages.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ShadowCard({ readyAfter }: { readyAfter: number }) {
  const status = useShadowStatus()
  const run = useRunShadow()
  const [open, setOpen] = useState<string | null>(null)
  const ready = status.data?.filter((c) => c.ready).length ?? 0
  const compared = status.data?.filter((c) => c.lastRun && c.lastRun.status !== 'NOT_IN_GROWTHBOOK').length ?? 0

  return (
    <Card
      title={<span className="flex items-center gap-2"><ArrowRightLeft className="size-4 text-kto-red" /> Shadow mode</span>}
      actions={<Button size="sm" variant="secondary" loading={run.isPending} onClick={() => run.mutate(undefined)}><RefreshCw className="size-3.5" /> Compare now</Button>}
    >
      <p className="mb-4 text-sm text-soft">
        For each client key, both GrowthBook's payload and ktoggle's are evaluated with the official SDK for the same simulated users.
        A connection is ready to migrate after {readyAfter} clean runs in a row.{' '}
        {compared > 0 && <span className="text-white"><span className="font-mono text-kto-yellow">{ready}</span> of {compared} compared connections ready.</span>}
      </p>
      <ErrorBanner error={status.error ?? run.error} />
      {status.isLoading && <Spinner />}
      {status.data && (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Connection</th>
                <th className="px-3 py-2">Last comparison</th>
                <th className="px-3 py-2">Divergent features</th>
                <th className="px-3 py-2">Clean streak</th>
                <th className="px-3 py-2">Migration</th>
              </tr>
            </thead>
            <tbody>
              {status.data.map((c) => (
                <Fragment key={c.clientKey}>
                  <ShadowRow connection={c} open={open === c.clientKey} onToggle={() => setOpen(open === c.clientKey ? null : c.clientKey)} />
                  {open === c.clientKey && (
                    <tr>
                      <td colSpan={6} className="bg-ink/50 px-4 py-4"><RunHistory clientKey={c.clientKey} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function ShadowRow({ connection: c, open, onToggle }: { connection: ShadowConnectionStatus; open: boolean; onToggle: () => void }) {
  const last = c.lastRun
  return (
    <tr className="border-t border-line hover:bg-surface-2/40">
      <td className="px-3 py-2">
        <button type="button" aria-label={`Details of ${c.name}`} onClick={onToggle} className="text-muted hover:text-white">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </td>
      <td className="px-3 py-2">
        <p className="font-semibold">{c.name}</p>
        <p className="font-mono text-[0.6875rem] text-muted">{c.clientKey} · {c.environmentKey}</p>
      </td>
      <td className="px-3 py-2">
        {last ? (
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[last.status]}>{STATUS_LABEL[last.status]}</Badge>
            <span className="text-xs text-muted">{formatDate(last.startedAt)}</span>
          </span>
        ) : <span className="text-xs text-muted">never</span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{last ? <span className={last.divergentFeatures ? 'text-kto-red' : 'text-kto-yellow'}>{last.divergentFeatures}</span> : '—'}</td>
      <td className="px-3 py-2 font-mono text-xs text-kto-yellow">{c.cleanStreak}/{c.readyAfter}</td>
      <td className="px-3 py-2">
        {c.ready ? (
          <Badge tone="green"><CheckCircle2 className="size-3" /> ready to migrate</Badge>
        ) : last?.status === 'NOT_IN_GROWTHBOOK' ? (
          <span className="text-xs text-muted">ktoggle only</span>
        ) : (
          <Badge><CircleAlert className="size-3" /> not yet</Badge>
        )}
      </td>
    </tr>
  )
}

function RunHistory({ clientKey }: { clientKey: string }) {
  const runs = useShadowRuns(clientKey)
  if (runs.isLoading) return <Spinner />
  if (!runs.data?.length) return <p className="text-sm text-muted">No comparisons yet.</p>
  const latest = runs.data[0]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {runs.data.map((r) => (
          <span key={r.id} title={`${formatDate(r.startedAt)} · ${r.triggeredBy}`}
            className={clsx('size-3 rounded-sm', r.status === 'MATCH' ? 'bg-kto-green' : r.status === 'NOT_IN_GROWTHBOOK' ? 'bg-surface-3' : 'bg-kto-red')} />
        ))}
        <span className="text-xs text-muted">last {runs.data.length} runs, newest first</span>
      </div>
      <p className="text-xs text-muted">
        Latest: {latest.samples} simulated users × {latest.featuresCompared} features in {latest.durationMs} ms
        {latest.bundleHash && <> · ktoggle bundle <Code value={latest.bundleHash} short /></>} · by {latest.triggeredBy}
      </p>
      {latest.error && <p className="text-sm text-kto-red">{latest.error}</p>}
      {latest.divergences.map((d) => (
        <div key={d.featureKey} className="rounded-md border border-kto-red/40 p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono font-semibold text-white">{d.featureKey}</span>
            <Badge tone="red">{d.kind === 'VALUE' ? `${d.divergingSamples} of ${latest.samples} users differ` : d.kind === 'MISSING_IN_KTOGGLE' ? 'missing in ktoggle' : 'missing in GrowthBook'}</Badge>
          </p>
          {d.examples.length > 0 && (
            <div className="mt-2 grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
              <span className="text-[0.6875rem] uppercase tracking-wide text-muted">Simulated user</span>
              <span className="text-[0.6875rem] uppercase tracking-wide text-muted">GrowthBook</span>
              <span className="text-[0.6875rem] uppercase tracking-wide text-muted">ktoggle</span>
              {d.examples.map((e, i) => (
                <Fragment key={i}>
                  <JsonBlock value={e.attributes} />
                  <span><ValueChip value={e.growthbook} /></span>
                  <span><ValueChip value={e.ktoggle} /></span>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
