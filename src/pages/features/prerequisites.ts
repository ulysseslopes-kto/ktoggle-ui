import type { Json, Prerequisite, ValueType } from '@/api/types'

/** The ways a parent can be required, as offered by GrowthBook. Conditions apply to {@code {"value": parentValue}}. */
export type PrerequisiteState = 'on' | 'off' | 'live' | 'notLive' | 'equals' | 'custom'

export const STATE_LABEL: Record<PrerequisiteState, string> = {
  on: 'is on (true)',
  off: 'is off (false)',
  live: 'is live (served)',
  notLive: 'is not live',
  equals: 'equals',
  custom: 'custom condition',
}

/** States that make sense for a parent of the given type. */
export function statesFor(type: ValueType | undefined): PrerequisiteState[] {
  return type === 'BOOLEAN' ? ['on', 'off', 'live', 'notLive', 'custom'] : ['live', 'notLive', 'equals', 'custom']
}

export function conditionFor(state: PrerequisiteState, value?: Json): Json {
  switch (state) {
    case 'on':
      return { value: true }
    case 'off':
      return { value: false }
    case 'live':
      return { value: { $exists: true } }
    case 'notLive':
      return { value: { $exists: false } }
    case 'equals':
      return { value: value ?? null }
    case 'custom':
      return value ?? { value: { $exists: true } }
  }
}

/** Recognizes the condition produced by {@link conditionFor}; anything else is a custom condition. */
export function parseCondition(condition: Json): { state: PrerequisiteState; value?: Json } {
  const c = condition as Record<string, Json> | null
  const keys = c && typeof c === 'object' && !Array.isArray(c) ? Object.keys(c) : []
  if (keys.length !== 1 || keys[0] !== 'value') return { state: 'custom', value: condition }
  const v = c!.value
  if (v === true) return { state: 'on' }
  if (v === false) return { state: 'off' }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const ops = Object.keys(v)
    const exists = (v as Record<string, Json>).$exists
    if (ops.length === 1 && exists === true) return { state: 'live' }
    if (ops.length === 1 && exists === false) return { state: 'notLive' }
    if (ops.some((op) => op.startsWith('$'))) return { state: 'custom', value: condition }
  }
  return { state: 'equals', value: v }
}

/** "new-wallet is on (true)", "lobby-layout equals "grid"". */
export function describePrerequisite(p: Prerequisite): string {
  const { state, value } = parseCondition(p.condition)
  if (state === 'equals') return `${p.featureKey} equals ${JSON.stringify(value)}`
  if (state === 'custom') return `${p.featureKey} matches ${JSON.stringify(p.condition)}`
  return `${p.featureKey} ${STATE_LABEL[state]}`
}
