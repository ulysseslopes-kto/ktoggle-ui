import { useEffect, useState } from 'react'
import type { Json, ValueType } from '@/api/types'
import { Input, Select, Textarea } from '@/components/ui/Form'

/** Editor for a flag value of the given type. Reports {@code undefined} while the input is not a valid value. */
export function ValueEditor({ type, value, onChange, id }: {
  type: ValueType
  value: Json | undefined
  onChange: (value: Json | undefined) => void
  id?: string
}) {
  const [text, setText] = useState(() => toText(type, value))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setText(toText(type, value))
    // reset only when the type changes; typing is handled locally
  }, [type])

  const update = (raw: string) => {
    setText(raw)
    const parsed = fromText(type, raw)
    setInvalid(parsed === undefined)
    onChange(parsed)
  }

  if (type === 'BOOLEAN') {
    return (
      <Select id={id} value={String(value ?? false)} onChange={(e) => onChange(e.target.value === 'true')}>
        <option value="true">true (on)</option>
        <option value="false">false (off)</option>
      </Select>
    )
  }
  if (type === 'JSON') {
    return (
      <div>
        <Textarea id={id} rows={5} value={text} onChange={(e) => update(e.target.value)} spellCheck={false} />
        {invalid && <p className="mt-1 text-xs text-kto-red">Invalid JSON</p>}
      </div>
    )
  }
  return (
    <div>
      <Input id={id} value={text} inputMode={type === 'NUMBER' ? 'decimal' : 'text'} onChange={(e) => update(e.target.value)} />
      {invalid && <p className="mt-1 text-xs text-kto-red">Invalid number</p>}
    </div>
  )
}

function toText(type: ValueType, value: Json | undefined): string {
  if (value === undefined || value === null) return type === 'JSON' ? '{}' : ''
  if (type === 'JSON') return JSON.stringify(value, null, 2)
  return String(value)
}

export function fromText(type: ValueType, raw: string): Json | undefined {
  switch (type) {
    case 'STRING':
      return raw
    case 'NUMBER': {
      const n = Number(raw)
      return raw.trim() !== '' && Number.isFinite(n) ? n : undefined
    }
    case 'BOOLEAN':
      return raw === 'true'
    case 'JSON':
      try {
        return JSON.parse(raw) as Json
      } catch {
        return undefined
      }
  }
}

export function defaultFor(type: ValueType): Json {
  return { BOOLEAN: false, STRING: '', NUMBER: 0, JSON: {} }[type] as Json
}
