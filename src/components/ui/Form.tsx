import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const FIELD =
  'w-full rounded-md border border-surface-3 bg-ink px-3 text-sm text-white placeholder:text-kto-grey ' +
  'focus:border-kto-red focus:outline-none focus:ring-1 focus:ring-kto-red disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={twMerge(FIELD, 'h-10', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={twMerge(FIELD, 'py-2 font-mono text-[0.8125rem]', className)} {...props} />
})

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={twMerge(FIELD, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Field({ label, hint, error, children, className }: {
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}) {
  return (
    <label className={clsx('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-soft">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs text-kto-red">{error}</span>}
    </label>
  )
}

export function Checkbox({ label, checked, onChange, disabled }: {
  label: ReactNode
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-soft">
      <input
        type="checkbox"
        className="size-4 accent-kto-red"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}
