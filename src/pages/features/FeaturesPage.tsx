import { Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCreateDraft, useEnvironments, useFeatures, useOpenDrafts, useProjects, useUpdateDraftEnvironment } from '@/api/hooks'
import type { Feature } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ErrorBanner, formatDate, PageHeader, Spinner, Table, ValueChip } from '@/components/ui/Display'
import { Checkbox, Input, Select } from '@/components/ui/Form'
import { Toggle } from '@/components/ui/Toggle'
import { FeatureFormDialog } from './FeatureFormDialog'

/** Feature list with one on/off switch per environment, as in GrowthBook. */
export function FeaturesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [tag, setTag] = useState('')
  const [archived, setArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const features = useFeatures({ search: deferredSearch, projectKey, tag: tag || undefined, archived })
  const environments = useEnvironments().data ?? []
  const projects = useProjects().data ?? []
  const openDrafts = useOpenDrafts().data ?? []
  const createDraft = useCreateDraft()
  const updateEnvironment = useUpdateDraftEnvironment()
  const navigate = useNavigate()

  /** A toggle never goes live directly: it opens a draft with that change and its review screen. */
  const toggle = async (feature: Feature, environmentKey: string, enabled: boolean) => {
    const env = environments.find((e) => e.key === environmentKey)
    const draft = await createDraft.mutateAsync({
      key: feature.key,
      title: `${enabled ? 'Ligar' : 'Desligar'} em ${env?.name ?? environmentKey}`,
    })
    const rules = feature.environments[environmentKey]?.rules ?? []
    await updateEnvironment.mutateAsync({ id: draft.id, environmentKey, enabled, rules, version: draft.version })
    navigate(`/features/${encodeURIComponent(feature.key)}?draft=${draft.id}&review=1`)
  }

  return (
    <>
      <PageHeader
        title="Features"
        subtitle="Flags servidas aos SDKs no formato do GrowthBook. Toda alteração passa por draft e revisão; cada publicação gera um bundle imutável e assinado."
        actions={can('ktoggle-editor') && (
          <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Nova feature</Button>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-kto-grey" />
          <Input className="pl-9" placeholder="Buscar por chave ou descrição" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="w-48" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} aria-label="Projeto">
          <option value="">Todos os projetos</option>
          {projects.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </Select>
        <Input className="w-40" placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
        <Checkbox label="Arquivadas" checked={archived} onChange={setArchived} />
      </div>

      <ErrorBanner error={features.error ?? createDraft.error ?? updateEnvironment.error} />
      {features.isLoading ? (
        <Spinner />
      ) : !features.data?.length ? (
        <EmptyState title="Nenhuma feature encontrada">
          {can('ktoggle-editor') ? 'Crie a primeira feature para começar.' : 'Ajuste os filtros.'}
        </EmptyState>
      ) : (
        <Table head={['Feature', ...environments.map((e) => e.name), 'Padrão', 'Revisão', 'Atualizada']}>
          {features.data.map((feature) => (
            <FeatureRow
              key={feature.key}
              feature={feature}
              environments={environments.map((e) => e.key)}
              editable={can('ktoggle-editor') && !createDraft.isPending}
              drafts={openDrafts.filter((d) => d.featureKey === feature.key).length}
              onToggle={(environmentKey, enabled) => void toggle(feature, environmentKey, enabled)}
            />
          ))}
        </Table>
      )}

      <FeatureFormDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}

function FeatureRow({ feature, environments, editable, drafts, onToggle }: {
  feature: Feature
  environments: string[]
  editable: boolean
  drafts: number
  onToggle: (environmentKey: string, enabled: boolean) => void
}) {
  return (
    <tr className="hover:bg-surface/60">
      <td className="px-4 py-3">
        <Link to={`/features/${encodeURIComponent(feature.key)}`} className="font-mono text-sm font-semibold text-white hover:text-kto-red">
          {feature.key}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="outline">{feature.valueType}</Badge>
          {drafts > 0 && <Badge tone='yellow'>{drafts} draft{drafts > 1 ? 's' : ''}</Badge>}
          {feature.projectKey && <Badge>{feature.projectKey}</Badge>}
          {feature.tags.map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
          {feature.description && <span className="truncate text-xs text-muted">{feature.description}</span>}
        </div>
      </td>
      {environments.map((env) => {
        const settings = feature.environments[env]
        return (
          <td key={env} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Toggle
                size="sm"
                checked={Boolean(settings?.enabled)}
                disabled={!editable || feature.archived}
                label={`${feature.key} em ${env}`}
                onChange={(enabled) => onToggle(env, enabled)}
              />
              {settings?.rules.length ? (
                <span className="font-mono text-xs text-kto-yellow" title="regras">{settings.rules.length}</span>
              ) : null}
            </div>
          </td>
        )
      })}
      <td className="px-4 py-3"><ValueChip value={feature.defaultValue} /></td>
      <td className="px-4 py-3 font-mono text-xs text-kto-yellow">#{feature.revision}</td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
        {feature.updatedBy}
        <br />
        {formatDate(feature.updatedAt)}
      </td>
    </tr>
  )
}
