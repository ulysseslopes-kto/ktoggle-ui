import { X } from 'lucide-react'
import { useState } from 'react'
import { Input } from './Form'

/**
 * Editable list of short strings (roles, usernames) shown as chips; Enter, a comma or leaving the field adds what was
 * typed (so a Save click never drops it), the cross removes.
 */
export function ChipInput({ label, values, onChange, editable, suggestions = [], placeholder }: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  editable: boolean
  suggestions?: string[]
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const add = (...items: string[]) => {
    const next = [...values]
    for (const v of items.map((item) => item.trim())) {
      if (v && !next.includes(v)) next.push(v)
    }
    if (next.length !== values.length) onChange(next)
    setText('')
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-soft">{label}</p>
      <div className="flex min-h-10 flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-sm text-muted">none</span>}
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-1 font-mono text-xs">
            {v}
            {editable && (
              <button type="button" aria-label={`Remove ${v}`} className="text-muted hover:text-kto-red"
                onClick={() => onChange(values.filter((x) => x !== v))}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {editable && (
        <>
          <Input
            value={text}
            placeholder={placeholder ?? 'type and press Enter'}
            onChange={(e) => {
              const parts = e.target.value.split(',')
              if (parts.length === 1) return setText(e.target.value)
              add(...parts.slice(0, -1))
              setText(parts[parts.length - 1])
            }}
            onBlur={() => add(text)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(text)
              }
            }}
          />
          {suggestions.filter((s) => !values.includes(s)).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.filter((s) => !values.includes(s)).map((s) => (
                <button key={s} type="button" onClick={() => add(s)}
                  className="rounded border border-dashed border-surface-3 px-2 py-0.5 font-mono text-xs text-muted hover:border-kto-red hover:text-white">
                  + {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
