import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useEnvironments, useReviewSettings, useSaveResource, useSaveReviewSettings } from '@/api/hooks'
import type { Environment, ReviewSettings } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Badge, Card, ErrorBanner, formatDate, PageHeader, Spinner } from '@/components/ui/Display'
import { Input } from '@/components/ui/Form'
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
        title="Configurações"
        subtitle="Revisão e aprovação: quem aprova drafts e quais ambientes exigem aprovação antes da publicação."
      />
      <div className="space-y-6">
        {settings.isLoading ? <Spinner /> : settings.data && <ApproversCard settings={settings.data} editable={admin} />}
        <ErrorBanner error={settings.error} />
        <Card title="Ambientes que exigem aprovação">
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
      title="Quem pode aprovar drafts"
      actions={<span className="text-xs text-muted">atualizado por {settings.updatedBy} · {formatDate(settings.updatedAt)}</span>}
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ChipInput
            label="Papéis (Keycloak) aprovadores"
            values={draft.approverRoles}
            suggestions={ROLE_SUGGESTIONS}
            editable={editable}
            onChange={(approverRoles) => setDraft({ ...draft, approverRoles })}
          />
          <ChipInput
            label="Usuários aprovadores"
            values={draft.approverUsers}
            placeholder="username do Keycloak"
            editable={editable}
            onChange={(approverUsers) => setDraft({ ...draft, approverUsers })}
          />
        </div>

        <div className="space-y-4 border-t border-line pt-5">
          <Switch
            checked={draft.allowSelfApproval}
            editable={editable}
            onChange={(allowSelfApproval) => setDraft({ ...draft, allowSelfApproval })}
            title="Permitir que o autor aprove o próprio draft"
            description="Desliga a regra dos quatro olhos: quem criou o draft pode aprová-lo e publicá-lo sozinho."
            warning={draft.allowSelfApproval ? 'Com esta opção ligada, uma única pessoa pode alterar ambientes protegidos.' : undefined}
          />
          <Switch
            checked={draft.resetReviewOnChange}
            editable={editable}
            onChange={(resetReviewOnChange) => setDraft({ ...draft, resetReviewOnChange })}
            title="Alterar um draft aprovado exige nova aprovação"
            description="Evita publicar algo diferente do que foi aprovado."
          />
          <Switch
            checked={draft.bypassEnabled}
            editable={editable}
            onChange={(bypassEnabled) => setDraft({ ...draft, bypassEnabled })}
            title="Publicação de emergência por admins"
            description="Admins podem publicar sem aprovação em incidentes. O motivo é obrigatório e a ação fica destacada na auditoria."
          />
        </div>

        <ErrorBanner error={save.error} />
        {editable && (
          <div className="flex items-center justify-end gap-3">
            {empty && <span className="text-xs text-kto-red">Informe ao menos um papel ou usuário aprovador.</span>}
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(settings)}>Descartar</Button>
            <Button disabled={!dirty || empty} loading={save.isPending} onClick={() => save.mutate(draft)}>Salvar</Button>
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
          {environment.requiresReview ? 'Publicação exige aprovação de outra pessoa.' : 'O autor do draft pode publicar diretamente.'}
        </p>
        <ErrorBanner error={save.error} />
      </div>
      <div className="flex items-center gap-3">
        {environment.requiresReview && <Badge tone="yellow">exige aprovação</Badge>}
        <Toggle
          checked={environment.requiresReview}
          disabled={!editable || save.isPending}
          label={`Exigir aprovação em ${environment.key}`}
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

function ChipInput({ label, values, onChange, editable, suggestions = [], placeholder }: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  editable: boolean
  suggestions?: string[]
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const add = (value: string) => {
    const v = value.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setText('')
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-soft">{label}</p>
      <div className="flex min-h-10 flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-sm text-muted">nenhum</span>}
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-1 font-mono text-xs">
            {v}
            {editable && (
              <button type="button" aria-label={`Remover ${v}`} className="text-muted hover:text-kto-red"
                onClick={() => onChange(values.filter((x) => x !== v))}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {editable && (
        <>
          <Input
            value={text}
            placeholder={placeholder ?? 'adicionar e pressionar Enter'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(text)
              }
            }}
          />
          {suggestions.filter((s) => !values.includes(s)).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.filter((s) => !values.includes(s)).map((s) => (
                <button key={s} type="button" onClick={() => add(s)}
                  className="rounded border border-dashed border-surface-3 px-2 py-0.5 font-mono text-xs text-muted hover:border-kto-red hover:text-white">
                  + {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
