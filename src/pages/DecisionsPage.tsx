import { CheckCircle2, Play, ShieldCheck, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDecisions, useSdkConnections, useVerifyDecisionAttributes, type DecisionFilter } from '@/api/hooks'
import type { DecisionEvent, Json } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Code, EmptyState, ErrorBanner, PageHeader, Spinner, Table, ValueChip, formatDate } from '@/components/ui/Display'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'

function VerifyDialog({ event, onClose }: { event: DecisionEvent; onClose: () => void }) {
  const verify = useVerifyDecisionAttributes()
  const [text, setText] = useState('{\n  \n}')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    try {
      verify.mutate({ eventId: event.eventId, attributes: JSON.parse(text) as Json })
    } catch (err) {
      setLocalError(`JSON inválido: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Verificar atributos"
      description="Informe os atributos completos (inclusive PII) do usuário; o digest HMAC é recalculado e comparado ao registrado na decisão, sem que o dado em claro seja armazenado."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button type="submit" form="verify-form" loading={verify.isPending}><ShieldCheck className="size-4" /> Verificar</Button>
        </>
      }
    >
      <form id="verify-form" onSubmit={submit} className="space-y-4">
        <Field label="Atributos (JSON)">
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoFocus />
        </Field>
        {localError && <p className="text-sm text-kto-red">{localError}</p>}
        <ErrorBanner error={verify.error} />
        {verify.data &&
          (verify.data.matches ? (
            <div className="flex items-center gap-3 rounded-md border border-kto-green/40 bg-kto-green/10 px-4 py-4 text-lg font-bold text-kto-green">
              <CheckCircle2 className="size-7" /> Os atributos conferem
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-kto-red/50 bg-kto-red/10 px-4 py-4 text-lg font-bold text-kto-red">
              <XCircle className="size-7" /> Não conferem
            </div>
          ))}
      </form>
    </Dialog>
  )
}

function Attributes({ attributes }: { attributes: Record<string, Json> }) {
  const entries = Object.entries(attributes)
  if (entries.length === 0) return <span className="text-muted">—</span>
  return (
    <span className="font-mono text-xs text-soft">
      {entries.map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ')}
    </span>
  )
}

export function DecisionsPage() {
  const navigate = useNavigate()
  const connections = useSdkConnections()
  const [draft, setDraft] = useState({ clientKey: '', featureKey: '', bundleHash: '' })
  const [filter, setFilter] = useState<DecisionFilter>({ limit: 100 })
  const [verifying, setVerifying] = useState<DecisionEvent | null>(null)
  const decisions = useDecisions(filter)

  const apply = (e: FormEvent) => {
    e.preventDefault()
    setFilter({
      clientKey: draft.clientKey || undefined,
      featureKey: draft.featureKey.trim() || undefined,
      bundleHash: draft.bundleHash.trim() || undefined,
      limit: 100,
    })
  }

  return (
    <>
      <PageHeader
        title="Decisões"
        subtitle="Eventos opt-in enviados pelos callbacks de feature-usage dos SDKs. Só atributos não-PII ficam em claro; os demais entram apenas como digest HMAC."
      />
      <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Conexão SDK" className="w-56">
          <Select value={draft.clientKey} onChange={(e) => setDraft({ ...draft, clientKey: e.target.value })}>
            <option value="">Todas</option>
            {connections.data?.map((c) => <option key={c.clientKey} value={c.clientKey}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Feature" className="w-56">
          <Input value={draft.featureKey} onChange={(e) => setDraft({ ...draft, featureKey: e.target.value })} />
        </Field>
        <Field label="Hash do bundle" className="w-64">
          <Input value={draft.bundleHash} onChange={(e) => setDraft({ ...draft, bundleHash: e.target.value })} className="font-mono" />
        </Field>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>
      {decisions.isLoading && <Spinner />}
      <ErrorBanner error={decisions.error} />
      {decisions.data?.length === 0 && <EmptyState title="Nenhuma decisão registrada" />}
      {decisions.data && decisions.data.length > 0 && (
        <Table head={['Quando', 'Client key', 'Feature', 'Valor', 'Regra', 'SDK', 'Bundle', 'Atributos (não-PII)', '']}>
          {decisions.data.map((d) => (
            <tr key={d.eventId} className="hover:bg-surface">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(d.occurredAt)}</td>
              <td className="px-4 py-3"><Code value={d.clientKey} short /></td>
              <td className="px-4 py-3 font-mono text-xs">{d.featureKey}</td>
              <td className="px-4 py-3"><ValueChip value={d.value} /></td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{d.ruleId ?? d.source ?? '—'}</td>
              <td className="px-4 py-3 text-muted">{d.sdk || '—'}</td>
              <td className="px-4 py-3"><Code value={d.bundleHash} short /></td>
              <td className="px-4 py-3"><Attributes attributes={d.attributes} /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/replay?bundle=${encodeURIComponent(d.bundleHash)}&feature=${encodeURIComponent(d.featureKey)}`)}
                  >
                    <Play className="size-3.5" /> Reproduzir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setVerifying(d)}>Verificar atributos</Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {verifying && <VerifyDialog event={verifying} onClose={() => setVerifying(null)} />}
    </>
  )
}
