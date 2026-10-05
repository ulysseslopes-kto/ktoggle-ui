import { AlertTriangle } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useEnvironments, useReviewSettings, useSaveResource, useSaveReviewSettings } from '@/api/hooks'
import type { Environment, ReviewSettings } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { ChipInput } from '@/components/ui/ChipInput'
import { Badge, Card, ErrorBanner, formatDate, PageHeader, Spinner } from '@/components/ui/Display'
import { Toggle } from '@/components/ui/Toggle'

const ROLE_SUGGESTIONS = ['ktoggle-admin', 'ktoggle-approver', 'ktoggle-editor']

/** Review & approval policy (admins edit; everyone else reads). */
export function SettingsPage() {
  const admin = useAuth().can('ktoggle-admin')
  const settings = useReviewSettings()
  const environments = useEnvironments()

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Review & approval: who approves drafts and which environments require approval before publishing."
      />
      <div className="space-y-6">
        {settings.isLoading ? <Spinner /> : settings.data && <ApproversCard settings={settings.data} editable={admin} />}
        <ErrorBanner error={settings.error} />
        <Card title="Environments that require approval">
          {environments.isLoading && <Spinner />}
          <ul className="divide-y divide-line">
            {environments.data?.map((env) => <EnvironmentRow key={env.key} environment={env} editable={admin} />)}
          </ul>
        </Card>
      </div>
    </>
  )
}

function ApproversCard({ settings, editable }: { settings: ReviewSettings; editable: boolean }) {
  const save = useSaveReviewSettings()
  const [draft, setDraft] = useState(settings)
  useEffect(() => setDraft(settings), [settings])
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const empty = draft.approverRoles.length === 0 && draft.approverUsers.length === 0

  return (
    <Card
      title="Who can approve drafts"
      actions={<span className="text-xs text-muted">updated by {settings.updatedBy} · {formatDate(settings.updatedAt)}</span>}
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ChipInput
            label="Approver roles (Keycloak)"
            values={draft.approverRoles}
            suggestions={ROLE_SUGGESTIONS}
            editable={editable}
            onChange={(approverRoles) => setDraft({ ...draft, approverRoles })}
          />
          <ChipInput
            label="Approver users"
            values={draft.approverUsers}
            placeholder="Keycloak username"
            editable={editable}
            onChange={(approverUsers) => setDraft({ ...draft, approverUsers })}
          />
        </div>

        <div className="space-y-4 border-t border-line pt-5">
          <Switch
            checked={draft.allowSelfApproval}
            editable={editable}
            onChange={(allowSelfApproval) => setDraft({ ...draft, allowSelfApproval })}
            title="Allow authors to approve their own drafts"
            description="Turns off the four-eyes rule: whoever created the draft can approve and publish it alone."
            warning={draft.allowSelfApproval ? 'With this on, a single person can change protected environments.' : undefined}
          />
          <Switch
            checked={draft.resetReviewOnChange}
            editable={editable}
            onChange={(resetReviewOnChange) => setDraft({ ...draft, resetReviewOnChange })}
            title="Changing an approved draft requires a new approval"
            description="Prevents publishing something different from what was approved."
          />
          <Switch
            checked={draft.bypassEnabled}
            editable={editable}
            onChange={(bypassEnabled) => setDraft({ ...draft, bypassEnabled })}
            title="Emergency publication by admins"
            description="Admins can publish without approval during incidents. A reason is required and the action is flagged in the audit trail."
          />
        </div>

        <ErrorBanner error={save.error} />
        {editable && (
          <div className="flex items-center justify-end gap-3">
            {empty && <span className="text-xs text-kto-red">Add at least one approver role or user.</span>}
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(settings)}>Discard</Button>
            <Button disabled={!dirty || empty} loading={save.isPending} onClick={() => save.mutate(draft)}>Save</Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function EnvironmentRow({ environment, editable }: { environment: Environment; editable: boolean }) {
  const save = useSaveResource<{ name: string; description?: string | null; sortOrder: number; requiresReview: boolean; version: number }>('environments')
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold">{environment.name} <span className="font-mono text-xs text-muted">{environment.key}</span></p>
        <p className="text-xs text-muted">
          {environment.requiresReview ? 'Publishing requires approval from someone else.' : 'The draft author can publish directly.'}
        </p>
        <ErrorBanner error={save.error} />
      </div>
      <div className="flex items-center gap-3">
        {environment.requiresReview && <Badge tone="yellow">requires approval</Badge>}
        <Toggle
          checked={environment.requiresReview}
          disabled={!editable || save.isPending}
          label={`Require approval in ${environment.key}`}
          onChange={(requiresReview) => save.mutate({
            key: environment.key,
            body: { name: environment.name, description: environment.description, sortOrder: environment.sortOrder, requiresReview, version: environment.version },
          })}
        />
      </div>
    </li>
  )
}

function Switch({ checked, editable, onChange, title, description, warning }: {
  checked: boolean
  editable: boolean
  onChange: (value: boolean) => void
  title: string
  description: string
  warning?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted">{description}</p>
        {warning && <p className="mt-1 flex items-center gap-1.5 text-xs text-kto-red"><AlertTriangle className="size-3.5" /> {warning}</p>}
      </div>
      <Toggle checked={checked} disabled={!editable} label={title} onChange={onChange} />
    </div>
  )
}

