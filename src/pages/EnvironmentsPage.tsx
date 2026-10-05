import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDeleteResource, useEnvironments, useSaveResource } from '@/api/hooks'
import type { Environment } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Code, EmptyState, ErrorBanner, PageHeader, Spinner, Table, formatDate } from '@/components/ui/Display'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Form'

function EnvironmentDialog({ environment, onClose }: { environment: Environment | 'new'; onClose: () => void }) {
  const editing = environment === 'new' ? null : environment
  const save = useSaveResource<{ key?: string; name: string; description: string; sortOrder: number; requiresReview: boolean; version?: number }>('environments')
  const [key, setKey] = useState('')
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [sortOrder, setSortOrder] = useState(String(editing?.sortOrder ?? 0))
  const [requiresReview, setRequiresReview] = useState(editing?.requiresReview ?? false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = editing
      ? { name: name.trim(), description, sortOrder: Number(sortOrder) || 0, requiresReview, version: editing.version }
      : { key: key.trim(), name: name.trim(), description, sortOrder: Number(sortOrder) || 0, requiresReview }
    save.mutate({ key: editing?.key, body }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `Editar ambiente ${editing.key}` : 'Novo ambiente'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="environment-form" loading={save.isPending} disabled={!name.trim() || (!editing && !key.trim())}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="environment-form" onSubmit={submit} className="space-y-4">
        {!editing && (
          <Field label="Chave" hint="Identificador imutável, ex.: production">
            <Input value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </Field>
        )}
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Descrição">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Ordem" hint="Define a ordem de exibição dos ambientes.">
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <Checkbox
          label="Publicação exige aprovação de outra pessoa (quatro olhos)"
          checked={requiresReview}
          onChange={setRequiresReview}
        />
        <ErrorBanner error={save.error} />
      </form>
    </Dialog>
  )
}

export function EnvironmentsPage() {
  const { can } = useAuth()
  const admin = can('ktoggle-admin')
  const environments = useEnvironments()
  const remove = useDeleteResource('environments')
  const [editing, setEditing] = useState<Environment | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Environment | null>(null)

  return (
    <>
      <PageHeader
        title="Ambientes"
        subtitle="Cada ambiente tem suas próprias regras e bundles (ex.: staging, production)."
        actions={admin && <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Novo ambiente</Button>}
      />
      {environments.isLoading && <Spinner />}
      <ErrorBanner error={environments.error} />
      {environments.data?.length === 0 && <EmptyState title="Nenhum ambiente cadastrado" />}
      {environments.data && environments.data.length > 0 && (
        <Table head={['Chave', 'Nome', 'Descrição', 'Aprovação', 'Ordem', 'Atualizado', '']}>
          {environments.data.map((p) => (
            <tr key={p.key} className="hover:bg-surface">
              <td className="px-4 py-3"><Code value={p.key} /></td>
              <td className="px-4 py-3 font-semibold">{p.name}</td>
              <td className="px-4 py-3 text-muted">{p.description || '—'}</td>
              <td className="px-4 py-3">{p.requiresReview ? <Badge tone="yellow">exige aprovação</Badge> : <span className="text-xs text-muted">livre</span>}</td>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-kto-yellow">{p.sortOrder}</td>
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
      {editing && <EnvironmentDialog key={editing === 'new' ? 'new' : editing.key} environment={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ReasonDialog
          open
          danger
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Excluir ambiente ${deleting.key}?`}
          description="Não é possível excluir ambientes em uso por conexões SDK ou features."
          confirmLabel="Excluir"
          onConfirm={(reason) => remove.mutateAsync({ key: deleting.key, reason })}
        />
      )}
    </>
  )
}
