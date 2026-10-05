import { clsx } from 'clsx'
import { ArrowDown, ArrowUp, FlaskConical, Pencil, Percent, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSavedGroups } from '@/api/hooks'
import type { EnvironmentSettings, ExperimentRule, Json, Rule, ValueType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ValueChip } from '@/components/ui/Display'
import { Toggle } from '@/components/ui/Toggle'
import { describeCondition } from './conditions'
import { RuleDialog } from './RuleDialog'

/**
 * Rules of one environment, as published or as proposed by the selected draft. Every edit is sent to a draft
 * ({@code onChange}); nothing here changes what SDKs receive until the draft is published.
 */
export function EnvironmentPanel({ featureKey, environmentKey, settings, valueType, defaultValue, editable, busy, onChange }: {
  featureKey: string
  environmentKey: string
  settings: EnvironmentSettings
  valueType: ValueType
  defaultValue: Json
  editable: boolean
  busy: boolean
  onChange: (settings: EnvironmentSettings) => void
}) {
  const [editing, setEditing] = useState<{ index: number | null } | null>(null)
  const groups = useSavedGroups().data ?? []
  const rules = settings.rules
  const setRules = (next: Rule[]) => onChange({ enabled: settings.enabled, rules: next })

  const move = (index: number, delta: number) => {
    const next = [...rules]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    setRules(next)
  }

  const groupName = (key: string) => groups.find((g) => g.key === key)?.name ?? key

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-ink/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <Toggle
            checked={settings.enabled}
            disabled={!editable || busy}
            label={`Enable in ${environmentKey}`}
            onChange={(enabled) => onChange({ enabled, rules })}
          />
          <div>
            <p className="text-sm font-semibold">{settings.enabled ? `On in ${environmentKey}` : `Off in ${environmentKey}`}</p>
            <p className="text-xs text-muted">
              {settings.enabled
                ? 'SDKs in this environment receive the rules below.'
                : 'SDKs in this environment evaluate the feature as null (off).'}
            </p>
          </div>
        </div>
        {editable && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing({ index: null })}>
            <Plus className="size-3.5" /> Add rule
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <EmptyState title="No rules">All users get the default value.</EmptyState>
      ) : (
        <ol className="space-y-3">
          {rules.map((rule, index) => (
            <li
              key={rule.id ?? `new-${index}`}
              className={clsx('rounded-lg border bg-surface p-4', rule.enabled ? 'border-line' : 'border-dashed border-surface-3 opacity-60')}
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs font-bold text-kto-yellow">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <RuleTypeBadge rule={rule} />
                    {!rule.enabled && <Badge>disabled</Badge>}
                    {rule.description && <span className="text-sm font-semibold">{rule.description}</span>}
                    {rule.id && <span className="font-mono text-[0.6875rem] text-kto-grey">{rule.id}</span>}
                  </div>
                  <RuleSummary rule={rule} groupName={groupName} />
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Toggle
                      size="sm"
                      checked={rule.enabled}
                      disabled={busy}
                      label="Rule enabled"
                      onChange={(enabled) => setRules(rules.map((r, i) => (i === index ? { ...r, enabled } : r)))}
                    />
                    <IconButton label="Move up" disabled={busy || index === 0} onClick={() => move(index, -1)} icon={ArrowUp} />
                    <IconButton label="Move down" disabled={busy || index === rules.length - 1} onClick={() => move(index, 1)} icon={ArrowDown} />
                    <IconButton label="Edit" disabled={busy} onClick={() => setEditing({ index })} icon={Pencil} />
                    <IconButton label="Remove" danger disabled={busy} onClick={() => setRules(rules.filter((_, i) => i !== index))} icon={Trash2} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-lg border border-dashed border-surface-3 px-4 py-3 text-sm">
        <span className="text-muted">If no rule applies, serve the default value </span>
        <ValueChip value={defaultValue} />
      </div>

      <RuleDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        featureKey={featureKey}
        valueType={valueType}
        initial={editing?.index != null ? rules[editing.index] : undefined}
        onSave={(rule) => {
          setRules(editing?.index != null ? rules.map((r, i) => (i === editing.index ? rule : r)) : [...rules, rule])
          setEditing(null)
        }}
      />
    </div>
  )
}

/** "IF country equals BR AND in group VIPs · for 25% … serve true". */
export function RuleSummary({ rule, groupName }: { rule: Rule; groupName: (key: string) => string }) {
  return (
    <>
      <p className="text-sm">
        <span className="text-muted">IF </span>
        {(rule.condition || rule.savedGroups.length === 0) && describeCondition(rule.condition)}
        {rule.savedGroups.map((g, i) => (
          <span key={g}>
            <span className="text-muted">{i > 0 || rule.condition ? ' AND in group ' : 'in group '}</span>
            <Badge tone="outline">{groupName(g)}</Badge>
          </span>
        ))}
      </p>
      {rule.type === 'experiment' ? (
        <ExperimentSummary rule={rule} />
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {rule.type === 'rollout' && (
            <>
              <span className="text-muted">for</span>
              <span className="font-mono font-bold text-kto-yellow">{Math.round(rule.coverage * 100)}%</span>
              <span className="text-muted">of users (hashed by {rule.hashAttribute})</span>
            </>
          )}
          <span className="text-muted">serve</span> <ValueChip value={rule.value} />
        </p>
      )}
    </>
  )
}

export function RuleTypeBadge({ rule }: { rule: Rule }) {
  if (rule.type === 'force') return <Badge tone="red"><Target className="size-3" /> Force value</Badge>
  if (rule.type === 'rollout') return <Badge tone="red"><Percent className="size-3" /> Rollout</Badge>
  return <Badge tone="red"><FlaskConical className="size-3" /> Experiment</Badge>
}

const VARIATION_COLORS = ['bg-neutral-300', 'bg-kto-red', 'bg-kto-yellow', 'bg-sky-500', 'bg-kto-green', 'bg-fuchsia-500']

/** "run experiment checkout-button for 100% of users", a weight bar and the variations with their values. */
function ExperimentSummary({ rule }: { rule: ExperimentRule }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted">run experiment</span>
        <span className="font-mono text-xs text-white">{rule.trackingKey}</span>
        <span className="text-muted">for</span>
        <span className="font-mono font-bold text-kto-yellow">{Math.round(rule.coverage * 100)}%</span>
        <span className="text-muted">of users (hashed by {rule.hashAttribute})</span>
      </p>
      <div className="flex h-1.5 max-w-md overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {rule.variations.map((v, i) => (
          <span key={v.key} style={{ width: `${v.weight * 100}%` }} className={VARIATION_COLORS[i % VARIATION_COLORS.length]} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {rule.variations.map((v, i) => (
          <li key={v.key} className="flex items-center gap-1.5">
            <span className={clsx('size-2 rounded-full', VARIATION_COLORS[i % VARIATION_COLORS.length])} />
            <span className="text-soft">{v.name || `#${v.key}`}</span>
            <span className="font-mono text-xs text-kto-yellow">{Number((v.weight * 100).toFixed(2))}%</span>
            <ValueChip value={v.value} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function IconButton({ label, icon: Icon, onClick, disabled, danger }: {
  label: string
  icon: typeof Pencil
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'rounded p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30',
        danger ? 'hover:text-kto-red' : 'hover:text-white',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
