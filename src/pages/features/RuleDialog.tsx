import { clsx } from 'clsx'
import { CalendarClock, FlaskConical, Link2, Percent, Plus, Scale, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAttributes, useSavedGroups } from '@/api/hooks'
import type { Json, Prerequisite, Rule, SavedGroup, ValueType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { ConditionEditor } from './ConditionEditor'
import { equalWeights, nextVariationKey, TRACKING_KEY, weightsAddUp } from './experiments'
import { PrerequisiteEditor } from './PrerequisiteEditor'
import { fromLocalInput, toLocalInput } from './schedule'
import { defaultFor, ValueEditor } from './ValueEditor'

const TYPES = [
  { type: 'force', icon: Target, title: 'Force value', hint: 'Users matching the condition get the value.' },
  { type: 'rollout', icon: Percent, title: 'Percentage rollout', hint: 'A stable share of users (by hash) gets the value.' },
  { type: 'experiment', icon: FlaskConical, title: 'Experiment', hint: 'Split users between variations (A/B test).' },
] as const

/** Create/edit a rule (force, percentage rollout or experiment), mirroring GrowthBook's "Add rule" modal. */
export function RuleDialog({ open, onOpenChange, featureKey, projectKey, valueType, initial, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  featureKey: string
  projectKey?: string | null
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
      {open && (
        <RuleForm featureKey={featureKey} projectKey={projectKey} valueType={valueType} initial={initial} onCancel={() => onOpenChange(false)} onSave={onSave} />
      )}
    </Dialog>
  )
}

interface VariationDraft {
  key: string
  name: string
  value: Json | undefined
  weight: number
}

function RuleForm({ featureKey, projectKey, valueType, initial, onCancel, onSave }: {
  featureKey: string
  projectKey?: string | null
  valueType: ValueType
  initial?: Rule
  onCancel: () => void
  onSave: (rule: Rule) => void
}) {
  const attributes = useAttributes().data ?? []
  const groups = useSavedGroups().data ?? []
  const hashable = attributes.filter((a) => !a.archived && (a.datatype === 'STRING' || a.datatype === 'NUMBER'))
  const defaultHash = hashable.find((a) => a.hashAttribute)?.key ?? hashable[0]?.key ?? ''
  const off = valueType === 'BOOLEAN' ? false : defaultFor(valueType)
  const on = valueType === 'BOOLEAN' ? true : defaultFor(valueType)

  const [type, setType] = useState<Rule['type']>(initial?.type ?? 'force')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [condition, setCondition] = useState<Json | null | undefined>(initial?.condition ?? null)
  const [groupMatch, setGroupMatch] = useState<GroupMatches>(() => matchesOf(initial))
  const [value, setValue] = useState<Json | undefined>(initial && initial.type !== 'experiment' ? initial.value : on)
  const [coverage, setCoverage] = useState(initial && initial.type !== 'force' ? Math.round(initial.coverage * 100) : 50)
  const [chosenHash, setHashAttribute] = useState(initial && initial.type !== 'force' ? initial.hashAttribute : '')
  // attributes may still be loading when the dialog opens: fall back to the default once they arrive
  const hashAttribute = chosenHash || defaultHash
  const [trackingKey, setTrackingKey] = useState(initial?.type === 'experiment' ? initial.trackingKey : featureKey)
  const [variations, setVariations] = useState<VariationDraft[]>(() =>
    initial?.type === 'experiment'
      ? initial.variations.map((v) => ({ key: v.key, name: v.name ?? '', value: v.value, weight: v.weight }))
      : [
          { key: '0', name: 'Control', value: off, weight: 0.5 },
          { key: '1', name: 'Treatment', value: on, weight: 0.5 },
        ],
  )

  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>(initial?.prerequisites ?? [])
  const [gated, setGated] = useState(prerequisites.length > 0)
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.schedule?.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.schedule?.endsAt))
  const [scheduled, setScheduled] = useState(Boolean(startsAt || endsAt))
  const schedule = scheduled ? { startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt) } : null
  const scheduleError =
    schedule?.startsAt && schedule.endsAt && schedule.endsAt <= schedule.startsAt ? 'The end must be after the start.' : null

  const weights = variations.map((v) => v.weight)
  const experimentValid =
    TRACKING_KEY.test(trackingKey) &&
    variations.length >= 2 &&
    variations.every((v) => v.value !== undefined && v.weight >= 0) &&
    weightsAddUp(weights)
  const valid =
    condition !== undefined &&
    !scheduleError &&
    (type === 'force' || Boolean(hashAttribute)) &&
    (type === 'experiment' ? experimentValid : value !== undefined)

  const selectType = (next: Rule['type']) => {
    // experiments usually include every matching user; rollouts start at half
    if (!initial && next !== type && next !== 'force') setCoverage(next === 'experiment' ? 100 : 50)
    setType(next)
  }

  const updateVariation = (index: number, patch: Partial<VariationDraft>) =>
    setVariations(variations.map((v, i) => (i === index ? { ...v, ...patch } : v)))

  const evenly = (list: VariationDraft[]) => {
    const split = equalWeights(list.length)
    return list.map((v, i) => ({ ...v, weight: split[i] }))
  }

  const save = () => {
    if (!valid) return
    const base = {
      id: initial?.id,
      description: description || null,
      enabled,
      condition: condition ?? null,
      ...savedGroupLists(groupMatch),
      schedule: schedule?.startsAt || schedule?.endsAt ? schedule : null,
      prerequisites: gated ? prerequisites : [],
    }
    if (type === 'force') {
      onSave({ ...base, type, value: value! })
    } else if (type === 'rollout') {
      onSave({ ...base, type, value: value!, coverage: coverage / 100, hashAttribute })
    } else {
      onSave({
        ...base,
        type,
        trackingKey,
        hashAttribute,
        coverage: coverage / 100,
        hashVersion: initial?.type === 'experiment' ? initial.hashVersion : 2,
        seed: initial?.type === 'experiment' ? initial.seed : null,
        variations: variations.map((v) => ({ key: v.key, name: v.name || null, value: v.value!, weight: v.weight })),
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {TYPES.map(({ type: option, icon: Icon, title, hint }) => (
          <button
            key={option}
            type="button"
            onClick={() => selectType(option)}
            className={clsx(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              type === option ? 'border-kto-red bg-kto-red/10' : 'border-surface-3 hover:border-kto-grey',
            )}
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-kto-red" />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <Field label={type === 'experiment' ? 'Experiment name' : 'Description'}>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === 'experiment' ? 'e.g. New checkout button' : 'e.g. Beta for Brazil'}
        />
      </Field>

      {type === 'experiment' && (
        <Field
          label="Tracking key"
          hint="Sent to your analytics (e.g. Mixpanel) with every exposure. Changing it starts a new experiment."
          error={TRACKING_KEY.test(trackingKey) ? undefined : 'Use 1–150 letters, digits, ".", "_", ":" or "-".'}
        >
          <Input value={trackingKey} onChange={(e) => setTrackingKey(e.target.value.trim())} className="font-mono" />
        </Field>
      )}

      <Field label="Targeting condition">
        <ConditionEditor value={condition ?? null} onChange={setCondition} attributes={attributes} />
      </Field>

      <SavedGroupsPicker groups={groups} value={groupMatch} onChange={setGroupMatch} />

      {type !== 'force' && (
        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <Field
            label={type === 'experiment' ? 'Users in the experiment' : 'Percentage of users'}
            hint={type === 'experiment' ? 'Users left out skip this rule and fall through to the next one.' : undefined}
          >
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

      {type === 'experiment' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-soft">Variations</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setVariations(evenly(variations))}>
                <Scale className="size-3.5" /> Split evenly
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={variations.length >= 20}
                onClick={() =>
                  setVariations(
                    evenly([
                      ...variations,
                      { key: nextVariationKey(variations.map((v) => v.key)), name: `Variation ${variations.length}`, value: on, weight: 0 },
                    ]),
                  )
                }
              >
                <Plus className="size-3.5" /> Add variation
              </Button>
            </div>
          </div>
          {variations.map((variation, index) => (
            <div
              key={variation.key}
              className="grid grid-cols-[2.5rem_1fr_1.4fr_7rem_auto] items-start gap-3 rounded-lg border border-line bg-ink/40 p-3"
            >
              <span className="mt-2 font-mono text-xs text-kto-grey" title="Variation key, as sent to analytics">#{variation.key}</span>
              <Input
                value={variation.name}
                onChange={(e) => updateVariation(index, { name: e.target.value })}
                placeholder="Name"
                aria-label={`Variation ${variation.key} name`}
              />
              <ValueEditor type={valueType} value={variation.value} onChange={(v) => updateVariation(index, { value: v })} />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={Number((variation.weight * 100).toFixed(2))}
                  onChange={(e) => updateVariation(index, { weight: Number(e.target.value) / 100 })}
                  className="text-right font-mono"
                  aria-label={`Variation ${variation.key} weight`}
                />
                <span className="text-sm text-muted">%</span>
              </div>
              <button
                type="button"
                aria-label={`Remove variation ${variation.key}`}
                title="Remove variation"
                disabled={variations.length <= 2}
                onClick={() => setVariations(evenly(variations.filter((_, i) => i !== index)))}
                className="mt-1.5 rounded p-1.5 text-muted hover:bg-surface-2 hover:text-kto-red disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <p className={clsx('text-xs', weightsAddUp(weights) ? 'text-muted' : 'text-kto-red')}>
            Total <span className="font-mono">{(weights.reduce((sum, w) => sum + w, 0) * 100).toFixed(2)}%</span>
            {!weightsAddUp(weights) && ' — the weights must add up to 100%.'}
          </p>
        </div>
      ) : (
        <Field label="Value to serve">
          <ValueEditor type={valueType} value={value} onChange={setValue} />
        </Field>
      )}

      <div className="space-y-3 rounded-lg border border-line bg-ink/40 p-3">
        <Checkbox
          label={<span className="flex items-center gap-1.5"><Link2 className="size-4 text-kto-red" /> Require other features (prerequisites)</span>}
          checked={gated}
          onChange={setGated}
        />
        {gated && (
          <>
            <PrerequisiteEditor featureKey={featureKey} projectKey={projectKey} value={prerequisites} onChange={setPrerequisites} />
            <p className="text-xs text-muted">When a prerequisite fails for a user, this rule is skipped and evaluation continues.</p>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-line bg-ink/40 p-3">
        <Checkbox
          label={<span className="flex items-center gap-1.5"><CalendarClock className="size-4 text-kto-red" /> Schedule this rule</span>}
          checked={scheduled}
          onChange={setScheduled}
        />
        {scheduled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start" hint="Leave empty to start right away.">
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </Field>
              <Field label="End" hint="Leave empty to never end." error={scheduleError}>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-muted">
              Times are in your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Outside the window the rule is
              left out of the SDK payload; ktoggle publishes a new bundle within seconds of each start and end.
            </p>
          </>
        )}
      </div>

      <Checkbox label="Rule enabled" checked={enabled} onChange={setEnabled} />

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={!valid}>{initial ? 'Save rule' : 'Add rule'}</Button>
      </div>
    </div>
  )
}

type GroupMatch = 'all' | 'any' | 'none'
type GroupMatches = Record<string, GroupMatch>

const MATCH_LABEL: Record<GroupMatch | '', string> = {
  '': 'Not used',
  all: 'Must be in',
  any: 'Any of (at least one)',
  none: 'Must not be in',
}

function matchesOf(rule?: Rule): GroupMatches {
  const matches: GroupMatches = {}
  rule?.savedGroups.forEach((g) => (matches[g] = 'all'))
  rule?.savedGroupsAny?.forEach((g) => (matches[g] = 'any'))
  rule?.savedGroupsNone?.forEach((g) => (matches[g] = 'none'))
  return matches
}

function savedGroupLists(matches: GroupMatches) {
  const of = (match: GroupMatch) => Object.keys(matches).filter((g) => matches[g] === match)
  return { savedGroups: of('all'), savedGroupsAny: of('any'), savedGroupsNone: of('none') }
}

/** GrowthBook-style saved group targeting: each group is required, one of an "any" set, or excluded. */
function SavedGroupsPicker({ groups, value, onChange }: {
  groups: SavedGroup[]
  value: GroupMatches
  onChange: (value: GroupMatches) => void
}) {
  const anyCount = Object.values(value).filter((m) => m === 'any').length
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-soft">Saved groups</span>
      {groups.length === 0 ? (
        <span className="text-sm text-muted">No saved groups yet.</span>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.key} className="flex items-center justify-between gap-3 rounded-md border border-line bg-ink/40 px-3 py-2">
              <span className="min-w-0 truncate text-sm">{group.name}</span>
              <Select
                className="w-auto"
                aria-label={`Saved group ${group.name}`}
                value={value[group.key] ?? ''}
                onChange={(e) => {
                  const next = { ...value }
                  if (e.target.value) next[group.key] = e.target.value as GroupMatch
                  else delete next[group.key]
                  onChange(next)
                }}
              >
                {(['', 'all', 'any', 'none'] as const).map((m) => (
                  <option key={m} value={m}>{MATCH_LABEL[m]}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}
      <span className="text-xs text-muted">
        {anyCount === 1
          ? 'With a single "any of" group it works like "must be in".'
          : 'Users must be in every required group, in at least one "any of" group, and in no excluded group.'}
      </span>
    </div>
  )
}
