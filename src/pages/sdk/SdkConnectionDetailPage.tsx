import { clsx } from 'clsx'
import { ArrowLeft, Lock, RotateCcw, Server, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useActivations,
  useBundle,
  useDecryptionKey,
  useDeliveries,
  useRollback,
  useRotateKey,
  useSdkConnection,
  useSetDelivery,
  useUnpin,
  useVerifyActivations,
} from '@/api/hooks'
import type { BundleActivation, SdkConnection } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Card, Code, EmptyState, ErrorBanner, JsonBlock, PageHeader, Spinner, Table, formatDate } from '@/components/ui/Display'
import { Toggle } from '@/components/ui/Toggle'
import { config } from '@/config'

type SnippetTab = 'java' | 'javascript' | 'react'

/** {@code encrypted}: the snippets pass the decryption key (shown as a placeholder; admins reveal it below). */
function snippets(clientKey: string, encrypted: boolean, remoteEval: boolean): Record<SnippetTab, string> {
  const api = config.apiUrl
  const key = remoteEval ? '\n  remoteEval: true, // values are computed by ktoggle; rules never reach the browser' : encrypted ? "\n  decryptionKey: '<DECRYPTION_KEY>'," : ''
  return {
    java: `// growthbook-sdk-java
GBFeaturesRepository repository = GBFeaturesRepository.builder()
    .apiHost("${api}")
    .clientKey("${clientKey}")${encrypted ? '\n    .decryptionKey("<DECRYPTION_KEY>")' : ''}
    .refreshStrategy(FeatureRefreshStrategy.SERVER_SENT_EVENTS)
    .build();
repository.initialize();

GBContext context = GBContext.builder()
    .featuresJson(repository.getFeaturesJson())
    .attributesJson("{\\"id\\":\\"user-123\\",\\"country\\":\\"BR\\"}")
    .build();

GrowthBook growthBook = new GrowthBook(context);
boolean enabled = growthBook.isOn("my-feature");`,
    javascript: `// npm i @growthbook/growthbook
import { GrowthBook } from '@growthbook/growthbook'

const gb = new GrowthBook({
  apiHost: '${api}',
  clientKey: '${clientKey}',${key}
  attributes: { id: 'user-123', country: 'BR' },
})
await gb.init({ streaming: true })

if (gb.isOn('my-feature')) {
  // ...
}`,
    react: `// npm i @growthbook/growthbook-react
import { GrowthBook, GrowthBookProvider, useFeatureIsOn } from '@growthbook/growthbook-react'

const gb = new GrowthBook({
  apiHost: '${api}',
  clientKey: '${clientKey}',${key}
  attributes: { id: 'user-123', country: 'BR' },
})
gb.init({ streaming: true })

export function App() {
  return (
    <GrowthBookProvider growthbook={gb}>
      <Home />
    </GrowthBookProvider>
  )
}

function Home() {
  const enabled = useFeatureIsOn('my-feature')
  return enabled ? <NewHome /> : <OldHome />
}`,
  }
}

const TAB_LABELS: Record<SnippetTab, string> = { java: 'Java', javascript: 'JavaScript', react: 'React' }

function UsageCard({ clientKey, encrypted, remoteEval }: { clientKey: string; encrypted: boolean; remoteEval: boolean }) {
  const [tab, setTab] = useState<SnippetTab>('javascript')
  return (
    <Card title="How to use">
      <div className="mb-3 flex gap-1" role="tablist">
        {(Object.keys(TAB_LABELS) as SnippetTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-xs font-semibold',
              tab === t ? 'bg-kto-red text-white' : 'text-soft hover:bg-surface-2',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <pre className="overflow-auto rounded-md bg-ink p-3 font-mono text-xs leading-relaxed text-soft">{snippets(clientKey, encrypted, remoteEval)[tab]}</pre>
    </Card>
  )
}

/**
 * GrowthBook remote evaluation: the SDK posts the user's attributes and gets evaluated values only. Best for browsers
 * and apps where even encrypted rules should not ship. Experiments keep firing the tracking callback.
 */
function RemoteEvalCard({ connection }: { connection: SdkConnection }) {
  const { can } = useAuth()
  const admin = can('ktoggle-admin')
  const update = useSetDelivery()
  return (
    <Card
      title={<span className="flex items-center gap-2"><Server className="size-4 text-kto-red" /> Remote evaluation</span>}
      actions={admin && (
        <Toggle
          checked={connection.remoteEval}
          label="Remote evaluation"
          disabled={update.isPending || connection.encryptPayload}
          onChange={(remoteEval) => update.mutate({ ...connection, remoteEval })}
        />
      )}
    >
      <div className="space-y-3 text-sm">
        <p className="text-soft">
          {connection.remoteEval
            ? 'SDKs send the user attributes to ktoggle (POST /api/eval) and receive only the values. Rules, conditions and rollout plans never leave the server.'
            : 'SDKs download the rules and evaluate locally (fastest, works offline). Turn this on for browsers and apps where no rule should be visible.'}
        </p>
        {connection.encryptPayload && (
          <p className="text-xs text-kto-yellow">Turn payload encryption off to use remote evaluation.</p>
        )}
        <p className="text-xs text-muted">
          Values are evaluated with the official SDK against the active, verified bundle, so every answer is tied to a bundle hash
          and stays replayable. Backend services usually keep local evaluation.
        </p>
        <ErrorBanner error={update.error} />
      </div>
    </Card>
  )
}

/**
 * GrowthBook-style encrypted payloads: SDKs receive encryptedFeatures and decrypt them with the key. Bundles (the
 * audit record) stay in clear text, so replay and verification are unaffected.
 */
function EncryptionCard({ connection }: { connection: SdkConnection }) {
  const { can } = useAuth()
  const admin = can('ktoggle-admin')
  const setEncryption = useSetDelivery()
  const rotate = useRotateKey()
  const [revealed, setRevealed] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const key = useDecryptionKey(connection.clientKey, revealed && admin && connection.keyFingerprint != null)

  return (
    <Card
      title={<span className="flex items-center gap-2"><Lock className="size-4 text-kto-red" /> Payload encryption</span>}
      actions={admin && (
        <Toggle
          checked={connection.encryptPayload}
          label="Encrypt payload"
          disabled={setEncryption.isPending || connection.remoteEval}
          onChange={(encryptPayload) => setEncryption.mutate({ ...connection, encryptPayload }, { onSuccess: () => setRevealed(false) })}
        />
      )}
    >
      <div className="space-y-3 text-sm">
        <p className="text-soft">
          {connection.encryptPayload
            ? 'SDKs receive the features encrypted (AES) and decrypt them with the key below. Rules and values are not readable in browsers or app traffic.'
            : 'SDKs receive the features in clear text. Turn encryption on to hide rules and values from browsers and app traffic.'}
        </p>
        {connection.remoteEval && (
          <p className="text-xs text-kto-yellow">Not needed with remote evaluation: the rules never reach the SDK.</p>
        )}
        {connection.keyFingerprint && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted">key <span className="font-mono text-soft">#{connection.keyFingerprint}</span></span>
            {admin && !revealed && <Button size="sm" variant="secondary" onClick={() => setRevealed(true)}>Reveal key</Button>}
            {admin && revealed && key.data && <Code value={key.data.decryptionKey} />}
            {admin && <Button size="sm" variant="ghost" onClick={() => setConfirmRotate(true)}>Rotate key</Button>}
          </div>
        )}
        <p className="text-xs text-muted">
          The key ships inside your apps, so this hides details from casual inspection rather than from a determined attacker.
          Bundles stay in clear text: verification and replay are unaffected.
        </p>
        <ErrorBanner error={setEncryption.error ?? rotate.error ?? key.error} />
      </div>
      {confirmRotate && (
        <Dialog
          open
          onOpenChange={(open) => !open && setConfirmRotate(false)}
          title="Rotate the decryption key?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmRotate(false)}>Cancel</Button>
              <Button
                variant="danger"
                loading={rotate.isPending}
                onClick={() => rotate.mutate(connection.clientKey, { onSuccess: () => { setConfirmRotate(false); setRevealed(false) } })}
              >
                Rotate key
              </Button>
            </>
          }
        >
          <p className="text-sm text-soft">
            SDKs using the current key stop reading new payloads until they are updated with the new one. Rotate when the key has
            leaked, and roll the new key out to the apps right away.
          </p>
        </Dialog>
      )}
    </Card>
  )
}

function BundleDialog({ hash, onClose }: { hash: string; onClose: () => void }) {
  const bundle = useBundle(hash)
  const data = bundle.data
  const rows: [string, ReactNode][] = data
    ? [
        ['Hash', <Code key="h" value={data.bundle.hash} />],
        ['Signing key (keyId)', <span key="k" className="font-mono text-xs">{data.bundle.keyId}</span>],
        ['Algorithm', <span key="a" className="font-mono text-xs">{data.bundle.signatureAlg}</span>],
        ['Created at', formatDate(data.bundle.createdAt)],
        ['Created by', data.bundle.createdBy],
        [
          'Evaluator',
          <span key="e" className="font-mono text-xs">
            {data.body.evaluator.spec} · hash v{data.body.evaluator.hashVersion} · {data.body.evaluator.referenceEvaluator}
          </span>,
        ],
        [
          'Sources',
          <span key="s" className="font-mono text-xs">
            {Object.entries(data.body.sources).map(([k, v]) => `${k}@${v}`).join(', ') || '—'}
          </span>,
        ],
      ]
    : []
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Verified bundle" wide>
      {bundle.isLoading && <Spinner label="Verifying signature and hash…" />}
      {bundle.error && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-kto-red">Possible integrity violation: the bundle failed verification.</p>
          <ErrorBanner error={bundle.error} />
        </div>
      )}
      {data && (
        <div className="space-y-4">
          <Badge tone="green"><ShieldCheck className="size-3.5" /> Signature and hash verified</Badge>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-soft">Payload</h3>
            <JsonBlock value={data.body.payload} className="max-h-96" />
          </div>
        </div>
      )}
    </Dialog>
  )
}

function ActiveBundleCard({ clientKey, pinned, latest, onOpenBundle }: {
  clientKey: string
  pinned: boolean
  latest?: BundleActivation
  onOpenBundle: (hash: string) => void
}) {
  const { can } = useAuth()
  const unpin = useUnpin(clientKey)
  const [unpinning, setUnpinning] = useState(false)
  return (
    <Card title="Active bundle">
      {pinned && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-kto-red/50 bg-kto-red/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-semibold text-kto-red">
            <ShieldAlert className="size-4" /> Connection pinned: new publications are not delivered until the pin is released.
          </span>
          {can('ktoggle-admin') && <Button size="sm" variant="danger" onClick={() => setUnpinning(true)}>Release pin</Button>}
        </div>
      )}
      {!latest ? (
        <p className="text-sm text-muted">No activations yet.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Hash</dt>
          <dd>
            <span className="inline-flex items-center gap-2">
                  <Code value={latest.bundleHash} short />
                  <button onClick={() => onOpenBundle(latest.bundleHash)} className="text-xs text-kto-red hover:underline">view</button>
                </span>
          </dd>
          <dt className="text-muted">Kind</dt>
          <dd><KindBadge kind={latest.kind} /></dd>
          <dt className="text-muted">By</dt>
          <dd>{latest.activatedBy}</dd>
          <dt className="text-muted">When</dt>
          <dd>{formatDate(latest.activatedAt)}</dd>
          <dt className="text-muted">Reason</dt>
          <dd>{latest.reason || '—'}</dd>
        </dl>
      )}
      {unpinning && (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && setUnpinning(false)}
          title="Release the pinned connection?"
          description="The connection will receive the latest published bundle again."
          confirmLabel="Release"
          onConfirm={(reason) => unpin.mutateAsync({ reason })}
        />
      )}
    </Card>
  )
}

function KindBadge({ kind }: { kind: BundleActivation['kind'] }) {
  return <Badge tone={kind === 'ROLLBACK' ? 'red' : 'neutral'}>{kind}</Badge>
}

function IntegrityCard({ clientKey }: { clientKey: string }) {
  const verify = useVerifyActivations(clientKey)
  const v = verify.data
  return (
    <Card title="Integrity">
      {verify.isLoading && <Spinner label="Verifying chain…" />}
      <ErrorBanner error={verify.error} />
      {v && v.valid && (
        <p className="flex items-center gap-2 text-sm font-semibold text-kto-green">
          <ShieldCheck className="size-5" /> Chain verified · <span className="font-mono">{v.checked}</span> activations checked
        </p>
      )}
      {v && !v.valid && (
        <p className="flex items-center gap-2 text-sm font-semibold text-kto-red">
          <ShieldAlert className="size-5" /> Chain broken{v.brokenAt != null && <> at position <span className="font-mono">{v.brokenAt}</span></>}
          {v.message && <span className="font-normal text-soft">— {v.message}</span>}
        </p>
      )}
    </Card>
  )
}

function ActivationsCard({ clientKey, activations, onOpenBundle }: {
  clientKey: string
  activations: BundleActivation[]
  onOpenBundle: (hash: string) => void
}) {
  const { can } = useAuth()
  const rollback = useRollback(clientKey)
  const [target, setTarget] = useState<BundleActivation | null>(null)
  const sorted = [...activations].sort((a, b) => b.position - a.position)
  const currentHash = sorted[0]?.bundleHash

  return (
    <Card title="Activation history">
      {sorted.length === 0 ? (
        <EmptyState title="No activations" />
      ) : (
        <Table head={['#', 'Kind', 'Bundle', 'Activated by', 'When', 'Reason', '']}>
          {sorted.map((a) => (
            <tr key={a.id} className="hover:bg-surface-2/40">
              <td className="px-4 py-3 font-mono text-xs font-semibold text-kto-yellow">{a.position}</td>
              <td className="px-4 py-3"><KindBadge kind={a.kind} /></td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <Code value={a.bundleHash} short />
                  <button onClick={() => onOpenBundle(a.bundleHash)} className="text-xs text-kto-red hover:underline">view</button>
                </span>
              </td>
              <td className="px-4 py-3">{a.activatedBy}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(a.activatedAt)}</td>
              <td className="px-4 py-3 text-muted">{a.reason || '—'}</td>
              <td className="px-4 py-3 text-right">
                {a.bundleHash === currentHash ? (
                  <Badge tone="green">current</Badge>
                ) : (
                  can('ktoggle-admin') && (
                    <Button size="sm" variant="danger" onClick={() => setTarget(a)}>
                      <RotateCcw className="size-3.5" /> Roll back to this bundle
                    </Button>
                  )
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {target && (
        <ReasonDialog
          open
          required
          danger
          onOpenChange={(open) => !open && setTarget(null)}
          title="Roll back to this bundle"
          description={<>Bundle <Code value={target.bundleHash} short /> will be delivered to this connection's SDKs again (it stays pinned until released).</>}
          confirmLabel="Roll back"
          onConfirm={(reason) => rollback.mutateAsync({ hash: target.bundleHash, reason: reason ?? '' })}
        />
      )}
    </Card>
  )
}

function DeliveriesCard({ clientKey }: { clientKey: string }) {
  const deliveries = useDeliveries(clientKey)
  return (
    <Card title="Deliveries">
      {deliveries.isLoading && <Spinner />}
      <ErrorBanner error={deliveries.error} />
      {deliveries.data?.length === 0 && <EmptyState title="No deliveries recorded" />}
      {deliveries.data && deliveries.data.length > 0 && (
        <Table head={['Channel', 'Pod', 'SDK', 'Bundle', 'Deliveries', 'First seen', 'Last seen']}>
          {deliveries.data.map((d, i) => (
            <tr key={`${d.bundleHash}-${d.pod}-${d.channel}-${d.windowStart}-${i}`}>
              <td className="px-4 py-3"><Badge tone="outline">{d.channel}</Badge></td>
              <td className="px-4 py-3 font-mono text-xs">{d.pod}</td>
              <td className="px-4 py-3 text-muted">{d.sdkHint || '—'}</td>
              <td className="px-4 py-3"><Code value={d.bundleHash} short /></td>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-kto-yellow">{d.deliveries}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(d.firstSeen)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(d.lastSeen)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}

export function SdkConnectionDetailPage() {
  const { clientKey = '' } = useParams()
  const connection = useSdkConnection(clientKey)
  const activations = useActivations(clientKey)
  const [openBundle, setOpenBundle] = useState<string | null>(null)

  if (connection.isLoading) return <Spinner />
  if (connection.error || !connection.data) return <ErrorBanner error={connection.error ?? new Error('Connection not found')} />
  const c = connection.data
  const latest = activations.data?.reduce<BundleActivation | undefined>((best, a) => (!best || a.position > best.position ? a : best), undefined)

  return (
    <>
      <Link to="/sdk-connections" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-white">
        <ArrowLeft className="size-3.5" /> SDK connections
      </Link>
      <PageHeader
        title={c.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Code value={c.clientKey} />
            <Badge tone="outline">{c.environmentKey}</Badge>
            {c.projectKeys.map((p) => <Badge key={p}>{p}</Badge>)}
            {c.pinnedBundleHash && <Badge tone="red">PINNED</Badge>}
            {c.encryptPayload && <Badge tone="yellow"><Lock className="size-3" /> encrypted</Badge>}
            {c.remoteEval && <Badge tone="yellow"><Server className="size-3" /> remote evaluation</Badge>}
          </span>
        }
      />
      <div className="space-y-6">
        <UsageCard clientKey={c.clientKey} encrypted={c.encryptPayload} remoteEval={c.remoteEval} />
        <div className="grid gap-6 lg:grid-cols-2">
          <RemoteEvalCard connection={c} />
          <EncryptionCard connection={c} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ActiveBundleCard clientKey={c.clientKey} pinned={Boolean(c.pinnedBundleHash)} latest={latest} onOpenBundle={setOpenBundle} />
          <IntegrityCard clientKey={c.clientKey} />
        </div>
        {activations.isLoading && <Spinner />}
        <ErrorBanner error={activations.error} />
        {activations.data && <ActivationsCard clientKey={c.clientKey} activations={activations.data} onOpenBundle={setOpenBundle} />}
        <DeliveriesCard clientKey={c.clientKey} />
      </div>
      {openBundle && <BundleDialog hash={openBundle} onClose={() => setOpenBundle(null)} />}
    </>
  )
}
