import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateFeature, useProjects } from '@/api/hooks'
import type { Json, ValueType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorBanner } from '@/components/ui/Display'
import { Field, Input, Select } from '@/components/ui/Form'
import { defaultFor, ValueEditor } from './ValueEditor'

const TYPES: { value: ValueType; label: string }[] = [
  { value: 'BOOLEAN', label: 'Boolean (on/off)' },
  { value: 'STRING', label: 'String' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'JSON', label: 'JSON' },
]

/** Creates a feature (disabled in every environment). Later changes go through drafts. */
export function FeatureFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New feature"
      description="Every feature starts off in all environments; later changes go through drafts.">
      {open && <FeatureForm onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function FeatureForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const projects = useProjects().data ?? []
  const create = useCreateFeature()
  const [key, setKey] = useState('')
  const [valueType, setValueType] = useState<ValueType>('BOOLEAN')
  const [defaultValue, setDefaultValue] = useState<Json | undefined>(false)
  const [projectKey, setProjectKey] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('')
  const [tags, setTags] = useState('')

  const submit = async () => {
    if (defaultValue === undefined) return
    const created = await create.mutateAsync({
      key: key.trim(),
      valueType,
      defaultValue,
      projectKey: projectKey || null,
      description: description || undefined,
      owner: owner || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    onDone()
    navigate(`/features/${encodeURIComponent(created.key)}`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Key" hint="Immutable, e.g. checkout-v2">
          <Input value={key} onChange={(e) => setKey(e.target.value)} autoFocus placeholder="my-feature" />
        </Field>
        <Field label="Value type">
          <Select
            value={valueType}
            onChange={(e) => {
              const type = e.target.value as ValueType
              setValueType(type)
              setDefaultValue(defaultFor(type))
            }}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Default value" hint="Served when no rule applies.">
        <ValueEditor type={valueType} value={defaultValue} onChange={setDefaultValue} />
      </Field>
      <Field label="Project">
        <Select value={projectKey} onChange={(e) => setProjectKey(e.target.value)}>
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Owner">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="squad or person" />
        </Field>
        <Field label="Tags" hint="Comma-separated">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="checkout, mobile" />
        </Field>
      </div>
      <ErrorBanner error={create.error} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={submit} loading={create.isPending} disabled={defaultValue === undefined || !key.trim()}>Create feature</Button>
      </div>
    </div>
  )
}
