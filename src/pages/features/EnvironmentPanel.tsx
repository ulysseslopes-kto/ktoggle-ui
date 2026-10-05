import { clsx } from 'clsx'
import { ArrowDown, ArrowUp, Pencil, Percent, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSavedGroups } from '@/api/hooks'
import type { EnvironmentSettings, Json, Rule, ValueType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ValueChip } from '@/components/ui/Display'
import { Toggle } from '@/components/ui/Toggle'
import { describeCondition } from './conditions'
import { RuleDialog } from './RuleDialog'

/**
 * Rules of one environment, as published or as proposed by the selected draft. Every edit is sent to a draft
 * ({@code onChange}); nothing here changes what SDKs receive until the draft is published.
 */
export function EnvironmentPanel({ environmentKey, settings, valueType, defaultValue, editable, busy, onChange }: {
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
            label={`Ativar em ${environmentKey}`}
            onChange={(enabled) => onChange({ enabled, rules })}
          />
          <div>
            <p className="text-sm font-semibold">{settings.enabled ? `Ligada em ${environmentKey}` : `Desligada em ${environmentKey}`}</p>
            <p className="text-xs text-muted">
              {settings.enabled
                ? 'Os SDKs deste ambiente recebem as regras abaixo.'
                : 'Os SDKs deste ambiente avaliam a feature como nula (desligada).'}
            </p>
          </div>
        </div>
        {editable && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing({ index: null })}>
            <Plus className="size-3.5" /> Adicionar regra
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <EmptyState title="Nenhuma regra">Todos os usuários recebem o valor padrão.</EmptyState>
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
                    {rule.type === 'force' ? (
                      <Badge tone="red"><Target className="size-3" /> Forçar valor</Badge>
                    ) : (
                      <Badge tone="red"><Percent className="size-3" /> Rollout</Badge>
                    )}
                    {!rule.enabled && <Badge>desativada</Badge>}
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
                      label="Regra ativa"
                      onChange={(enabled) => setRules(rules.map((r, i) => (i === index ? { ...r, enabled } : r)))}
                    />
                    <IconButton label="Subir" disabled={busy || index === 0} onClick={() => move(index, -1)} icon={ArrowUp} />
                    <IconButton label="Descer" disabled={busy || index === rules.length - 1} onClick={() => move(index, 1)} icon={ArrowDown} />
                    <IconButton label="Editar" disabled={busy} onClick={() => setEditing({ index })} icon={Pencil} />
                    <IconButton label="Remover" danger disabled={busy} onClick={() => setRules(rules.filter((_, i) => i !== index))} icon={Trash2} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-lg border border-dashed border-surface-3 px-4 py-3 text-sm">
        <span className="text-muted">Caso nenhuma regra se aplique, servir o valor padrão </span>
        <ValueChip value={defaultValue} />
      </div>

      <RuleDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
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

/** "SE country é igual a BR E no grupo VIPs · para 25% … servir true". */
export function RuleSummary({ rule, groupName }: { rule: Rule; groupName: (key: string) => string }) {
  return (
    <>
      <p className="text-sm">
        <span className="text-muted">SE </span>
        {(rule.condition || rule.savedGroups.length === 0) && describeCondition(rule.condition)}
        {rule.savedGroups.map((g, i) => (
          <span key={g}>
            <span className="text-muted">{i > 0 || rule.condition ? ' E no grupo ' : 'no grupo '}</span>
            <Badge tone="outline">{groupName(g)}</Badge>
          </span>
        ))}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {rule.type === 'rollout' && (
          <>
            <span className="text-muted">para</span>
            <span className="font-mono font-bold text-kto-yellow">{Math.round(rule.coverage * 100)}%</span>
            <span className="text-muted">dos usuários (hash por {rule.hashAttribute})</span>
          </>
        )}
        <span className="text-muted">servir</span> <ValueChip value={rule.value} />
      </p>
    </>
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
