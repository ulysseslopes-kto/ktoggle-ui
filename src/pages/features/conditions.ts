import type { Attribute, Json } from '@/api/types'

/**
 * Visual condition builder model. A condition built here is an AND of simple clauses, serialised in the
 * MongoDB-like syntax understood by the GrowthBook SDKs. Anything more complex is edited as raw JSON.
 */
export type Operator =
  | 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists' | 'notExists' | 'regex' | 'vgte' | 'vlt'

export interface Clause {
  attribute: string
  operator: Operator
  /** Raw text typed by the user (lists are comma separated). */
  value: string
}

export const OPERATORS: { value: Operator; label: string; needsValue: boolean }[] = [
  { value: 'eq', label: 'é igual a', needsValue: true },
  { value: 'ne', label: 'é diferente de', needsValue: true },
  { value: 'in', label: 'está em (lista)', needsValue: true },
  { value: 'nin', label: 'não está em (lista)', needsValue: true },
  { value: 'gt', label: '>', needsValue: true },
  { value: 'gte', label: '≥', needsValue: true },
  { value: 'lt', label: '<', needsValue: true },
  { value: 'lte', label: '≤', needsValue: true },
  { value: 'exists', label: 'existe', needsValue: false },
  { value: 'notExists', label: 'não existe', needsValue: false },
  { value: 'regex', label: 'casa com regex', needsValue: true },
  { value: 'vgte', label: 'versão ≥', needsValue: true },
  { value: 'vlt', label: 'versão <', needsValue: true },
]

const MONGO: Partial<Record<Operator, string>> = {
  ne: '$ne', in: '$in', nin: '$nin', gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', regex: '$regex', vgte: '$vgte', vlt: '$vlt',
}

function typed(raw: string, datatype: Attribute['datatype'] | undefined): Json {
  const text = raw.trim()
  if (datatype === 'NUMBER' || datatype === 'NUMBER_ARRAY') {
    const n = Number(text)
    return Number.isFinite(n) && text !== '' ? n : text
  }
  if (datatype === 'BOOLEAN') return text === 'true'
  return text
}

function clauseValue(clause: Clause, datatype: Attribute['datatype'] | undefined): Json {
  switch (clause.operator) {
    case 'eq':
      return typed(clause.value, datatype)
    case 'exists':
      return { $exists: true }
    case 'notExists':
      return { $exists: false }
    case 'in':
    case 'nin':
      return {
        [MONGO[clause.operator]!]: clause.value.split(',').map((v) => v.trim()).filter(Boolean).map((v) => typed(v, datatype)),
      }
    case 'regex':
    case 'vgte':
    case 'vlt':
      return { [MONGO[clause.operator]!]: clause.value.trim() }
    default:
      return { [MONGO[clause.operator]!]: typed(clause.value, datatype) }
  }
}

/** Builds the condition object; clauses on the same attribute are merged (e.g. age ≥ 18 and age < 30). */
export function buildCondition(clauses: Clause[], attributes: Attribute[]): Json | null {
  const result: Record<string, Json> = {}
  for (const clause of clauses.filter((c) => c.attribute)) {
    const datatype = attributes.find((a) => a.key === clause.attribute)?.datatype
    const value = clauseValue(clause, datatype)
    const existing = result[clause.attribute]
    if (isOperatorObject(existing) && isOperatorObject(value)) {
      result[clause.attribute] = { ...existing, ...value }
    } else {
      result[clause.attribute] = value
    }
  }
  return Object.keys(result).length === 0 ? null : result
}

function isOperatorObject(value: Json | undefined): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length > 0 && Object.keys(value).every((k) => k.startsWith('$'))
}

const REVERSE: Record<string, Operator> = Object.fromEntries(
  Object.entries(MONGO).map(([op, mongo]) => [mongo, op as Operator]),
)

/** Parses a condition into clauses, or returns null when it cannot be represented visually. */
export function parseCondition(condition: Json | null | undefined): Clause[] | null {
  if (condition === null || condition === undefined) return []
  if (typeof condition !== 'object' || Array.isArray(condition)) return null
  const clauses: Clause[] = []
  for (const [attribute, value] of Object.entries(condition)) {
    if (attribute.startsWith('$')) return null
    if (value === null || typeof value !== 'object') {
      clauses.push({ attribute, operator: 'eq', value: String(value) })
      continue
    }
    if (!isOperatorObject(value)) return null
    for (const [op, arg] of Object.entries(value)) {
      if (op === '$exists' && typeof arg === 'boolean') {
        clauses.push({ attribute, operator: arg ? 'exists' : 'notExists', value: '' })
      } else if ((op === '$in' || op === '$nin') && Array.isArray(arg) && arg.every((v) => typeof v !== 'object')) {
        clauses.push({ attribute, operator: REVERSE[op], value: arg.map(String).join(', ') })
      } else if (op === '$eq' && (arg === null || typeof arg !== 'object')) {
        clauses.push({ attribute, operator: 'eq', value: String(arg) })
      } else if (REVERSE[op] && (arg === null || typeof arg !== 'object')) {
        clauses.push({ attribute, operator: REVERSE[op], value: String(arg) })
      } else {
        return null
      }
    }
  }
  return clauses
}

/** Human-readable summary, e.g. "country é igual a BR E age ≥ 18". */
export function describeCondition(condition: Json | null | undefined): string {
  const clauses = parseCondition(condition)
  if (clauses === null) return JSON.stringify(condition)
  if (clauses.length === 0) return 'Todos os usuários'
  return clauses
    .map((c) => {
      const op = OPERATORS.find((o) => o.value === c.operator)!
      return op.needsValue ? `${c.attribute} ${op.label} ${c.value}` : `${c.attribute} ${op.label}`
    })
    .join(' E ')
}
