import { Code2, Plus, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import type { Attribute, Json } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Form'
import { buildCondition, clauseErrors, OPERATORS, parseCondition, type Clause, type Operator } from './conditions'

/**
 * Targeting condition editor with two modes, like GrowthBook: a visual builder (AND of simple clauses) and raw
 * JSON for anything else ($or, $elemMatch...). Reports {@code undefined} while the JSON or a clause is invalid.
 */
export function ConditionEditor({ value, onChange, attributes }: {
  value: Json | null
  onChange: (value: Json | null | undefined) => void
  attributes: Attribute[]
}) {
  const initialClauses = parseCondition(value)
  const [mode, setMode] = useState<'visual' | 'json'>(initialClauses === null ? 'json' : 'visual')
  const [clauses, setClauses] = useState<Clause[]>(initialClauses ?? [])
  const [json, setJson] = useState(value ? JSON.stringify(value, null, 2) : '')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const active = attributes.filter((a) => !a.archived)
  const errors = clauseErrors(clauses, attributes)

  const updateClauses = (next: Clause[]) => {
    setClauses(next)
    // an incomplete clause blocks saving instead of being saved as {country: ""} or left out
    onChange(clauseErrors(next, attributes).some(Boolean) ? undefined : buildCondition(next, attributes))
  }

  const updateJson = (raw: string) => {
    setJson(raw)
    if (!raw.trim()) {
      setJsonError(null)
      onChange(null)
      return
    }
    let parsed: Json
    try {
      parsed = JSON.parse(raw) as Json
    } catch {
      setJsonError('Invalid JSON')
      onChange(undefined)
      return
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setJsonError('The condition must be a JSON object')
      onChange(undefined)
      return
    }
    setJsonError(null)
    onChange(parsed)
  }

  const switchMode = () => {
    if (mode === 'visual') {
      const built = buildCondition(clauses, attributes)
      setJson(built ? JSON.stringify(built, null, 2) : '')
      // from now on the JSON shown is what gets saved
      onChange(built)
      setMode('json')
      return
    }
    const parsed = jsonError ? null : parseCondition(json.trim() ? (JSON.parse(json) as Json) : null)
    if (parsed !== null) {
      setClauses(parsed)
      setMode('visual')
    }
  }

  const canGoVisual = mode === 'json' && !jsonError && parseCondition(safeParse(json)) !== null

  return (
    <div className="space-y-3 rounded-lg border border-surface-3 bg-ink/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {mode === 'visual'
            ? clauses.length === 0 ? 'No condition: the rule applies to all users.' : 'All conditions must be true (AND).'
            : 'MongoDB syntax, the same evaluated by the GrowthBook SDKs.'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={switchMode}
          disabled={mode === 'json' && !canGoVisual}
          title={mode === 'json' && !canGoVisual ? 'Condition too complex for the visual mode' : undefined}
        >
          {mode === 'visual' ? <><Code2 className="size-3.5" /> JSON</> : <><Wand2 className="size-3.5" /> Visual</>}
        </Button>
      </div>

      {mode === 'visual' ? (
        <div className="space-y-2">
          {clauses.map((clause, index) => {
            const op = OPERATORS.find((o) => o.value === clause.operator)!
            const replace = (patch: Partial<Clause>) =>
              updateClauses(clauses.map((c, i) => (i === index ? { ...c, ...patch } : c)))
            return (
              <div key={index}>
                <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-center gap-2">
                  <Select value={clause.attribute} onChange={(e) => replace({ attribute: e.target.value })} aria-label="Attribute">
                    <option value="">Attribute…</option>
                    {active.map((a) => (
                      <option key={a.key} value={a.key}>{a.key}</option>
                    ))}
                  </Select>
                  <Select value={clause.operator} onChange={(e) => replace({ operator: e.target.value as Operator })} aria-label="Operator">
                    {OPERATORS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                  {op.needsValue ? (
                    <Input
                      value={clause.value}
                      onChange={(e) => replace({ value: e.target.value })}
                      placeholder={clause.operator === 'in' || clause.operator === 'nin' ? 'BR, PT, AR' : 'value'}
                      aria-label="Value"
                    />
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    aria-label="Remove condition"
                    className="rounded p-2 text-muted hover:bg-surface-2 hover:text-kto-red"
                    onClick={() => updateClauses(clauses.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {errors[index] && <p className="mt-1 text-xs text-kto-red">{errors[index]}</p>}
              </div>
            )
          })}
          <Button size="sm" variant="secondary" onClick={() => updateClauses([...clauses, { attribute: '', operator: 'eq', value: '' }])}>
            <Plus className="size-3.5" /> Add condition
          </Button>
        </div>
      ) : (
        <div>
          <Textarea rows={6} value={json} onChange={(e) => updateJson(e.target.value)} spellCheck={false} placeholder='{"country": {"$in": ["BR", "PT"]}}' />
          {jsonError && <p className="mt-1 text-xs text-kto-red">{jsonError}</p>}
        </div>
      )}
    </div>
  )
}

function safeParse(raw: string): Json | null {
  try {
    return raw.trim() ? (JSON.parse(raw) as Json) : null
  } catch {
    return null
  }
}
