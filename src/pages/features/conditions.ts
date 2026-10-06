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
  { value: 'eq', label: 'equals', needsValue: true },
  { value: 'ne', label: 'does not equal', needsValue: true },
  { value: 'in', label: 'is in (list)', needsValue: true },
  { value: 'nin', label: 'is not in (list)', needsValue: true },
  { value: 'gt', label: '>', needsValue: true },
  { value: 'gte', label: '≥', needsValue: true },
  { value: 'lt', label: '<', needsValue: true },
  { value: 'lte', label: '≤', needsValue: true },
  { value: 'exists', label: 'exists', needsValue: false },
  { value: 'notExists', label: 'does not exist', needsValue: false },
  { value: 'regex', label: 'matches regex', needsValue: true },
  { value: 'vgte', label: 'version ≥', needsValue: true },
  { value: 'vlt', label: 'version <', needsValue: true },
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

function listItems(raw: string): string[] {
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

/** The MongoDB operator a clause sets; two clauses on the same attribute may not set the same one. */
function mongoOperator(operator: Operator): string {
  if (operator === 'eq') return '$eq'
  if (operator === 'exists' || operator === 'notExists') return '$exists'
  return MONGO[operator]!
}

function clauseOperators(clause: Clause, datatype: Attribute['datatype'] | undefined): Record<string, Json> {
  switch (clause.operator) {
    case 'exists':
      return { $exists: true }
    case 'notExists':
      return { $exists: false }
    case 'in':
    case 'nin':
      return { [MONGO[clause.operator]!]: listItems(clause.value).map((v) => typed(v, datatype)) }
    case 'regex':
    case 'vgte':
    case 'vlt':
      return { [MONGO[clause.operator]!]: clause.value.trim() }
    default:
      return { [mongoOperator(clause.operator)]: typed(clause.value, datatype) }
  }
}

/**
 * Why each clause cannot be saved (null when it can), by index: incomplete clauses, values that do not fit the
 * attribute's type, invalid regular expressions and an operator repeated on the same attribute.
 */
export function clauseErrors(clauses: Clause[], attributes: Attribute[]): (string | null)[] {
  const used = new Set<string>()
  return clauses.map((clause) => {
    if (!clause.attribute) return 'Choose an attribute.'
    const slot = `${clause.attribute} ${mongoOperator(clause.operator)}`
    const repeated = used.has(slot)
    used.add(slot)
    if (repeated) return 'This attribute already has a condition with this operator.'
    if (!OPERATORS.find((o) => o.value === clause.operator)!.needsValue) return null
    const list = clause.operator === 'in' || clause.operator === 'nin'
    const values = list ? listItems(clause.value) : [clause.value.trim()].filter(Boolean)
    if (values.length === 0) return list ? 'Enter at least one value.' : 'Enter a value.'
    if (clause.operator === 'regex') {
      try {
        new RegExp(values[0])
      } catch {
        return 'Invalid regular expression.'
      }
      return null
    }
    if (clause.operator === 'vgte' || clause.operator === 'vlt') return null
    const datatype = attributes.find((a) => a.key === clause.attribute)?.datatype
    if ((datatype === 'NUMBER' || datatype === 'NUMBER_ARRAY') && values.some((v) => !Number.isFinite(Number(v)))) {
      return list ? 'Every value must be a number.' : 'Enter a number.'
    }
    if (datatype === 'BOOLEAN' && values.some((v) => v !== 'true' && v !== 'false')) return 'Use true or false.'
    return null
  })
}

/**
 * Builds the condition object; clauses on the same attribute are merged (e.g. age ≥ 18 and age < 30, or country
 * equals BR and is in BR, PT). Check {@link clauseErrors} first: incomplete clauses are not left out here.
 */
export function buildCondition(clauses: Clause[], attributes: Attribute[]): Json | null {
  const merged: Record<string, Record<string, Json>> = {}
  for (const clause of clauses.filter((c) => c.attribute)) {
    const datatype = attributes.find((a) => a.key === clause.attribute)?.datatype
    merged[clause.attribute] = { ...merged[clause.attribute], ...clauseOperators(clause, datatype) }
  }
  const result: Record<string, Json> = {}
  for (const [attribute, operators] of Object.entries(merged)) {
    const keys = Object.keys(operators)
    // a lone equality is written as the plain value, as GrowthBook does
    result[attribute] = keys.length === 1 && keys[0] === '$eq' ? operators.$eq : operators
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

/** Human-readable summary, e.g. "country equals BR AND age ≥ 18". */
export function describeCondition(condition: Json | null | undefined): string {
  const clauses = parseCondition(condition)
  if (clauses === null) return JSON.stringify(condition)
  if (clauses.length === 0) return 'All users'
  return clauses
    .map((c) => {
      const op = OPERATORS.find((o) => o.value === c.operator)!
      return op.needsValue ? `${c.attribute} ${op.label} ${c.value}` : `${c.attribute} ${op.label}`
    })
    .join(' AND ')
}
