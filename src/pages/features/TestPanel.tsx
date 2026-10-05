import { CheckCircle2, CircleSlash, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useSimulate } from '@/api/hooks'
import type { EnvironmentSettings, Environment, Json } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Badge, Card, ErrorBanner, ValueChip } from '@/components/ui/Display'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { ExperimentAssignmentView } from './ExperimentAssignmentView'
import { fromLocalInput } from './schedule'

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
  const [at, setAt] = useState('')
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
    simulate.mutate({ featureKey, environmentKey, attributes: parsed, proposed: draft ?? undefined, at: fromLocalInput(at) ?? undefined })
  }

  const result = simulate.data

  return (
    <Card title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-kto-red" /> Test feature</span>}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Environment">
            <Select value={environmentKey} onChange={(e) => setEnvironmentKey(e.target.value)}>
              {environments.map((env) => (
                <option key={env.key} value={env.key}>{env.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="User attributes (JSON)" error={parseError ? 'Invalid JSON' : null}>
            <Textarea rows={6} value={attributes} onChange={(e) => setAttributes(e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Evaluate at" hint="Leave empty for now. Useful to check scheduled rules.">
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <div className="flex items-center gap-3">
            <Button onClick={run} loading={simulate.isPending}>Evaluate</Button>
            {draft && <Badge tone="yellow">evaluating the draft (unpublished)</Badge>}
          </div>
        </div>
        <div className="space-y-3">
          <ErrorBanner error={simulate.error} />
          {result ? (
            <>
              <div className="rounded-lg border border-line bg-ink p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Evaluated value</p>
                <div className="mt-2 text-lg"><ValueChip value={result.value} /></div>
                <p className="mt-2 text-xs text-muted">
                  source <span className="font-mono text-soft">{result.source}</span>
                  {result.ruleId && <> · rule <span className="font-mono text-soft">{result.ruleId}</span></>}
                </p>
                {result.experiment && <ExperimentAssignmentView assignment={result.experiment} />}
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
                        {t.selected
                          ? 'applied'
                          : !t.conditionMatched
                            ? 'condition not met'
                            : t.type === 'experiment'
                              ? 'condition met, not in the experiment'
                              : 'condition met, outside the rollout'}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[0.6875rem] text-kto-grey">Evaluated with {result.evaluator}, the same SDK used in production.</p>
            </>
          ) : (
            <p className="text-sm text-muted">Enter the attributes and click Evaluate.</p>
          )}
        </div>
      </div>
    </Card>
  )
}
