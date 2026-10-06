import type { Attribute } from '@/api/types'
import { buildCondition, clauseErrors, describeCondition, parseCondition } from './conditions'

const attr = (key: string, datatype: Attribute['datatype']): Attribute => ({
  key, datatype, hashAttribute: false, pii: false, enumValues: [], archived: false, createdAt: '', updatedAt: '', version: 0,
})
const ATTRIBUTES = [attr('country', 'STRING'), attr('age', 'NUMBER'), attr('appVersion', 'STRING'), attr('vip', 'BOOLEAN')]

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

  it('merges equality with other operators on the same attribute', () => {
    const clauses = [
      { attribute: 'country', operator: 'eq' as const, value: 'BR' },
      { attribute: 'country', operator: 'in' as const, value: 'BR, PT' },
      { attribute: 'age', operator: 'gte' as const, value: '18' },
      { attribute: 'age', operator: 'eq' as const, value: '20' },
    ]
    const condition = buildCondition(clauses, ATTRIBUTES)
    expect(condition).toEqual({ country: { $eq: 'BR', $in: ['BR', 'PT'] }, age: { $gte: 18, $eq: 20 } })
    expect(buildCondition(parseCondition(condition)!, ATTRIBUTES)).toEqual(condition)
  })

  it('reports incomplete and invalid clauses', () => {
    const errors = clauseErrors(
      [
        { attribute: '', operator: 'eq', value: 'BR' },
        { attribute: 'country', operator: 'eq', value: ' ' },
        { attribute: 'country', operator: 'in', value: ' , ' },
        { attribute: 'age', operator: 'gt', value: 'ten' },
        { attribute: 'age', operator: 'nin', value: '1, x' },
        { attribute: 'vip', operator: 'eq', value: 'treu' },
        { attribute: 'appVersion', operator: 'regex', value: '(' },
        { attribute: 'appVersion', operator: 'exists', value: '' },
        { attribute: 'appVersion', operator: 'notExists', value: '' },
        { attribute: 'country', operator: 'eq', value: 'PT' },
      ],
      ATTRIBUTES,
    )
    expect(errors).toEqual([
      'Choose an attribute.',
      'Enter a value.',
      'Enter at least one value.',
      'Enter a number.',
      'Every value must be a number.',
      'Use true or false.',
      'Invalid regular expression.',
      null,
      'This attribute already has a condition with this operator.',
      'This attribute already has a condition with this operator.',
    ])
  })

  it('accepts complete clauses', () => {
    const errors = clauseErrors(
      [
        { attribute: 'country', operator: 'in', value: 'BR, PT' },
        { attribute: 'age', operator: 'gte', value: '18' },
        { attribute: 'vip', operator: 'eq', value: 'false' },
        { attribute: 'appVersion', operator: 'vgte', value: '2.3.0' },
      ],
      ATTRIBUTES,
    )
    expect(errors.every((e) => e === null)).toBe(true)
  })
})
