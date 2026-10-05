import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDeleteResource, useProjects, useSaveResource } from '@/api/hooks'
import type { Project } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Code, EmptyState, ErrorBanner, PageHeader, Spinner, Table, formatDate } from '@/components/ui/Display'
import { Field, Input, Textarea } from '@/components/ui/Form'

function ProjectDialog({ project, onClose }: { project: Project | 'new'; onClose: () => void }) {
  const editing = project === 'new' ? null : project
  const save = useSaveResource<{ key?: string; name: string; description: string; version?: number }>('projects')
  const [key, setKey] = useState('')
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = editing
      ? { name: name.trim(), description, version: editing.version }
      : { key: key.trim(), name: name.trim(), description }
    save.mutate({ key: editing?.key, body }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `Editar projeto ${editing.key}` : 'Novo projeto'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="project-form" loading={save.isPending} disabled={!name.trim() || (!editing && !key.trim())}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
        {!editing && (
          <Field label="Chave" hint="Identificador imutável, ex.: sportsbook">
            <Input value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </Field>
        )}
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Descrição">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
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
        title="Projetos"
        subtitle="Agrupam features e limitam o que cada conexão SDK recebe."
        actions={admin && <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Novo projeto</Button>}
      />
      {projects.isLoading && <Spinner />}
      <ErrorBanner error={projects.error} />
      {projects.data?.length === 0 && <EmptyState title="Nenhum projeto cadastrado" />}
      {projects.data && projects.data.length > 0 && (
        <Table head={['Chave', 'Nome', 'Descrição', 'Atualizado', '']}>
          {projects.data.map((p) => (
            <tr key={p.key} className="hover:bg-surface">
              <td className="px-4 py-3"><Code value={p.key} /></td>
              <td className="px-4 py-3 font-semibold">{p.name}</td>
              <td className="px-4 py-3 text-muted">{p.description || '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(p.updatedAt)}</td>
              <td className="px-4 py-3">
                {admin && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Excluir" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></Button>
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
          title={`Excluir projeto ${deleting.key}?`}
          description="Não é possível excluir projetos em uso por features ou conexões SDK."
          confirmLabel="Excluir"
          onConfirm={(reason) => remove.mutateAsync({ key: deleting.key, reason })}
        />
      )}
    </>
  )
}
