import { CheckCircle2, CircleSlash, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useSimulate } from '@/api/hooks'
import type { EnvironmentSettings, Environment, Json } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Badge, Card, ErrorBanner, ValueChip } from '@/components/ui/Display'
import { Field, Select, Textarea } from '@/components/ui/Form'

/** "Test feature": evaluates the flag with the official GrowthBook SDK — live, or as the selected draft would be. */
export function TestPanel({ featureKey, environments, proposed }: {
  featureKey: string
  environments: Environment[]
  /** Environments of the selected draft: the test then evaluates what would be published. */
  proposed?: Record<string, EnvironmentSettings>
}) {
  const [environmentKey, setEnvironmentKey] = useState(environments[0]?.key ?? '')
  const [attributes, setAttributes] = useState('{\n  "id": "user-123",\n  "country": "BR"\n}')
  const [parseError, setParseError] = useState(false)
  const simulate = useSimulate()
  const draft = proposed ? (proposed[environmentKey] ?? { enabled: false, rules: [] }) : null

  const run = () => {
    let parsed: Json
    try {
      parsed = JSON.parse(attributes) as Json
      setParseError(false)
    } catch {
      setParseError(true)
      return
    }
    simulate.mutate({ featureKey, environmentKey, attributes: parsed, proposed: draft ?? undefined })
  }

  const result = simulate.data

  return (
    <Card title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-kto-red" /> Testar feature</span>}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Ambiente">
            <Select value={environmentKey} onChange={(e) => setEnvironmentKey(e.target.value)}>
              {environments.map((env) => (
                <option key={env.key} value={env.key}>{env.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Atributos do usuário (JSON)" error={parseError ? 'JSON inválido' : null}>
            <Textarea rows={6} value={attributes} onChange={(e) => setAttributes(e.target.value)} spellCheck={false} />
          </Field>
          <div className="flex items-center gap-3">
            <Button onClick={run} loading={simulate.isPending}>Avaliar</Button>
            {draft && <Badge tone="yellow">avaliando o draft (não publicado)</Badge>}
          </div>
        </div>
        <div className="space-y-3">
          <ErrorBanner error={simulate.error} />
          {result ? (
            <>
              <div className="rounded-lg border border-line bg-ink p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Valor avaliado</p>
                <div className="mt-2 text-lg"><ValueChip value={result.value} /></div>
                <p className="mt-2 text-xs text-muted">
                  origem <span className="font-mono text-soft">{result.source}</span>
                  {result.ruleId && <> · regra <span className="font-mono text-soft">{result.ruleId}</span></>}
                </p>
              </div>
              {result.trace.length > 0 && (
                <ol className="space-y-1.5">
                  {result.trace.map((t, i) => (
                    <li
                      key={t.ruleId ?? i}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${t.selected ? 'border-kto-red bg-kto-red/10' : 'border-line'}`}
                    >
                      <span className="flex items-center gap-2">
                        {t.conditionMatched ? <CheckCircle2 className="size-4 text-kto-green" /> : <CircleSlash className="size-4 text-kto-grey" />}
                        <span className="font-mono text-xs">{t.ruleId}</span>
                        <Badge>{t.type}</Badge>
                      </span>
                      <span className="text-xs text-muted">
                        {t.selected ? 'aplicada' : t.conditionMatched ? 'condição ok, fora do rollout' : 'condição não atendida'}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[0.6875rem] text-kto-grey">Avaliado com {result.evaluator}, o mesmo SDK usado em produção.</p>
            </>
          ) : (
            <p className="text-sm text-muted">Informe os atributos e clique em Avaliar.</p>
          )}
        </div>
      </div>
    </Card>
  )
}
