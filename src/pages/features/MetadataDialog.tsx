import { useState } from 'react'
import { useProjects, useUpdateDraftMetadata } from '@/api/hooks'
import type { FeatureDraft, FeatureSnapshot, Json } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorBanner } from '@/components/ui/Display'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { ValueEditor } from './ValueEditor'

/** Edits default value, metadata and archiving — in a draft, like every other change. */
export function MetadataDialog({ open, onOpenChange, content, ensureDraft }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: FeatureSnapshot
  ensureDraft: () => Promise<FeatureDraft>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Editar feature"
      description="As alterações vão para o draft e só entram no ar depois de publicadas.">
      {open && <MetadataForm content={content} ensureDraft={ensureDraft} onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function MetadataForm({ content, ensureDraft, onDone }: {
  content: FeatureSnapshot
  ensureDraft: () => Promise<FeatureDraft>
  onDone: () => void
}) {
  const projects = useProjects().data ?? []
  const update = useUpdateDraftMetadata()
  const [defaultValue, setDefaultValue] = useState<Json | undefined>(content.defaultValue)
  const [projectKey, setProjectKey] = useState(content.projectKey ?? '')
  const [description, setDescription] = useState(content.description ?? '')
  const [owner, setOwner] = useState(content.owner ?? '')
  const [tags, setTags] = useState(content.tags.join(', '))
  const [archived, setArchived] = useState(content.archived)

  const submit = async () => {
    if (defaultValue === undefined) return
    const draft = await ensureDraft()
    await update.mutateAsync({
      id: draft.id,
      version: draft.version,
      projectKey: projectKey || null,
      defaultValue,
      description: description || null,
      owner: owner || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      archived,
    })
    onDone()
  }

  return (
    <div className="space-y-4">
      <Field label="Valor padrão" hint="Servido quando nenhuma regra se aplica.">
        <ValueEditor type={content.valueType} value={defaultValue} onChange={setDefaultValue} />
      </Field>
      <Field label="Projeto">
        <Select value={projectKey} onChange={(e) => setProjectKey(e.target.value)}>
          <option value="">Nenhum</option>
          {projects.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Descrição">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Responsável">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
        <Field label="Tags" hint="Separadas por vírgula">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
      <Checkbox
        label="Arquivada (deixa de ser enviada aos SDKs; nada é apagado)"
        checked={archived}
        onChange={setArchived}
      />
      <ErrorBanner error={update.error} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button onClick={submit} loading={update.isPending} disabled={defaultValue === undefined}>Salvar no draft</Button>
      </div>
    </div>
  )
}
