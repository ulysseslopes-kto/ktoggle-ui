import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useFeatures } from '@/api/hooks'
import type { Feature, Json, Prerequisite } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Form'
import { conditionFor, parseCondition, STATE_LABEL, statesFor, type PrerequisiteState } from './prerequisites'
import { defaultFor, ValueEditor } from './ValueEditor'

/**
 * Edits a list of prerequisites. Only active features of the same project are offered as parents (the server enforces
 * the same rule, plus the absence of cycles). Reports through {@code onValidityChange} whether every row holds a valid
 * value: while one does not (invalid custom JSON, invalid "equals" value), the caller must not save.
 */
export function PrerequisiteEditor({ featureKey, projectKey, value, onChange, onValidityChange }: {
  featureKey: string
  projectKey?: string | null
  value: Prerequisite[]
  onChange: (value: Prerequisite[]) => void
  onValidityChange?: (valid: boolean) => void
}) {
  const features = useFeatures({}).data ?? []
  // archived parents are not offered, but an existing prerequisite may still point at one
  const archived = useFeatures({ archived: true }).data ?? []
  const candidates = features.filter((f) => f.key !== featureKey && (f.projectKey ?? null) === (projectKey ?? null))
  const available = candidates.filter((f) => !value.some((p) => p.featureKey === f.key))

  const [invalidRows, setInvalidRows] = useState<string[]>([])
  const reportValidity = useCallback(
    (row: string, valid: boolean) =>
      setInvalidRows((rows) => (valid ? rows.filter((r) => r !== row) : rows.includes(row) ? rows : [...rows, row])),
    [],
  )
  const valid = invalidRows.length === 0
  useEffect(() => onValidityChange?.(valid), [valid, onValidityChange])

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
          rowKey={`${prerequisite.featureKey}-${index}`}
          prerequisite={prerequisite}
          parent={features.find((f) => f.key === prerequisite.featureKey) ?? archived.find((f) => f.key === prerequisite.featureKey)}
          archived={archived.some((f) => f.key === prerequisite.featureKey)}
          options={candidates.filter((f) => f.key === prerequisite.featureKey || !value.some((p) => p.featureKey === f.key))}
          onChange={(next) => onChange(value.map((p, i) => (i === index ? next : p)))}
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
          onValidity={reportValidity}
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

function PrerequisiteRow({ rowKey, prerequisite, parent, archived, options, onChange, onRemove, onValidity }: {
  rowKey: string
  prerequisite: Prerequisite
  parent?: Feature
  archived: boolean
  options: Feature[]
  onChange: (value: Prerequisite) => void
  onRemove: () => void
  onValidity: (row: string, valid: boolean) => void
}) {
  const parsed = parseCondition(prerequisite.condition)
  const [customText, setCustomText] = useState(() => JSON.stringify(prerequisite.condition, null, 2))
  const [customError, setCustomError] = useState<string | null>(null)
  const [valueInvalid, setValueInvalid] = useState(false)
  const states = statesFor(parent?.valueType)
  // the stored parent stays selectable even when it is not offered any more (archived, or gone)
  const listed = options.some((f) => f.key === prerequisite.featureKey)

  const invalid = (parsed.state === 'custom' && customError !== null) || (parsed.state === 'equals' && valueInvalid)
  useEffect(() => onValidity(rowKey, !invalid), [rowKey, invalid, onValidity])
  useEffect(() => () => onValidity(rowKey, true), [rowKey, onValidity])

  const setState = (state: PrerequisiteState) => {
    const value = state === 'equals' ? defaultFor(parent?.valueType ?? 'STRING') : state === 'custom' ? prerequisite.condition : undefined
    const condition = conditionFor(state, value)
    setCustomText(JSON.stringify(condition, null, 2))
    setCustomError(null)
    setValueInvalid(false)
    onChange({ ...prerequisite, condition })
  }

  const setParent = (key: string) => {
    const next = options.find((f) => f.key === key)
    setCustomError(null)
    setValueInvalid(false)
    onChange({ featureKey: key, condition: conditionFor(statesFor(next?.valueType)[0]) })
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-ink/40 p-3">
      <div className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-3">
        <Select value={prerequisite.featureKey} onChange={(e) => setParent(e.target.value)} aria-label="Prerequisite feature">
          {!listed && (
            <option value={prerequisite.featureKey}>
              {prerequisite.featureKey} {archived ? '(archived)' : '(unavailable)'}
            </option>
          )}
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
          onChange={(v) => {
            setValueInvalid(v === undefined)
            if (v !== undefined) onChange({ ...prerequisite, condition: conditionFor('equals', v) })
          }}
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
              let condition: Json
              try {
                condition = JSON.parse(e.target.value) as Json
              } catch {
                setCustomError('Invalid JSON')
                return
              }
              if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
                setCustomError('The condition must be a JSON object')
                return
              }
              setCustomError(null)
              onChange({ ...prerequisite, condition })
            }}
          />
          <p className={customError ? 'mt-1 text-xs text-kto-red' : 'mt-1 text-xs text-muted'}>
            {customError ?? 'Condition on the parent value, e.g. {"value": {"$gt": 10}}'}
          </p>
        </div>
      )}
    </div>
  )
}
