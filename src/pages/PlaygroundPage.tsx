import { GrowthBook } from '@growthbook/growthbook'
import { clsx } from 'clsx'
import { Plug, PlugZap, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSdkConnections } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Table, ValueChip } from '@/components/ui/Display'
import { Field, Select, Textarea } from '@/components/ui/Form'
import { config } from '@/config'

type Status = 'idle' | 'connecting' | 'connected' | 'error'

interface Row {
  key: string
  value: unknown
  source: string
  ruleId: string
}

interface LogEntry {
  at: Date
  message: string
}

const DEFAULT_ATTRIBUTES = '{\n  "id": "user-123",\n  "country": "BR"\n}'
const FLASH_MS = 1500

function parseAttributes(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text || '{}')
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Os atributos devem ser um objeto JSON.')
  return value as Record<string, unknown>
}

const STATUS_BADGE: Record<Status, { tone: 'neutral' | 'yellow' | 'green' | 'red'; label: string }> = {
  idle: { tone: 'neutral', label: 'Desconectado' },
  connecting: { tone: 'yellow', label: 'Conectando…' },
  connected: { tone: 'green', label: 'Conectado · SSE ativo' },
  error: { tone: 'red', label: 'Erro' },
}

export function PlaygroundPage() {
  const connections = useSdkConnections()
  const [clientKey, setClientKey] = useState('')
  const [attributesText, setAttributesText] = useState(DEFAULT_ATTRIBUTES)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<unknown>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [flashing, setFlashing] = useState<Record<string, number>>({})
  const [log, setLog] = useState<LogEntry[]>([])

  const gbRef = useRef<GrowthBook | null>(null)
  const previous = useRef<Map<string, string>>(new Map())
  const initialRead = useRef(true)

  const addLog = useCallback((message: string) => {
    setLog((current) => [{ at: new Date(), message }, ...current].slice(0, 100))
  }, [])

  /** Reads the payload and evaluates every feature; logs and flashes whatever changed since the last read. */
  const refresh = useCallback(() => {
    const gb = gbRef.current
    if (!gb) return
    const next: Row[] = Object.keys(gb.getFeatures())
      .sort()
      .map((key) => {
        const result = gb.evalFeature(key)
        return { key, value: result.value, source: result.source, ruleId: result.ruleId }
      })
    const changed: string[] = []
    const seen = new Set<string>()
    next.forEach((row) => {
      seen.add(row.key)
      const fingerprint = JSON.stringify([row.value, row.source, row.ruleId])
      const before = previous.current.get(row.key)
      if (before !== fingerprint) {
        previous.current.set(row.key, fingerprint)
        if (!initialRead.current) {
          changed.push(row.key)
          addLog(
            before === undefined
              ? `${row.key}: nova feature (${JSON.stringify(row.value)})`
              : `${row.key}: ${JSON.stringify(JSON.parse(before)[0])} → ${JSON.stringify(row.value)}`,
          )
        }
      }
    })
    previous.current.forEach((_, key) => {
      if (!seen.has(key)) {
        previous.current.delete(key)
        if (!initialRead.current) addLog(`${key}: removida do payload`)
      }
    })
    initialRead.current = false
    setRows((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
    if (changed.length > 0) {
      const now = Date.now()
      setFlashing((current) => ({ ...current, ...Object.fromEntries(changed.map((k) => [k, now])) }))
      setTimeout(() => {
        setFlashing((current) => {
          const copy = { ...current }
          changed.forEach((k) => {
            if (copy[k] === now) delete copy[k]
          })
          return copy
        })
      }, FLASH_MS)
    }
  }, [addLog])

  const disconnect = useCallback(() => {
    gbRef.current?.destroy()
    gbRef.current = null
    setStatus('idle')
  }, [])

  const connect = async () => {
    setError(null)
    let attributes: Record<string, unknown>
    try {
      attributes = parseAttributes(attributesText)
    } catch (e) {
      setError(e)
      return
    }
    gbRef.current?.destroy()
    previous.current = new Map()
    initialRead.current = true
    setRows([])
    setLog([])
    setStatus('connecting')
    const gb = new GrowthBook({ apiHost: config.apiUrl, clientKey, attributes })
    gbRef.current = gb
    gb.subscribe(() => {
      if (gbRef.current !== gb) return
      addLog('Atualização recebida do servidor')
      refresh()
    })
    try {
      const response = await gb.init({ streaming: true })
      if (gbRef.current !== gb) return
      if (!response.success) throw response.error ?? new Error('Falha ao carregar as features')
      setStatus('connected')
      addLog(`Conectado a ${clientKey}`)
      refresh()
    } catch (e) {
      if (gbRef.current !== gb) return
      setError(e)
      setStatus('error')
      gb.destroy()
      gbRef.current = null
    }
  }

  const applyAttributes = async () => {
    const gb = gbRef.current
    if (!gb) return
    try {
      await gb.setAttributes(parseAttributes(attributesText))
      setError(null)
      addLog('Atributos atualizados')
      refresh()
    } catch (e) {
      setError(e)
    }
  }

  // Poll the SDK state every 500ms as a safety net next to the subscription (SSE pushes arrive via subscribe).
  useEffect(() => {
    if (status !== 'connected') return
    const id = setInterval(refresh, 500)
    return () => clearInterval(id)
  }, [status, refresh])

  useEffect(() => () => gbRef.current?.destroy(), [])

  const connected = status === 'connected'
  const busy = status === 'connecting'
  const badge = STATUS_BADGE[status]

  return (
    <>
      <PageHeader
        title="Playground"
        subtitle="Conecta um SDK real (@growthbook/growthbook) a uma conexão e mostra as features avaliadas ao vivo."
        actions={<Badge tone={badge.tone} className="px-2.5 py-1 text-xs">{badge.label}</Badge>}
      />
      <div className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-soft">
        Dica: abra a página de Features em outra aba e altere uma flag para ver a mudança chegar via SSE.
      </div>
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card title="Conexão">
          <div className="space-y-4">
            <Field label="Conexão SDK">
              <Select value={clientKey} onChange={(e) => setClientKey(e.target.value)} disabled={connected || busy}>
                <option value="">Selecione…</option>
                {connections.data?.map((c) => <option key={c.clientKey} value={c.clientKey}>{c.name} ({c.environmentKey})</option>)}
              </Select>
            </Field>
            <Field label="Atributos (JSON)">
              <Textarea rows={6} value={attributesText} onChange={(e) => setAttributesText(e.target.value)} spellCheck={false} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {!connected ? (
                <Button onClick={connect} loading={busy} disabled={!clientKey}>
                  <PlugZap className="size-4" /> Conectar
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={applyAttributes}><RefreshCw className="size-4" /> Atualizar atributos</Button>
                  <Button variant="danger" onClick={disconnect}><Plug className="size-4" /> Desconectar</Button>
                </>
              )}
            </div>
            <ErrorBanner error={error} />
          </div>
        </Card>
        <div className="min-w-0 space-y-6">
          <Card title={`Features avaliadas${connected ? ` (${rows.length})` : ''}`}>
            {!connected && <EmptyState title="Conecte para ver as features">O payload é carregado e mantido em tempo real por SSE.</EmptyState>}
            {connected && rows.length === 0 && <EmptyState title="O payload não tem features" />}
            {connected && rows.length > 0 && (
              <Table head={['Feature', 'Valor', 'Source', 'Regra']}>
                {rows.map((r) => (
                  <tr key={r.key} className={clsx('transition-colors duration-700', flashing[r.key] ? 'bg-kto-red/30' : 'bg-transparent')}>
                    <td className="px-4 py-3 font-mono text-xs">{r.key}</td>
                    <td className="px-4 py-3"><ValueChip value={r.value} /></td>
                    <td className="px-4 py-3"><Badge tone="outline">{r.source}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{r.ruleId || '—'}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Card title="Log de eventos">
            {log.length === 0 ? (
              <p className="text-sm text-muted">Sem eventos ainda.</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-auto font-mono text-xs">
                {log.map((entry, i) => (
                  <li key={`${entry.at.getTime()}-${i}`} className="flex gap-3">
                    <span className="shrink-0 text-muted">{entry.at.toLocaleTimeString('pt-BR')}</span>
                    <span className="text-soft">{entry.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
