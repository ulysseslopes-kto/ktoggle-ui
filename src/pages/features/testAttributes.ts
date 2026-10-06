import type { Attribute, Json, Rule } from '@/api/types'

const SAMPLE_ID = 'user-123'

/**
 * Attributes to prefill the "Test feature" panel with: the hash attributes the rules split users by, plus every
 * attribute their conditions read. A sample value is taken from the condition itself when it names one (so the first
 * rule tends to match), otherwise from the attribute's type in the catalog.
 */
export function suggestAttributes(rules: Rule[], catalog: Attribute[]): Record<string, Json> {
  const byKey = new Map(catalog.map((a) => [a.key, a]))
  const suggested: Record<string, Json> = { id: SAMPLE_ID }
  for (const rule of rules) {
    if (rule.type !== 'force' && !(rule.hashAttribute in suggested)) suggested[rule.hashAttribute] = SAMPLE_ID
    collect(rule.condition, (key, sample) => {
      if (!(key in suggested)) suggested[key] = sample !== undefined ? sample : sampleOf(byKey.get(key))
    })
  }
  return suggested
}

/** Walks a GrowthBook (MongoDB-like) condition, reporting each attribute and the value it is compared with, if any. */
function collect(condition: Json | null | undefined, report: (key: string, sample: Json | undefined) => void) {
  if (condition === null || condition === undefined || typeof condition !== 'object' || Array.isArray(condition)) return
  for (const [key, value] of Object.entries(condition)) {
    if (key === '$and' || key === '$or' || key === '$nor') {
      if (Array.isArray(value)) value.forEach((c) => collect(c, report))
    } else if (key === '$not') {
      collect(value, report)
    } else if (!key.startsWith('$')) {
      report(key, sampleFrom(value))
    }
  }
}

function sampleFrom(value: Json): Json | undefined {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return undefined
  if ('$eq' in value && (value.$eq === null || typeof value.$eq !== 'object')) return value.$eq
  if ('$in' in value && Array.isArray(value.$in) && value.$in.length > 0 && typeof value.$in[0] !== 'object') return value.$in[0]
  return undefined
}

function sampleOf(attribute: Attribute | undefined): Json {
  switch (attribute?.datatype) {
    case 'NUMBER': return 0
    case 'BOOLEAN': return true
    case 'ENUM': return attribute.enumValues[0] ?? ''
    case 'STRING_ARRAY':
    case 'NUMBER_ARRAY': return []
    default: return ''
  }
}
