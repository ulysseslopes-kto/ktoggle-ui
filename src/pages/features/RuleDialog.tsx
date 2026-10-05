import { clsx } from 'clsx'
import { Percent, Target } from 'lucide-react'
import { useState } from 'react'
import { useAttributes, useSavedGroups } from '@/api/hooks'
import type { Json, Rule, ValueType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { ConditionEditor } from './ConditionEditor'
import { defaultFor, ValueEditor } from './ValueEditor'

/** Create/edit a rule (force or percentage rollout), mirroring GrowthBook's "Add rule" modal. */
export function RuleDialog({ open, onOpenChange, valueType, initial, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  valueType: ValueType
  initial?: Rule
  onSave: (rule: Rule) => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={initial ? 'Edit rule' : 'New rule'}
      description="Rules are evaluated top to bottom; the first one that applies sets the value."
    >
      {open && <RuleForm valueType={valueType} initial={initial} onCancel={() => onOpenChange(false)} onSave={onSave} />}
    </Dialog>
  )
}

function RuleForm({ valueType, initial, onCancel, onSave }: {
  valueType: ValueType
  initial?: Rule
  onCancel: () => void
  onSave: (rule: Rule) => void
}) {
  const attributes = useAttributes().data ?? []
  const groups = useSavedGroups().data ?? []
  const hashable = attributes.filter((a) => !a.archived && (a.datatype === 'STRING' || a.datatype === 'NUMBER'))

  const [type, setType] = useState<Rule['type']>(initial?.type ?? 'force')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [condition, setCondition] = useState<Json | null | undefined>(initial?.condition ?? null)
  const [savedGroups, setSavedGroups] = useState<string[]>(initial?.savedGroups ?? [])
  const [value, setValue] = useState<Json | undefined>(initial?.value ?? (valueType === 'BOOLEAN' ? true : defaultFor(valueType)))
  const [coverage, setCoverage] = useState(initial?.type === 'rollout' ? Math.round(initial.coverage * 100) : 50)
  const [hashAttribute, setHashAttribute] = useState(
    initial?.type === 'rollout' ? initial.hashAttribute : (hashable.find((a) => a.hashAttribute)?.key ?? hashable[0]?.key ?? ''),
  )

  const valid = value !== undefined && condition !== undefined && (type === 'force' || Boolean(hashAttribute))

  const save = () => {
    if (!valid) return
    const base = { id: initial?.id, description: description || null, enabled, condition: condition ?? null, savedGroups, value: value! }
    onSave(type === 'force' ? { ...base, type } : { ...base, type, coverage: coverage / 100, hashAttribute })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {(['force', 'rollout'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            className={clsx(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              type === option ? 'border-kto-red bg-kto-red/10' : 'border-surface-3 hover:border-kto-grey',
            )}
          >
            {option === 'force' ? <Target className="mt-0.5 size-5 text-kto-red" /> : <Percent className="mt-0.5 size-5 text-kto-red" />}
            <span>
              <span className="block text-sm font-semibold">{option === 'force' ? 'Force value' : 'Percentage rollout'}</span>
              <span className="block text-xs text-muted">
                {option === 'force'
                  ? 'Users matching the condition get the value.'
                  : 'A stable share of users (by hash) gets the value.'}
              </span>
            </span>
          </button>
        ))}
      </div>

      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Beta for Brazil" />
      </Field>

      <Field label="Targeting condition">
        <ConditionEditor value={condition ?? null} onChange={setCondition} attributes={attributes} />
      </Field>

      <Field label="Saved groups" hint="Users must belong to every selected group.">
        {groups.length === 0 ? (
          <span className="text-sm text-muted">No saved groups yet.</span>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {groups.map((group) => (
              <Checkbox
                key={group.key}
                label={group.name}
                checked={savedGroups.includes(group.key)}
                onChange={(checked) =>
                  setSavedGroups(checked ? [...savedGroups, group.key] : savedGroups.filter((g) => g !== group.key))
                }
              />
            ))}
          </div>
        )}
      </Field>

      {type === 'rollout' && (
        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <Field label="Percentage of users">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={coverage}
                onChange={(e) => setCoverage(Number(e.target.value))}
                className="flex-1 accent-kto-red"
                aria-label="Percentage"
              />
              <span className="w-14 text-right font-mono text-lg font-bold text-kto-yellow">{coverage}%</span>
            </div>
          </Field>
          <Field label="Hash attribute" hint="Keeps each user consistently in the same bucket.">
            <Select value={hashAttribute} onChange={(e) => setHashAttribute(e.target.value)}>
              {hashable.map((a) => (
                <option key={a.key} value={a.key}>{a.key}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <Field label="Value to serve">
        <ValueEditor type={valueType} value={value} onChange={setValue} />
      </Field>

      <Checkbox label="Rule enabled" checked={enabled} onChange={setEnabled} />

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={!valid}>{initial ? 'Save rule' : 'Add rule'}</Button>
      </div>
    </div>
  )
}
