import { useState, type ReactNode } from 'react'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { ErrorBanner } from './ui/Display'
import { Field, Textarea } from './ui/Form'

/**
 * Confirmation step that captures the "why" of a change. The reason is sent as X-Ktoggle-Reason and kept in the
 * audit trail, the revision history and the bundle activation chain.
 */
export function ReasonDialog({ open, onOpenChange, title, description, required, confirmLabel = 'Confirm', danger, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  required?: boolean
  confirmLabel?: string
  danger?: boolean
  onConfirm: (reason: string | undefined) => Promise<unknown>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason.trim() || undefined)
      setReason('')
      onOpenChange(false)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={required && !reason.trim()} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={required ? 'Reason (required)' : 'Reason (optional)'} hint="Recorded in the audit trail.">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. release to 10% of users in BR" autoFocus />
        </Field>
        <ErrorBanner error={error} />
      </div>
    </Dialog>
  )
}
