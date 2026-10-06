import { Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useCanEditProject,
  useCreateDraft,
  useDraftAction,
  useEnvironments,
  useFeatures,
  useOpenDrafts,
  useProjects,
  useUpdateDraftEnvironment,
} from '@/api/hooks'
import type { Feature, FeatureDraft } from '@/api/types'
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
  const discard = useDraftAction()
  const [toggling, setToggling] = useState(false)
  const [leftover, setLeftover] = useState<FeatureDraft | null>(null)
  const navigate = useNavigate()

  /** A toggle never goes live directly: it opens a draft with that change and its review screen. */
  const toggle = async (feature: Feature, environmentKey: string, enabled: boolean) => {
    if (toggling) return
    setToggling(true)
    setLeftover(null)
    try {
      const env = environments.find((e) => e.key === environmentKey)
      const draft = await createDraft.mutateAsync({
        key: feature.key,
        title: `Turn ${enabled ? 'on' : 'off'} in ${env?.name ?? environmentKey}`,
      })
      // the new draft holds what is live now; the row of this list may be older
      const rules = draft.proposed.environments[environmentKey]?.rules ?? []
      try {
        await updateEnvironment.mutateAsync({ id: draft.id, environmentKey, enabled, rules, version: draft.version })
      } catch {
        // the error banner tells what failed; do not leave an empty draft behind
        await discard.mutateAsync({ id: draft.id, action: 'discard' }).catch(() => setLeftover(draft))
        return
      }
      navigate(`/features/${encodeURIComponent(feature.key)}?draft=${draft.id}&review=1`)
    } catch {
      // shown by the error banner
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Features"
        subtitle="Flags served to SDKs in GrowthBook's format. Every change goes through a draft and a review; each publication produces an immutable, signed bundle."
        actions={can('ktoggle-editor') && (
          <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New feature</Button>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-kto-grey" />
          <Input className="pl-9" placeholder="Search by key or description" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="w-48" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </Select>
        <Input className="w-40" placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
        <Checkbox label="Archived" checked={archived} onChange={setArchived} />
      </div>

      <ErrorBanner error={features.error ?? createDraft.error ?? updateEnvironment.error} />
      {leftover && (
        <p className="mb-4 text-sm text-soft">
          The draft opened for this change could not be removed:{' '}
          <Link to={`/features/${encodeURIComponent(leftover.featureKey)}?draft=${leftover.id}`} className="font-semibold text-white hover:text-kto-red">
            open it
          </Link>{' '}
          to fix or discard it.
        </p>
      )}
      {features.isLoading ? (
        <Spinner />
      ) : !features.data?.length ? (
        <EmptyState title="No features found">
          {can('ktoggle-editor') ? 'Create the first feature to get started.' : 'Adjust the filters.'}
        </EmptyState>
      ) : (
        <Table head={['Feature', ...environments.map((e) => e.name), 'Default', 'Revision', 'Updated']}>
          {features.data.map((feature) => (
            <FeatureRow
              key={feature.key}
              feature={feature}
              environments={environments.map((e) => e.key)}
              editable={can('ktoggle-editor') && !toggling}
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
  const canEditProject = useCanEditProject(feature.projectKey)
  const canToggle = editable && canEditProject
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
                disabled={!canToggle || feature.archived}
                label={`${feature.key} in ${env}`}
                onChange={(enabled) => onToggle(env, enabled)}
              />
              {settings?.rules.length ? (
                <span className="font-mono text-xs text-kto-yellow" title="rules">{settings.rules.length}</span>
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
