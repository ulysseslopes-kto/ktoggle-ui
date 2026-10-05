import { describe, expect, it } from 'vitest'
import { equalWeights, nextVariationKey, TRACKING_KEY, weightsAddUp } from './experiments'

describe('experiments', () => {
  it('splits weights evenly and always adds up to exactly 100%', () => {
    expect(equalWeights(2)).toEqual([0.5, 0.5])
    expect(equalWeights(3)).toEqual([0.3333, 0.3333, 0.3334])
    for (let n = 2; n <= 20; n++) expect(weightsAddUp(equalWeights(n))).toBe(true)
  })

  it('rejects weights that do not add up to 100%', () => {
    expect(weightsAddUp([0.5, 0.4])).toBe(false)
    expect(weightsAddUp([0.7, 0.3])).toBe(true)
  })

  it('never reuses a variation key', () => {
    expect(nextVariationKey(['0', '1'])).toBe('2')
    expect(nextVariationKey(['0', '3'])).toBe('4')
    expect(nextVariationKey(['control', 'treatment'])).toBe('0')
    expect(nextVariationKey(['control', '0'])).toBe('1')
  })

  it('accepts the same tracking keys as the server', () => {
    expect(TRACKING_KEY.test('checkout-button:v2')).toBe(true)
    expect(TRACKING_KEY.test('has space')).toBe(false)
    expect(TRACKING_KEY.test('')).toBe(false)
  })
})
