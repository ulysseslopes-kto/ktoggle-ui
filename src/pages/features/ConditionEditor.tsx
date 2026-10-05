import { Code2, Plus, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import type { Attribute, Json } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Form'
import { buildCondition, OPERATORS, parseCondition, type Clause, type Operator } from './conditions'

/**
 * Targeting condition editor with two modes, like GrowthBook: a visual builder (AND of simple clauses) and raw
 * JSON for anything else ($or, $elemMatch...). Reports {@code undefined} while the JSON is invalid.
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
  const [jsonError, setJsonError] = useState(false)
  const active = attributes.filter((a) => !a.archived)

  const updateClauses = (next: Clause[]) => {
    setClauses(next)
    onChange(buildCondition(next, attributes))
  }

  const updateJson = (raw: string) => {
    setJson(raw)
    if (!raw.trim()) {
      setJsonError(false)
      onChange(null)
      return
    }
    try {
      onChange(JSON.parse(raw) as Json)
      setJsonError(false)
    } catch {
      setJsonError(true)
      onChange(undefined)
    }
  }

  const switchMode = () => {
    if (mode === 'visual') {
      const built = buildCondition(clauses, attributes)
      setJson(built ? JSON.stringify(built, null, 2) : '')
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
            ? clauses.length === 0 ? 'Sem condição: a regra vale para todos os usuários.' : 'Todas as condições devem ser verdadeiras (E).'
            : 'Sintaxe MongoDB, a mesma avaliada pelos SDKs do GrowthBook.'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={switchMode}
          disabled={mode === 'json' && !canGoVisual}
          title={mode === 'json' && !canGoVisual ? 'Condição complexa demais para o modo visual' : undefined}
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
              <div key={index} className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-center gap-2">
                <Select value={clause.attribute} onChange={(e) => replace({ attribute: e.target.value })} aria-label="Atributo">
                  <option value="">Atributo…</option>
                  {active.map((a) => (
                    <option key={a.key} value={a.key}>{a.key}</option>
                  ))}
                </Select>
                <Select value={clause.operator} onChange={(e) => replace({ operator: e.target.value as Operator })} aria-label="Operador">
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
                {op.needsValue ? (
                  <Input
                    value={clause.value}
                    onChange={(e) => replace({ value: e.target.value })}
                    placeholder={clause.operator === 'in' || clause.operator === 'nin' ? 'BR, PT, AR' : 'valor'}
                    aria-label="Valor"
                  />
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  aria-label="Remover condição"
                  className="rounded p-2 text-muted hover:bg-surface-2 hover:text-kto-red"
                  onClick={() => updateClauses(clauses.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )
          })}
          <Button size="sm" variant="secondary" onClick={() => updateClauses([...clauses, { attribute: '', operator: 'eq', value: '' }])}>
            <Plus className="size-3.5" /> Adicionar condição
          </Button>
        </div>
      ) : (
        <div>
          <Textarea rows={6} value={json} onChange={(e) => updateJson(e.target.value)} spellCheck={false} placeholder='{"country": {"$in": ["BR", "PT"]}}' />
          {jsonError && <p className="mt-1 text-xs text-kto-red">JSON inválido</p>}
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
