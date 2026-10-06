import { describe, expect, it } from 'vitest'
import { fromLocalInput, instantFromInput, scheduleState, toLocalInput } from './schedule'

describe('schedule', () => {
  const now = new Date('2026-10-05T12:00:00Z')

  it('tells where a rule stands in its window', () => {
    expect(scheduleState(null, now)).toBeNull()
    expect(scheduleState({ startsAt: null, endsAt: null }, now)).toBeNull()
    expect(scheduleState({ startsAt: '2026-10-05T13:00:00Z' }, now)).toBe('upcoming')
    expect(scheduleState({ startsAt: '2026-10-05T12:00:00Z' }, now)).toBe('live')
    expect(scheduleState({ endsAt: '2026-10-05T12:00:00Z' }, now)).toBe('ended')
    expect(scheduleState({ startsAt: '2026-10-05T11:00:00Z', endsAt: '2026-10-05T13:00:00Z' }, now)).toBe('live')
  })

  it('round-trips datetime-local values in the browser time zone', () => {
    const iso = '2026-10-05T12:30:00.000Z'
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
    expect(fromLocalInput('')).toBeNull()
    expect(toLocalInput(null)).toBe('')
  })

  it('keeps the original instant, seconds included, until the field is changed', () => {
    const original = '2026-10-05T12:30:45.123Z'
    expect(instantFromInput(toLocalInput(original), original)).toBe(original)
    const edited = toLocalInput('2026-10-05T13:00:00.000Z')
    expect(instantFromInput(edited, original)).toBe('2026-10-05T13:00:00.000Z')
    expect(instantFromInput('', original)).toBeNull()
    expect(instantFromInput(edited, null)).toBe('2026-10-05T13:00:00.000Z')
  })
})
