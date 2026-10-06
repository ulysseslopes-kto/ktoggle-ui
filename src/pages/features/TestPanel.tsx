import { AlertTriangle, CheckCircle2, CircleSlash, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useAttributes, useSimulate } from '@/api/hooks'
import type { Environment, FeatureSnapshot, Json } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Badge, Card, ErrorBanner, ValueChip } from '@/components/ui/Display'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { ExperimentAssignmentView } from './ExperimentAssignmentView'
import { fromLocalInput } from './schedule'
import { suggestAttributes } from './testAttributes'

/** "Test feature": evaluates the flag with the official GrowthBook SDK — live, or as the selected draft would be. */
export function TestPanel({ featureKey, environments, content, draft }: {
  featureKey: string
  environments: Environment[]
  /** What is being looked at: the published feature, or the selected draft. */
  content: FeatureSnapshot
  /** The selected draft, if any: the test then evaluates what would be published (default value, prerequisites, rules). */
  draft?: FeatureSnapshot
}) {
  const [environmentKey, setEnvironmentKey] = useState(environments[0]?.key ?? '')
  // Until the user types, the attributes follow the rules of the selected environment.
  const [edited, setEdited] = useState<string | null>(null)
  const [parseError, setParseError] = useState(false)
  const [at, setAt] = useState('')
  const simulate = useSimulate()
  const catalog = useAttributes().data ?? []
  const settings = content.environments[environmentKey]
  const environmentName = environments.find((e) => e.key === environmentKey)?.name ?? environmentKey
  const attributes = edited ?? JSON.stringify(suggestAttributes(settings?.rules ?? [], catalog), null, 2)

  const run = () => {
    let parsed: Json
    try {
      parsed = JSON.parse(attributes) as Json
      setParseError(false)
    } catch {
      setParseError(true)
      return
    }
    simulate.mutate({ featureKey, environmentKey, attributes: parsed, proposedFeature: draft, at: fromLocalInput(at) ?? undefined })
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
          {settings?.enabled !== true && (
            <p className="flex items-start gap-2 rounded-md bg-kto-yellow/15 px-3 py-2 text-xs text-kto-yellow">
              <AlertTriangle className="mt-px size-4 shrink-0" />
              <span>
                This feature is off in {environmentName}{draft ? ' in this draft' : ''}. SDKs do not receive it there, so
                every user gets the fallback value coded in the app.
              </span>
            </p>
          )}
          <Field
            label="Attributes of the test user"
            hint={
              <>
                The JSON your app passes to the SDK for this user. Prefilled from the rules being tested.
                {edited !== null && (
                  <> <button type="button" className="text-kto-red hover:underline" onClick={() => setEdited(null)}>Reset</button></>
                )}
              </>
            }
            error={parseError ? 'Invalid JSON' : null}
          >
            <Textarea rows={6} value={attributes} onChange={(e) => setEdited(e.target.value)} spellCheck={false} />
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
                {result.source === 'prerequisite' && (
                  <p className="mt-2 text-xs text-kto-yellow">A prerequisite feature did not pass for this user, so the feature is off.</p>
                )}
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
                        {t.type === 'prerequisite'
                          ? t.conditionMatched ? 'prerequisites met' : 'prerequisite not met: feature off'
                          : t.selected
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
