import { clsx } from 'clsx'
import { Check, Play, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReplay, useReplayAt, useSdkConnections } from '@/api/hooks'
import type { Json, ReplayResult } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Badge, Card, Code, ErrorBanner, PageHeader, Table, ValueChip, formatDate } from '@/components/ui/Display'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'

type Mode = 'bundle' | 'instant'

function parseAttributes(text: string): { value?: Json; error?: string } {
  try {
    const value = JSON.parse(text || '{}') as Json
    return { value }
  } catch (e) {
    return { error: `JSON de atributos inválido: ${e instanceof Error ? e.message : String(e)}` }
  }
}

function ResultCard({ replay }: { replay: ReplayResult }) {
  const { result } = replay
  const rows: [string, React.ReactNode][] = [
    ['Origem (source)', <span key="s" className="font-mono text-xs">{result.source ?? '—'}</span>],
    ['Regra (ruleId)', <span key="r" className="font-mono text-xs">{result.ruleId ?? '—'}</span>],
    ['Revisão da feature', <span key="f" className="font-mono text-xs font-semibold text-kto-yellow">{replay.featureRevision ?? '—'}</span>],
    ['Avaliador', <span key="e" className="font-mono text-xs">{result.evaluator} (bundle: {replay.bundleEvaluator})</span>],
    ['Bundle', <Code key="b" value={replay.bundleHash} short />],
    ['Client key', <Code key="c" value={replay.clientKey} />],
    ['Digest dos atributos', <Code key="d" value={replay.attributesDigest} short />],
  ]
  if (replay.activation) {
    rows.push([
      'Ativação',
      <span key="a" className="text-sm">
        #{replay.activation.position} · {replay.activation.kind} · {formatDate(replay.activation.activatedAt)} · {replay.activation.activatedBy}
      </span>,
    ])
  }
  return (
    <Card title={`Resultado: ${result.featureKey}`}>
      <div className="mb-5 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-muted">Valor</span>
        <span className="scale-150 origin-left"><ValueChip value={result.value} /></span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-soft">Trace das regras</h3>
      {result.trace.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma regra avaliada: valor padrão.</p>
      ) : (
        <Table head={['Regra', 'Tipo', 'Condição atendida', 'Selecionada']}>
          {result.trace.map((t) => (
            <tr key={t.ruleId} className={clsx(t.selected && 'outline outline-2 -outline-offset-2 outline-kto-red')}>
              <td className="px-4 py-3 font-mono text-xs">{t.ruleId}</td>
              <td className="px-4 py-3"><Badge tone="outline">{t.type}</Badge></td>
              <td className="px-4 py-3">
                {t.conditionMatched ? <Check className="size-4 text-kto-green" aria-label="sim" /> : <X className="size-4 text-muted" aria-label="não" />}
              </td>
              <td className="px-4 py-3">{t.selected ? <Badge tone="red">selecionada</Badge> : <span className="text-muted">—</span>}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}

export function ReplayPage() {
  const [params] = useSearchParams()
  const connections = useSdkConnections()
  const replay = useReplay()
  const replayAt = useReplayAt()

  const [mode, setMode] = useState<Mode>('bundle')
  const [bundleHash, setBundleHash] = useState(params.get('bundle') ?? '')
  const [featureKey, setFeatureKey] = useState(params.get('feature') ?? '')
  const [clientKey, setClientKey] = useState(params.get('clientKey') ?? '')
  const [instant, setInstant] = useState('')
  const [attributes, setAttributes] = useState('{\n  "id": "user-123",\n  "country": "BR"\n}')
  const [localError, setLocalError] = useState<string | null>(null)

  const active = mode === 'bundle' ? replay : replayAt

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    const parsed = parseAttributes(attributes)
    if (parsed.error || parsed.value === undefined) {
      setLocalError(parsed.error ?? 'Atributos inválidos')
      return
    }
    if (mode === 'bundle') {
      replay.mutate({ bundleHash: bundleHash.trim(), featureKey: featureKey.trim(), attributes: parsed.value })
    } else {
      replayAt.mutate({ clientKey, instant: new Date(instant).toISOString(), featureKey: featureKey.trim(), attributes: parsed.value })
    }
  }

  const ready = featureKey.trim() && (mode === 'bundle' ? bundleHash.trim() : clientKey && instant)

  return (
    <>
      <PageHeader
        title="Replay"
        subtitle="O replay reproduz uma decisão do passado a partir do bundle imutável, independente da configuração atual."
      />
      <div className="mb-4 flex gap-1" role="tablist">
        {([['bundle', 'Por bundle'], ['instant', 'Por instante']] as const).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={clsx('rounded-md px-3 py-1.5 text-sm font-semibold', mode === m ? 'bg-kto-red text-white' : 'text-soft hover:bg-surface-2')}
          >
            {label}
          </button>
        ))}
      </div>
      <Card className="mb-6">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {mode === 'bundle' ? (
            <Field label="Hash do bundle">
              <Input value={bundleHash} onChange={(e) => setBundleHash(e.target.value)} className="font-mono" />
            </Field>
          ) : (
            <>
              <Field label="Conexão SDK">
                <Select value={clientKey} onChange={(e) => setClientKey(e.target.value)}>
                  <option value="">Selecione…</option>
                  {connections.data?.map((c) => <option key={c.clientKey} value={c.clientKey}>{c.name} ({c.environmentKey})</option>)}
                </Select>
              </Field>
              <Field label="Instante" hint="Fuso horário local; enviado em ISO-8601 (UTC).">
                <Input type="datetime-local" step={1} value={instant} onChange={(e) => setInstant(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Feature">
            <Input value={featureKey} onChange={(e) => setFeatureKey(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Atributos (JSON)" className="md:col-span-2">
            <Textarea rows={5} value={attributes} onChange={(e) => setAttributes(e.target.value)} spellCheck={false} />
          </Field>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" loading={active.isPending} disabled={!ready}>
              <Play className="size-4" /> Reproduzir
            </Button>
            {localError && <span className="text-sm text-kto-red">{localError}</span>}
          </div>
        </form>
      </Card>
      <ErrorBanner error={active.error} />
      {active.data && <ResultCard replay={active.data} />}
    </>
  )
}
