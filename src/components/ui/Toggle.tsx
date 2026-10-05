import * as SwitchPrimitive from '@radix-ui/react-switch'
import { clsx } from 'clsx'

/** On/off switch. "On" is green (positive state, per brand rules); off is neutral grey. */
export function Toggle({ checked, onChange, disabled, label, size = 'md' }: {
  checked: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kto-red',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-kto-green' : 'bg-surface-3',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
      )}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          'block rounded-full bg-white shadow transition-transform',
          size === 'sm' ? 'size-4 data-[state=checked]:translate-x-[18px]' : 'size-5 data-[state=checked]:translate-x-[22px]',
          'translate-x-0.5',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
