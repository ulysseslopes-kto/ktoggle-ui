import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDeleteResource, useProjects, useSaveResource } from '@/api/hooks'
import type { Project } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ChipInput } from '@/components/ui/ChipInput'
import { Badge, Code, EmptyState, ErrorBanner, PageHeader, Spinner, Table, formatDate } from '@/components/ui/Display'
import { Field, Input, Textarea } from '@/components/ui/Form'

function ProjectDialog({ project, onClose }: { project: Project | 'new'; onClose: () => void }) {
  const editing = project === 'new' ? null : project
  const save = useSaveResource<{
    key?: string
    name: string
    description: string
    editorRoles: string[]
    editorUsers: string[]
    version?: number
  }>('projects')
  const [key, setKey] = useState('')
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [editorRoles, setEditorRoles] = useState<string[]>(editing?.editorRoles ?? [])
  const [editorUsers, setEditorUsers] = useState<string[]>(editing?.editorUsers ?? [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = editing
      ? { name: name.trim(), description, editorRoles, editorUsers, version: editing.version }
      : { key: key.trim(), name: name.trim(), description, editorRoles, editorUsers }
    save.mutate({ key: editing?.key, body }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `Edit project ${editing.key}` : 'New project'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="project-form" loading={save.isPending} disabled={!name.trim() || (!editing && !key.trim())}>
            Save
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
        {!editing && (
          <Field label="Key" hint="Immutable identifier, e.g. sportsbook">
            <Input value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </Field>
        )}
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="space-y-3 rounded-lg border border-line bg-ink/40 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="size-4 text-kto-red" /> Who can change its features</p>
          <p className="text-xs text-muted">
            Leave both empty to let every editor change this project. Admins always can; reading stays open to everyone.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChipInput label="Keycloak roles" values={editorRoles} onChange={setEditorRoles} editable placeholder="e.g. squad-payments" />
            <ChipInput label="Users" values={editorUsers} onChange={setEditorUsers} editable placeholder="username or token:<name>" />
          </div>
        </div>
        <ErrorBanner error={save.error} />
      </form>
    </Dialog>
  )
}

export function ProjectsPage() {
  const { can } = useAuth()
  const admin = can('ktoggle-admin')
  const projects = useProjects()
  const remove = useDeleteResource('projects')
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Group features and limit what each SDK connection receives."
        actions={admin && <Button onClick={() => setEditing('new')}><Plus className="size-4" /> New project</Button>}
      />
      {projects.isLoading && <Spinner />}
      <ErrorBanner error={projects.error} />
      {projects.data?.length === 0 && <EmptyState title="No projects yet" />}
      {projects.data && projects.data.length > 0 && (
        <Table head={['Key', 'Name', 'Description', 'Who can edit', 'Updated', '']}>
          {projects.data.map((p) => (
            <tr key={p.key} className="hover:bg-surface">
              <td className="px-4 py-3"><Code value={p.key} /></td>
              <td className="px-4 py-3 font-semibold">{p.name}</td>
              <td className="px-4 py-3 text-muted">{p.description || '—'}</td>
              <td className="px-4 py-3">
                {p.editorRoles.length + p.editorUsers.length === 0 ? (
                  <span className="text-xs text-muted">every editor</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1">
                    <Lock className="size-3.5 text-kto-red" aria-label="Restricted" />
                    {[...p.editorRoles, ...p.editorUsers].map((e) => <Badge key={e} tone="outline">{e}</Badge>)}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(p.updatedAt)}</td>
              <td className="px-4 py-3">
                {admin && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <ProjectDialog key={editing === 'new' ? 'new' : editing.key} project={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ReasonDialog
          open
          danger
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Delete project ${deleting.key}?`}
          description="Projects used by features or SDK connections cannot be deleted."
          confirmLabel="Delete"
          onConfirm={(reason) => remove.mutateAsync({ key: deleting.key, reason })}
        />
      )}
    </>
  )
}
