import { KeyRound, Plus, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@/api/hooks'
import type { ApiToken, ApiTokenRole, CreatedApiToken } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Code, EmptyState, ErrorBanner, formatDate, PageHeader, Spinner, Table } from '@/components/ui/Display'
import { Field, Input, Select } from '@/components/ui/Form'

const LIFETIMES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
  { days: 0, label: 'Never expires' },
]

const ROLE_HINT: Record<ApiTokenRole, string> = {
  VIEWER: 'Read flags, simulate and replay.',
  EDITOR: 'Also create and edit drafts and publish where no approval is required. Never approves drafts.',
}

type TokenState = 'active' | 'expired' | 'revoked'

function stateOf(token: ApiToken, now = new Date()): TokenState {
  if (token.revokedAt) return 'revoked'
  if (token.expiresAt && new Date(token.expiresAt) <= now) return 'expired'
  return 'active'
}

/** Admin page for automation credentials (CI, scripts). Secrets are shown once, at creation. */
export function ApiTokensPage() {
  const { can } = useAuth()
  const tokens = useApiTokens()
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreatedApiToken | null>(null)
  const [revoking, setRevoking] = useState<ApiToken | null>(null)

  if (!can('ktoggle-admin')) {
    return <EmptyState title="Admins only">API tokens are managed by ktoggle admins.</EmptyState>
  }

  return (
    <>
      <PageHeader
        title="API tokens"
        subtitle="Credentials for automation. Use them as Authorization: Bearer ktg_… on the admin API; every change is audited as token:<name>."
        actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> New token</Button>}
      />
      {tokens.isLoading && <Spinner />}
      <ErrorBanner error={tokens.error} />
      {tokens.data && tokens.data.length === 0 && (
        <EmptyState title="No API tokens yet">Create one for a CI pipeline or a script that needs to read or edit flags.</EmptyState>
      )}
      {tokens.data && tokens.data.length > 0 && (
        <Table head={['Name', 'Token', 'Role', 'Created', 'Last used', 'Expires', 'Status', '']}>
          {tokens.data.map((token) => {
            const state = stateOf(token)
            return (
              <tr key={token.id} className={state === 'active' ? '' : 'opacity-60'}>
                <td className="px-4 py-3 font-mono text-xs text-white">{token.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{token.prefix}…</td>
                <td className="px-4 py-3"><Badge tone={token.role === 'EDITOR' ? 'red' : 'outline'}>{token.role.toLowerCase()}</Badge></td>
                <td className="px-4 py-3 text-xs text-soft">{token.createdBy}<br /><span className="text-muted">{formatDate(token.createdAt)}</span></td>
                <td className="px-4 py-3 text-xs text-soft">{token.lastUsedAt ? formatDate(token.lastUsedAt) : 'never'}</td>
                <td className="px-4 py-3 text-xs text-soft">{token.expiresAt ? formatDate(token.expiresAt) : 'never'}</td>
                <td className="px-4 py-3">
                  {state === 'active' && <Badge tone="green">active</Badge>}
                  {state === 'expired' && <Badge tone="yellow">expired</Badge>}
                  {state === 'revoked' && <span title={`by ${token.revokedBy}`}><Badge>revoked</Badge></span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {state !== 'revoked' && (
                    <Button size="sm" variant="ghost" onClick={() => setRevoking(token)}>Revoke</Button>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
      )}
      {creating && (
        <CreateTokenDialog
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false)
            setCreated(result)
          }}
        />
      )}
      {created && <SecretDialog created={created} onClose={() => setCreated(null)} />}
      {revoking && <RevokeDialog token={revoking} onClose={() => setRevoking(null)} />}
    </>
  )
}

function CreateTokenDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (created: CreatedApiToken) => void }) {
  const create = useCreateApiToken()
  const [name, setName] = useState('')
  const [role, setRole] = useState<ApiTokenRole>('VIEWER')
  const [days, setDays] = useState(90)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null
    create.mutate({ name: name.trim(), role, expiresAt }, { onSuccess: onCreated })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="New API token"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="token-form" loading={create.isPending} disabled={name.trim().length < 2}>Create token</Button>
        </>
      }
    >
      <form id="token-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" hint="Lowercase, e.g. ci-deploy or mobile-release-script. Shown in the audit log as token:<name>.">
          <Input id="token-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} autoFocus />
        </Field>
        <Field label="Role" hint={ROLE_HINT[role]}>
          <Select id="token-role" value={role} onChange={(e) => setRole(e.target.value as ApiTokenRole)}>
            <option value="VIEWER">Viewer</option>
            <option value="EDITOR">Editor</option>
          </Select>
        </Field>
        <Field label="Expires">
          <Select id="token-expiry" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {LIFETIMES.map((l) => (
              <option key={l.days} value={l.days}>{l.label}</option>
            ))}
          </Select>
        </Field>
        <ErrorBanner error={create.error} />
      </form>
    </Dialog>
  )
}

function SecretDialog({ created, onClose }: { created: CreatedApiToken; onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Token ${created.token.name} created`}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-md border border-kto-yellow/40 bg-kto-yellow/10 px-3 py-2 text-sm text-soft">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-kto-yellow" />
          Copy it now and store it in your secret manager. ktoggle keeps only a hash: this secret cannot be shown again.
        </p>
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-kto-red" />
          <Code value={created.secret} className="break-all" />
        </div>
        <p className="text-xs text-muted">
          Example: <span className="font-mono">curl -H "Authorization: Bearer {created.token.prefix}…" /admin/v1/features</span>
        </p>
      </div>
    </Dialog>
  )
}

function RevokeDialog({ token, onClose }: { token: ApiToken; onClose: () => void }) {
  const revoke = useRevokeApiToken()
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Revoke ${token.name}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={revoke.isPending} onClick={() => revoke.mutate(token.id, { onSuccess: onClose })}>
            Revoke token
          </Button>
        </>
      }
    >
      <p className="text-sm text-soft">
        Anything using <span className="font-mono text-white">{token.prefix}…</span> stops working immediately. This cannot be undone;
        create a new token if it is needed again.
      </p>
      <ErrorBanner error={revoke.error} />
    </Dialog>
  )
}
