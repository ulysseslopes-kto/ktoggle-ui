import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFeatures } from '@/api/hooks'
import type { Feature, Json, Prerequisite } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Form'
import { conditionFor, parseCondition, STATE_LABEL, statesFor, type PrerequisiteState } from './prerequisites'
import { defaultFor, ValueEditor } from './ValueEditor'

/**
 * Edits a list of prerequisites. Only active features of the same project are offered as parents (the server enforces
 * the same rule, plus the absence of cycles).
 */
export function PrerequisiteEditor({ featureKey, projectKey, value, onChange }: {
  featureKey: string
  projectKey?: string | null
  value: Prerequisite[]
  onChange: (value: Prerequisite[]) => void
}) {
  const features = useFeatures({}).data ?? []
  const candidates = features.filter((f) => f.key !== featureKey && (f.projectKey ?? null) === (projectKey ?? null))
  const available = candidates.filter((f) => !value.some((p) => p.featureKey === f.key))

  const add = () => {
    const parent = available[0]
    if (!parent) return
    onChange([...value, { featureKey: parent.key, condition: conditionFor(statesFor(parent.valueType)[0]) }])
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-sm text-muted">No prerequisites.</p>}
      {value.map((prerequisite, index) => (
        <PrerequisiteRow
          key={`${prerequisite.featureKey}-${index}`}
          prerequisite={prerequisite}
          parent={features.find((f) => f.key === prerequisite.featureKey)}
          options={candidates.filter((f) => f.key === prerequisite.featureKey || !value.some((p) => p.featureKey === f.key))}
          onChange={(next) => onChange(value.map((p, i) => (i === index ? next : p)))}
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
        />
      ))}
      <Button size="sm" variant="secondary" disabled={available.length === 0} onClick={add}>
        <Plus className="size-3.5" /> Add prerequisite
      </Button>
      {candidates.length === 0 && (
        <p className="text-xs text-muted">No other features in {projectKey ? `project ${projectKey}` : 'this project'} to depend on.</p>
      )}
    </div>
  )
}

function PrerequisiteRow({ prerequisite, parent, options, onChange, onRemove }: {
  prerequisite: Prerequisite
  parent?: Feature
  options: Feature[]
  onChange: (value: Prerequisite) => void
  onRemove: () => void
}) {
  const parsed = parseCondition(prerequisite.condition)
  const [customText, setCustomText] = useState(() => JSON.stringify(prerequisite.condition, null, 2))
  const [customError, setCustomError] = useState(false)
  const states = statesFor(parent?.valueType)

  const setState = (state: PrerequisiteState) => {
    const value = state === 'equals' ? defaultFor(parent?.valueType ?? 'STRING') : state === 'custom' ? prerequisite.condition : undefined
    const condition = conditionFor(state, value)
    setCustomText(JSON.stringify(condition, null, 2))
    onChange({ ...prerequisite, condition })
  }

  const setParent = (key: string) => {
    const next = options.find((f) => f.key === key)
    onChange({ featureKey: key, condition: conditionFor(statesFor(next?.valueType)[0]) })
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-ink/40 p-3">
      <div className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-3">
        <Select value={prerequisite.featureKey} onChange={(e) => setParent(e.target.value)} aria-label="Prerequisite feature">
          {options.map((f) => (
            <option key={f.key} value={f.key}>{f.key}</option>
          ))}
        </Select>
        <Select value={parsed.state} onChange={(e) => setState(e.target.value as PrerequisiteState)} aria-label="Prerequisite state">
          {[...new Set([...states, parsed.state])].map((s) => (
            <option key={s} value={s}>{STATE_LABEL[s]}</option>
          ))}
        </Select>
        <button
          type="button"
          aria-label={`Remove prerequisite ${prerequisite.featureKey}`}
          onClick={onRemove}
          className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-kto-red"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {parsed.state === 'equals' && parent && (
        <ValueEditor
          type={parent.valueType}
          value={parsed.value}
          onChange={(v) => v !== undefined && onChange({ ...prerequisite, condition: conditionFor('equals', v) })}
        />
      )}
      {parsed.state === 'custom' && (
        <div>
          <Textarea
            rows={3}
            className="font-mono text-xs"
            value={customText}
            spellCheck={false}
            aria-label="Custom prerequisite condition"
            onChange={(e) => {
              setCustomText(e.target.value)
              try {
                onChange({ ...prerequisite, condition: JSON.parse(e.target.value) as Json })
                setCustomError(false)
              } catch {
                setCustomError(true)
              }
            }}
          />
          <p className={customError ? 'mt-1 text-xs text-kto-red' : 'mt-1 text-xs text-muted'}>
            {customError ? 'Invalid JSON' : 'Condition on the parent value, e.g. {"value": {"$gt": 10}}'}
          </p>
        </div>
      )}
    </div>
  )
}
