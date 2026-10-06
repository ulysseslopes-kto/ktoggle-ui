import { clsx } from 'clsx'
import { ArrowLeft, FilePenLine, GitPullRequest, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  useCreateDraft,
  useDraft,
  useDraftAction,
  useEnvironments,
  useFeature,
  useFeatureDrafts,
  useCanEditProject,
  useUpdateDraftEnvironment,
} from '@/api/hooks'
import type { EnvironmentSettings, Feature, FeatureDraft, FeatureSnapshot } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Badge, Card, ErrorBanner, formatDate, PageHeader, Spinner, ValueChip } from '@/components/ui/Display'
import { Select } from '@/components/ui/Form'
import { DraftReviewDialog } from './DraftReviewDialog'
import { STATUS_LABEL, STATUS_TONE } from './draftLabels'
import { EnvironmentPanel } from './EnvironmentPanel'
import { MetadataDialog } from './MetadataDialog'
import { PrerequisitesCard } from './PrerequisitesCard'
import { RevisionsCard } from './RevisionsCard'
import { TestPanel } from './TestPanel'

const LIVE = ''

/**
 * Feature page, draft-first like GrowthBook: you either look at what is live (read-only) or at a draft. The first
 * edit made while looking at the live version opens a new draft automatically; publishing is the only way to
 * change what SDKs receive.
 */
export function FeatureDetailPage() {
  const { key = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { can } = useAuth()
  const feature = useFeature(key)
  const canEditLiveProject = useCanEditProject(feature.data?.projectKey)
  const drafts = useFeatureDrafts(key)
  const environments = useEnvironments()
  const createDraft = useCreateDraft()
  const updateEnvironment = useUpdateDraftEnvironment()
  const discard = useDraftAction()
  const [activeEnv, setActiveEnv] = useState<string | null>(null)
  const [editingMetadata, setEditingMetadata] = useState(false)

  const draftId = params.get('draft') ?? LIVE
  const reviewing = params.get('review') === '1'
  const openDraft = drafts.data?.find((d) => d.id === draftId) ?? null
  // the view also carries the user's permissions; published or discarded drafts (e.g. linked from the review
  // queue) are not among the open ones and are shown from it, read-only
  const view = useDraft(draftId || null)
  const draft = openDraft ?? view.data?.draft ?? null
  const closed = draft !== null && (draft.status === 'PUBLISHED' || draft.status === 'DISCARDED')

  const selectDraft = (id: string, review = false) => {
    const next = new URLSearchParams(params)
    if (id) next.set('draft', id)
    else next.delete('draft')
    if (review) next.set('review', '1')
    else next.delete('review')
    setParams(next, { replace: true })
  }

  if (feature.isLoading || environments.isLoading || drafts.isLoading || (!openDraft && view.isLoading)) return <Spinner />
  if (feature.error || !feature.data) return <ErrorBanner error={feature.error ?? new Error('Feature not found')} />

  const f = feature.data
  const envs = environments.data ?? []
  const current = activeEnv ?? envs.find((e) => e.requiresReview)?.key ?? envs[0]?.key ?? null
  const content: FeatureSnapshot = draft?.proposed ?? snapshotOf(f)
  const canEdit = can('ktoggle-editor') && canEditLiveProject === true
  const projectLocked = can('ktoggle-editor') && canEditLiveProject === false
  const editable = canEdit && !closed
  // the server lets the author or an admin discard; it says so in the draft view
  const canDiscard = can('ktoggle-editor') && !closed && Boolean(view.data?.permissions.discard)
  const busy = createDraft.isPending || updateEnvironment.isPending

  /** Returns the selected draft, or opens a new one when looking at the live version. */
  const ensureDraft = async (): Promise<FeatureDraft> => {
    if (draft) return draft
    const created = await createDraft.mutateAsync({ key: f.key })
    selectDraft(created.id)
    return created
  }

  const changeEnvironment = async (environmentKey: string, settings: EnvironmentSettings) => {
    const target = await ensureDraft()
    await updateEnvironment.mutateAsync({ id: target.id, environmentKey, enabled: settings.enabled, rules: settings.rules, version: target.version })
  }

  return (
    <div className="space-y-6">
      <Link to="/features" className="inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ArrowLeft className="size-4" /> Features
      </Link>
      <PageHeader
        title={f.key}
        mono
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{f.valueType}</Badge>
            {content.projectKey && <Badge>{content.projectKey}</Badge>}
            {content.archived && <Badge tone="red">archived</Badge>}
            {content.tags.map((t) => (
              <Badge key={t}>#{t}</Badge>
            ))}
            <span>
              live: revision <span className="font-mono text-kto-yellow">#{f.revision}</span> · {f.updatedBy} · {formatDate(f.updatedAt)}
            </span>
          </span>
        }
        actions={editable && (
          <Button variant="secondary" disabled={busy} onClick={() => setEditingMetadata(true)}><Pencil className="size-4" /> Edit</Button>
        )}
      />

      <DraftBar
        feature={f}
        drafts={drafts.data ?? []}
        draft={draft}
        closed={closed}
        canEdit={canEdit}
        canDiscard={canDiscard}
        creating={createDraft.isPending}
        onSelect={(id) => selectDraft(id)}
        onCreate={() => createDraft.mutate({ key: f.key }, { onSuccess: (d) => selectDraft(d.id) })}
        onReview={() => selectDraft(draftId, true)}
        onDiscard={() => draft && discard.mutate({ id: draft.id, action: 'discard' }, { onSuccess: () => selectDraft(LIVE) })}
      />
      {projectLocked && (
        <p className="flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm text-soft">
          <Lock className="size-4 text-kto-red" />
          Only the editors of project <span className="font-mono text-white">{f.projectKey}</span> can change this feature. You can
          still read it, test it and review drafts.
        </p>
      )}
      <ErrorBanner error={createDraft.error ?? updateEnvironment.error ?? discard.error ?? (draft ? null : view.error)} />

      <Card>
        <dl className="grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Default value</dt>
            <dd className="mt-1.5"><ValueChip value={content.defaultValue} /></dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Owner</dt>
            <dd className="mt-1.5 text-sm">{content.owner || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Created by</dt>
            <dd className="mt-1.5 text-sm">{f.createdBy} · {formatDate(f.createdAt)}</dd>
          </div>
          {content.description && (
            <div className="sm:col-span-3">
              <dt className="text-xs uppercase tracking-wide text-muted">Description</dt>
              <dd className="mt-1.5 text-sm text-soft">{content.description}</dd>
            </div>
          )}
        </dl>
      </Card>

      <PrerequisitesCard content={content} editable={editable} ensureDraft={ensureDraft} />

      <section>
        <h2 className="mb-3 text-lg font-bold">Rules by environment</h2>
        <div className="mb-4 flex gap-1 border-b border-line">
          {envs.map((env) => {
            const settings = content.environments[env.key]
            return (
              <button
                key={env.key}
                type="button"
                onClick={() => setActiveEnv(env.key)}
                className={clsx(
                  '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                  current === env.key ? 'border-kto-red text-white' : 'border-transparent text-muted hover:text-white',
                )}
              >
                <span className={clsx('size-2 rounded-full', settings?.enabled ? 'bg-kto-green' : 'bg-surface-3')} />
                {env.name}
                {env.requiresReview && <span title="Publishing requires approval" className="text-[0.625rem] text-kto-yellow">●</span>}
              </button>
            )
          })}
        </div>
        {envs.length === 0 ? (
          <p className="text-sm text-muted">Create an environment to configure rules.</p>
        ) : (
          current && (
            <EnvironmentPanel
              key={`${current}-${draft?.id ?? 'live'}`}
              featureKey={f.key}
              projectKey={content.projectKey}
              environmentKey={current}
              settings={content.environments[current] ?? { enabled: false, rules: [] }}
              valueType={f.valueType}
              defaultValue={content.defaultValue}
              editable={editable}
              busy={busy}
              onChange={(settings) => void changeEnvironment(current, settings)}
            />
          )
        )}
        {editable && !draft && (
          <p className="mt-3 text-xs text-muted">
            You are viewing the published version. Any change opens a <b>draft</b>; nothing changes for SDKs until it is published.
          </p>
        )}
      </section>

      <TestPanel featureKey={f.key} environments={envs} content={content} draft={draft?.proposed} />
      <RevisionsCard feature={f} onDraftCreated={(d) => selectDraft(d.id)} />

      <MetadataDialog open={editingMetadata} onOpenChange={setEditingMetadata} content={content} ensureDraft={ensureDraft} />
      {draft && (
        <DraftReviewDialog
          draftId={draft.id}
          open={reviewing}
          onOpenChange={(open) => selectDraft(draftId, open)}
          onPublished={() => selectDraft(LIVE)}
        />
      )}
    </div>
  )
}

function DraftBar({ feature, drafts, draft, closed, canEdit, canDiscard, creating, onSelect, onCreate, onReview, onDiscard }: {
  feature: Feature
  drafts: FeatureDraft[]
  draft: FeatureDraft | null
  /** published or discarded: read-only, not among the open drafts */
  closed: boolean
  canEdit: boolean
  canDiscard: boolean
  creating: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onReview: () => void
  onDiscard: () => void
}) {
  return (
    <div className={clsx(
      'sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3',
      draft ? 'border-kto-red bg-surface shadow-2xl' : 'border-line bg-surface',
    )}>
      <div className="flex flex-wrap items-center gap-3">
        <FilePenLine className={clsx('size-5', draft ? 'text-kto-red' : 'text-muted')} />
        <Select className="w-auto min-w-72" value={draft?.id ?? LIVE} onChange={(e) => onSelect(e.target.value)} aria-label="Version">
          <option value={LIVE}>Published · revision #{feature.revision}</option>
          {[...drafts, ...(closed && draft ? [draft] : [])].map((d) => (
            <option key={d.id} value={d.id}>
              Draft · {d.title ?? 'untitled'} · {d.createdBy} · {STATUS_LABEL[d.status]}
            </option>
          ))}
        </Select>
        {draft ? (
          <>
            <Badge tone={STATUS_TONE[draft.status]}>{STATUS_LABEL[draft.status]}</Badge>
            <span className="text-xs text-muted">
              based on revision #{draft.baseRevision}
              {draft.publishedRevision ? ` · published as revision #${draft.publishedRevision}` : ''} · edited by {draft.updatedBy}{' '}
              {formatDate(draft.updatedAt)}{closed ? ' · read-only' : ''}
            </span>
          </>
        ) : (
          drafts.length > 0 && <span className="text-xs text-kto-yellow">{drafts.length} open draft(s)</span>
        )}
      </div>
      <div className="flex gap-2">
        {draft ? (
          closed ? (
            <Button size="sm" variant="secondary" onClick={onReview}><GitPullRequest className="size-3.5" /> Changes & history</Button>
          ) : (
            <>
              {canDiscard && <Button size="sm" variant="ghost" onClick={onDiscard}><Trash2 className="size-3.5" /> Discard</Button>}
              <Button size="sm" onClick={onReview}><GitPullRequest className="size-3.5" /> Review & publish</Button>
            </>
          )
        ) : (
          canEdit && <Button size="sm" variant="secondary" loading={creating} onClick={onCreate}><Plus className="size-3.5" /> New draft</Button>
        )}
      </div>
    </div>
  )
}

function snapshotOf(f: Feature): FeatureSnapshot {
  return {
    key: f.key,
    projectKey: f.projectKey,
    valueType: f.valueType,
    defaultValue: f.defaultValue,
    description: f.description,
    owner: f.owner,
    tags: f.tags,
    archived: f.archived,
    prerequisites: f.prerequisites ?? [],
    environments: f.environments,
  }
}
