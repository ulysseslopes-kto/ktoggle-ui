import { describe, expect, it } from 'vitest'
import type { Attribute, Rule } from '@/api/types'
import { suggestAttributes } from './testAttributes'

const attribute = (key: string, datatype: Attribute['datatype'], enumValues: string[] = []): Attribute => ({
  key, datatype, enumValues, hashAttribute: false, pii: false, archived: false, createdAt: '', updatedAt: '', version: 0,
})

describe('suggestAttributes', () => {
  it('always suggests an id, even without rules', () => {
    expect(suggestAttributes([], [])).toEqual({ id: 'user-123' })
  })

  it('takes sample values from the conditions, then from the catalog types', () => {
    const rules: Rule[] = [
      { type: 'force', enabled: true, value: true, savedGroups: [], condition: { country: 'BR', age: { $gte: 18 } } },
      { type: 'force', enabled: true, value: true, savedGroups: [], condition: { $or: [{ plan: { $in: ['gold', 'silver'] } }, { vip: { $exists: true } }] } },
      { type: 'force', enabled: true, value: true, savedGroups: [], condition: { country: 'PT', tier: { $ne: 'x' } } },
    ]
    const catalog = [attribute('age', 'NUMBER'), attribute('vip', 'BOOLEAN'), attribute('tier', 'ENUM', ['basic', 'pro'])]

    expect(suggestAttributes(rules, catalog)).toEqual({ id: 'user-123', country: 'BR', age: 0, plan: 'gold', vip: true, tier: 'basic' })
  })

  it('adds the hash attribute of rollouts and experiments', () => {
    const rules: Rule[] = [
      { type: 'rollout', enabled: true, value: true, savedGroups: [], coverage: 0.5, hashAttribute: 'deviceId' },
    ]
    expect(suggestAttributes(rules, [])).toEqual({ id: 'user-123', deviceId: 'user-123' })
  })
})
