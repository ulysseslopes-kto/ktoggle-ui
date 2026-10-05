import { Info, Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAttributes, useSaveResource } from '@/api/hooks'
import type { Attribute, AttributeDatatype } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Code, EmptyState, ErrorBanner, PageHeader, Spinner, Table } from '@/components/ui/Display'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'

const DATATYPES: AttributeDatatype[] = ['STRING', 'NUMBER', 'BOOLEAN', 'STRING_ARRAY', 'NUMBER_ARRAY', 'ENUM']
const PII_HINT =
  'PII attributes are never stored in clear in decision logs (LGPD): only their HMAC digest is recorded.'

function AttributeDialog({ attribute, onClose }: { attribute: Attribute | 'new'; onClose: () => void }) {
  const editing = attribute === 'new' ? null : attribute
  const save = useSaveResource<Record<string, unknown>>('attributes')
  const [key, setKey] = useState('')
  const [datatype, setDatatype] = useState<AttributeDatatype>(editing?.datatype ?? 'STRING')
  const [enumValues, setEnumValues] = useState(editing?.enumValues.join(', ') ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [hashAttribute, setHashAttribute] = useState(editing?.hashAttribute ?? false)
  const [pii, setPii] = useState(editing?.pii ?? true)
  const [archived, setArchived] = useState(editing?.archived ?? false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = {
      ...(editing ? { version: editing.version } : { key: key.trim() }),
      datatype,
      description,
      hashAttribute,
      pii,
      archived,
      enumValues: datatype === 'ENUM' ? enumValues.split(',').map((v) => v.trim()).filter(Boolean) : [],
    }
    save.mutate({ key: editing?.key, body }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `Edit attribute ${editing.key}` : 'New attribute'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="attribute-form" loading={save.isPending} disabled={!editing && !key.trim()}>Save</Button>
        </>
      }
    >
      <form id="attribute-form" onSubmit={submit} className="space-y-4">
        {!editing && (
          <Field label="Key" hint="Attribute name sent by the SDK, e.g. country">
            <Input value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </Field>
        )}
        <Field label="Data type">
          <Select value={datatype} onChange={(e) => setDatatype(e.target.value as AttributeDatatype)}>
            {DATATYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
        {datatype === 'ENUM' && (
          <Field label="Enum values" hint="Comma-separated, e.g. BR, MX, CL">
            <Input value={enumValues} onChange={(e) => setEnumValues(e.target.value)} />
          </Field>
        )}
        <Field label="Description">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <Checkbox label="Hash attribute (can be used to bucket rollouts)" checked={hashAttribute} onChange={setHashAttribute} />
          <Checkbox label="PII (personal data)" checked={pii} onChange={setPii} />
          <p className="pl-6 text-xs text-muted">{PII_HINT}</p>
          <Checkbox label="Archived" checked={archived} onChange={setArchived} />
        </div>
        <ErrorBanner error={save.error} />
      </form>
    </Dialog>
  )
}

export function AttributesPage() {
  const { can } = useAuth()
  const admin = can('ktoggle-admin')
  const attributes = useAttributes()
  const [editing, setEditing] = useState<Attribute | 'new' | null>(null)

  return (
    <>
      <PageHeader
        title="Attributes"
        subtitle="The contract of attributes SDKs send to evaluate conditions and rollouts."
        actions={admin && <Button onClick={() => setEditing('new')}><Plus className="size-4" /> New attribute</Button>}
      />
      <div className="mb-4 flex items-start gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm text-soft">
        <Info className="mt-0.5 size-4 shrink-0 text-muted" />
        <span>{PII_HINT}</span>
      </div>
      {attributes.isLoading && <Spinner />}
      <ErrorBanner error={attributes.error} />
      {attributes.data?.length === 0 && <EmptyState title="No attributes yet" />}
      {attributes.data && attributes.data.length > 0 && (
        <Table head={['Key', 'Type', 'Flags', 'Description', '']}>
          {attributes.data.map((a) => (
            <tr key={a.key} className={a.archived ? 'opacity-60 hover:bg-surface' : 'hover:bg-surface'}>
              <td className="px-4 py-3"><Code value={a.key} /></td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs">{a.datatype}</span>
                {a.datatype === 'ENUM' && a.enumValues.length > 0 && (
                  <div className="mt-1 text-xs text-muted">{a.enumValues.join(', ')}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {a.hashAttribute && <Badge tone="outline">hash</Badge>}
                  {a.pii ? (
                    <Badge tone="red"><span title={PII_HINT}>PII</span></Badge>
                  ) : (
                    <Badge tone="green"><span title="May appear in clear in decision logs.">non-PII</span></Badge>
                  )}
                  {a.archived && <Badge>archived</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{a.description || '—'}</td>
              <td className="px-4 py-3">
                {admin && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(a)}><Pencil className="size-4" /></Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <AttributeDialog key={editing === 'new' ? 'new' : editing.key} attribute={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
