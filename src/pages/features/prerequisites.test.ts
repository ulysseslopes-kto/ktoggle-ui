import { describe, expect, it } from 'vitest'
import { conditionFor, describePrerequisite, parseCondition, type PrerequisiteState } from './prerequisites'

describe('prerequisites', () => {
  it('round-trips every preset through its condition', () => {
    const states: PrerequisiteState[] = ['on', 'off', 'live', 'notLive']
    for (const state of states) expect(parseCondition(conditionFor(state)).state).toBe(state)
    expect(parseCondition(conditionFor('equals', 'grid'))).toEqual({ state: 'equals', value: 'grid' })
    expect(parseCondition(conditionFor('equals', { a: 1 }))).toEqual({ state: 'equals', value: { a: 1 } })
  })

  it('treats anything else as a custom condition', () => {
    expect(parseCondition({ value: { $gt: 3 } }).state).toBe('custom')
    expect(parseCondition({ value: true, other: 1 }).state).toBe('custom')
  })

  it('describes prerequisites in plain words', () => {
    expect(describePrerequisite({ featureKey: 'new-wallet', condition: { value: true } })).toBe('new-wallet is on (true)')
    expect(describePrerequisite({ featureKey: 'layout', condition: { value: 'grid' } })).toBe('layout equals "grid"')
  })
})
