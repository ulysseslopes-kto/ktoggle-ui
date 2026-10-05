import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAttributes, useDeleteResource, useSaveResource, useSavedGroups } from '@/api/hooks'
import type { Attribute, Json, SavedGroup, SavedGroupType } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Code, EmptyState, ErrorBanner, PageHeader, Spinner, Table } from '@/components/ui/Display'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'

function parseValues(text: string, attribute?: Attribute): Json[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return attribute?.datatype === 'NUMBER' || attribute?.datatype === 'NUMBER_ARRAY' ? lines.map(Number) : lines
}

function SavedGroupDialog({ group, onClose }: { group: SavedGroup | 'new'; onClose: () => void }) {
  const editing = group === 'new' ? null : group
  const attributes = useAttributes()
  const save = useSaveResource<Record<string, unknown>>('saved-groups')
  const [key, setKey] = useState('')
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [type, setType] = useState<SavedGroupType>(editing?.type ?? 'LIST')
  const [attributeKey, setAttributeKey] = useState(editing?.attributeKey ?? '')
  const [values, setValues] = useState(editing?.values?.map(String).join('\n') ?? '')
  const [condition, setCondition] = useState(JSON.stringify(editing?.condition ?? {}, null, 2))
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    const common = { name: name.trim(), description, type, ...(editing ? { version: editing.version } : { key: key.trim() }) }
    let body: Record<string, unknown>
    if (type === 'LIST') {
      const attribute = attributes.data?.find((a) => a.key === attributeKey)
      const parsed = parseValues(values, attribute)
      if (parsed.some((v) => typeof v === 'number' && Number.isNaN(v))) {
        setLocalError('O atributo é numérico, mas há valores que não são números.')
        return
      }
      body = { ...common, attributeKey, values: parsed }
    } else {
      try {
        body = { ...common, condition: JSON.parse(condition) as Json }
      } catch (err) {
        setLocalError(`JSON inválido: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    }
    save.mutate({ key: editing?.key, body }, { onSuccess: onClose })
  }

  const invalid = !name.trim() || (!editing && !key.trim()) || (type === 'LIST' && !attributeKey)

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `Editar grupo ${editing.key}` : 'Novo grupo salvo'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="saved-group-form" loading={save.isPending} disabled={invalid}>Salvar</Button>
        </>
      }
    >
      <form id="saved-group-form" onSubmit={submit} className="space-y-4">
        {!editing && (
          <Field label="Chave">
            <Input value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </Field>
        )}
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Descrição">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Tipo" hint={editing ? 'O tipo não pode ser alterado após a criação.' : undefined}>
          <Select value={type} disabled={Boolean(editing)} onChange={(e) => setType(e.target.value as SavedGroupType)}>
            <option value="LIST">LIST — lista de valores de um atributo</option>
            <option value="CONDITION">CONDITION — condição JSON</option>
          </Select>
        </Field>
        {type === 'LIST' ? (
          <>
            <Field label="Atributo">
              <Select value={attributeKey} onChange={(e) => setAttributeKey(e.target.value)}>
                <option value="">Selecione…</option>
                {attributes.data?.filter((a) => !a.archived || a.key === attributeKey).map((a) => (
                  <option key={a.key} value={a.key}>{a.key} ({a.datatype})</option>
                ))}
              </Select>
            </Field>
            <Field label="Valores" hint="Um valor por linha. Números são enviados como número quando o atributo é NUMBER.">
              <Textarea rows={8} value={values} onChange={(e) => setValues(e.target.value)} />
            </Field>
          </>
        ) : (
          <Field label="Condição (JSON, sintaxe MongoDB-like do GrowthBook)">
            <Textarea rows={8} value={condition} onChange={(e) => setCondition(e.target.value)} spellCheck={false} />
          </Field>
        )}
        {localError && <p className="text-sm text-kto-red">{localError}</p>}
        <ErrorBanner error={save.error} />
      </form>
    </Dialog>
  )
}

function Preview({ group }: { group: SavedGroup }) {
  if (group.type === 'LIST') {
    return (
      <span className="text-soft">
        <Code value={group.attributeKey ?? '—'} /> ·{' '}
        <span className="font-mono text-xs font-semibold text-kto-yellow">{group.values?.length ?? 0}</span> valores
      </span>
    )
  }
  const json = JSON.stringify(group.condition)
  return <span className="font-mono text-xs text-soft" title={json}>{json.length > 60 ? `${json.slice(0, 60)}…` : json}</span>
}

export function SavedGroupsPage() {
  const { can } = useAuth()
  const editor = can('ktoggle-editor')
  const groups = useSavedGroups()
  const remove = useDeleteResource('saved-groups')
  const [editing, setEditing] = useState<SavedGroup | 'new' | null>(null)
  const [deleting, setDeleting] = useState<SavedGroup | null>(null)

  return (
    <>
      <PageHeader
        title="Grupos salvos"
        subtitle="Listas de valores ou condições reutilizáveis nas regras das features."
        actions={editor && <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Novo grupo</Button>}
      />
      {groups.isLoading && <Spinner />}
      <ErrorBanner error={groups.error} />
      {groups.data?.length === 0 && <EmptyState title="Nenhum grupo salvo" />}
      {groups.data && groups.data.length > 0 && (
        <Table head={['Chave', 'Nome', 'Tipo', 'Conteúdo', '']}>
          {groups.data.map((g) => (
            <tr key={g.key} className="hover:bg-surface">
              <td className="px-4 py-3"><Code value={g.key} /></td>
              <td className="px-4 py-3">
                <div className="font-semibold">{g.name}</div>
                {g.description && <div className="text-xs text-muted">{g.description}</div>}
              </td>
              <td className="px-4 py-3"><Badge tone="outline">{g.type}</Badge></td>
              <td className="px-4 py-3"><Preview group={g} /></td>
              <td className="px-4 py-3">
                {editor && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(g)}><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Excluir" onClick={() => setDeleting(g)}><Trash2 className="size-4" /></Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <SavedGroupDialog key={editing === 'new' ? 'new' : editing.key} group={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ReasonDialog
          open
          danger
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Excluir grupo ${deleting.key}?`}
          description="Grupos referenciados por regras de features não podem ser excluídos."
          confirmLabel="Excluir"
          onConfirm={(reason) => remove.mutateAsync({ key: deleting.key, reason })}
        />
      )}
    </>
  )
}
