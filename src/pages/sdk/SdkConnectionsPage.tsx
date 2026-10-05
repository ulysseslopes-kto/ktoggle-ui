import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEnvironments, useProjects, useSaveResource, useSdkConnections } from '@/api/hooks'
import type { SdkConnection } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Code, EmptyState, ErrorBanner, PageHeader, Spinner, Table } from '@/components/ui/Display'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'

function CreateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const environments = useEnvironments()
  const projects = useProjects()
  const save = useSaveResource<Record<string, unknown>>('sdk-connections')
  const [name, setName] = useState('')
  const [environmentKey, setEnvironmentKey] = useState('')
  const [projectKeys, setProjectKeys] = useState<string[]>([])
  const [clientKey, setClientKey] = useState('')

  const toggleProject = (key: string, on: boolean) =>
    setProjectKeys((current) => (on ? [...current, key] : current.filter((k) => k !== key)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = { name: name.trim(), environmentKey, projectKeys, ...(clientKey.trim() ? { clientKey: clientKey.trim() } : {}) }
    save.mutate(
      { body },
      {
        onSuccess: (created) => {
          onClose()
          const key = (created as SdkConnection | undefined)?.clientKey
          if (key) navigate(`/sdk-connections/${key}`)
        },
      },
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="New SDK connection"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="sdk-form" loading={save.isPending} disabled={!name.trim() || !environmentKey}>Create</Button>
        </>
      }
    >
      <form id="sdk-form" onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. app-mobile-android" />
        </Field>
        <Field label="Environment">
          <Select value={environmentKey} onChange={(e) => setEnvironmentKey(e.target.value)}>
            <option value="">Select…</option>
            {environments.data?.map((env) => <option key={env.key} value={env.key}>{env.name} ({env.key})</option>)}
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-soft">Projects (optional)</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-surface-3 bg-ink p-3">
            {projects.data?.length === 0 && <span className="text-xs text-muted">No projects yet.</span>}
            {projects.data?.map((p) => (
              <Checkbox key={p.key} label={p.name} checked={projectKeys.includes(p.key)} onChange={(on) => toggleProject(p.key, on)} />
            ))}
          </div>
          <span className="text-xs text-muted">With no projects selected, the connection receives features from every project.</span>
        </div>
        <Field label="Client key (advanced)" hint="Leave empty to generate one.">
          <Input value={clientKey} onChange={(e) => setClientKey(e.target.value)} />
        </Field>
        <ErrorBanner error={save.error} />
      </form>
    </Dialog>
  )
}

export function SdkConnectionsPage() {
  const { can } = useAuth()
  const connections = useSdkConnections()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="SDK connections"
        subtitle="Each connection delivers an environment's signed bundle to SDKs, by client key."
        actions={can('ktoggle-admin') && <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New connection</Button>}
      />
      {connections.isLoading && <Spinner />}
      <ErrorBanner error={connections.error} />
      {connections.data?.length === 0 && <EmptyState title="No SDK connections yet" />}
      {connections.data && connections.data.length > 0 && (
        <Table head={['Name', 'Client key', 'Environment', 'Projects', '']}>
          {connections.data.map((c) => (
            <tr key={c.clientKey} className="hover:bg-surface">
              <td className="px-4 py-3">
                <Link to={`/sdk-connections/${c.clientKey}`} className="font-semibold hover:text-kto-red">{c.name}</Link>
              </td>
              <td className="px-4 py-3"><Code value={c.clientKey} /></td>
              <td className="px-4 py-3"><Badge tone="outline">{c.environmentKey}</Badge></td>
              <td className="px-4 py-3">
                {c.projectKeys.length === 0 ? (
                  <span className="text-muted">all</span>
                ) : (
                  <div className="flex flex-wrap gap-1">{c.projectKeys.map((p) => <Badge key={p}>{p}</Badge>)}</div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {c.pinnedBundleHash && <Badge tone="red">PINNED</Badge>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </>
  )
}
