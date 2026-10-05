import type { RuleSchedule } from '@/api/types'

export type ScheduleState = 'upcoming' | 'live' | 'ended'

/** Where a schedule stands at {@code now}; null when the rule has no schedule. */
export function scheduleState(schedule: RuleSchedule | null | undefined, now: Date = new Date()): ScheduleState | null {
  if (!schedule || (!schedule.startsAt && !schedule.endsAt)) return null
  if (schedule.startsAt && now < new Date(schedule.startsAt)) return 'upcoming'
  if (schedule.endsAt && now >= new Date(schedule.endsAt)) return 'ended'
  return 'live'
}

/** ISO instant → value for an {@code <input type="datetime-local">} in the browser's time zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** {@code datetime-local} value (browser time zone) → ISO instant; null when empty or invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatInstant(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}
