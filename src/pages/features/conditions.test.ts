import type { Attribute } from '@/api/types'
import { buildCondition, describeCondition, parseCondition } from './conditions'

const attr = (key: string, datatype: Attribute['datatype']): Attribute => ({
  key, datatype, hashAttribute: false, pii: false, enumValues: [], archived: false, createdAt: '', updatedAt: '', version: 0,
})
const ATTRIBUTES = [attr('country', 'STRING'), attr('age', 'NUMBER'), attr('appVersion', 'STRING')]

describe('conditions', () => {
  it('builds typed clauses and merges operators on the same attribute', () => {
    const condition = buildCondition(
      [
        { attribute: 'country', operator: 'in', value: 'BR, PT' },
        { attribute: 'age', operator: 'gte', value: '18' },
        { attribute: 'age', operator: 'lt', value: '30' },
        { attribute: 'appVersion', operator: 'vgte', value: '2.3.0' },
      ],
      ATTRIBUTES,
    )
    expect(condition).toEqual({
      country: { $in: ['BR', 'PT'] },
      age: { $gte: 18, $lt: 30 },
      appVersion: { $vgte: '2.3.0' },
    })
  })

  it('returns null for an empty builder (everyone)', () => {
    expect(buildCondition([], ATTRIBUTES)).toBeNull()
    expect(describeCondition(null)).toBe('All users')
  })

  it('round-trips simple conditions', () => {
    const condition = { country: 'BR', age: { $gte: 18 }, userId: { $exists: true } }
    const clauses = parseCondition(condition)!
    expect(buildCondition(clauses, [...ATTRIBUTES, attr('userId', 'STRING')])).toEqual(condition)
  })

  it('refuses conditions it cannot represent visually', () => {
    expect(parseCondition({ $or: [{ country: 'BR' }, { country: 'PT' }] })).toBeNull()
    expect(parseCondition({ tags: { $elemMatch: { $eq: 'vip' } } })).toBeNull()
    expect(describeCondition({ $or: [] })).toBe('{"$or":[]}')
  })
})
