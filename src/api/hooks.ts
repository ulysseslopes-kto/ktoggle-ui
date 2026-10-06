import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useAuth, type CurrentUser } from '@/auth/auth'
import { api } from './client'
import type {
  ApiToken,
  ApiTokenRole,
  Attribute,
  AuditEntry,
  BundleActivation,
  Bundle,
  ChainVerification,
  CreatedApiToken,
  CreatedWebhook,
  DecisionEvent,
  DraftStatus,
  DraftView,
  DeliveryLogEntry,
  Dependent,
  Environment,
  EnvironmentSettings,
  EvaluationResult,
  Feature,
  FeatureDraft,
  FeatureSnapshot,
  ImportReport,
  MigrationStatus,
  FeatureRevision,
  Json,
  Prerequisite,
  Project,
  ReplayResult,
  ReviewSettings,
  Rule,
  SavedGroup,
  SdkConnection,
  ShadowConnectionStatus,
  ShadowRun,
  ValueType,
  VerifiedBundle,
  Webhook,
  WebhookDelivery,
  WebhookEventInfo,
  WebhookFormat,
} from './types'

const V1 = '/admin/v1'

/**
 * Mutations invalidate everything that may show derived state (bundles, audit) — simple and always correct. A mutation
 * stays pending until its own queries are refetched, so the next action never starts from stale data (e.g. an old draft
 * version); {@code remember} writes the response into the cache right away.
 */
function useMutate<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  invalidate: QueryKey[] = [],
  remember?: (queryClient: QueryClient, result: TResult, vars: TVars) => void,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      remember?.(queryClient, result, vars)
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
      void queryClient.invalidateQueries({ queryKey: ['bundles'] })
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    },
  })
}

// ---- Catalog -----------------------------------------------------------------------------------

export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>(`${V1}/projects`) })
export const useEnvironments = () =>
  useQuery({ queryKey: ['environments'], queryFn: () => api<Environment[]>(`${V1}/environments`) })
export const useAttributes = () =>
  useQuery({ queryKey: ['attributes'], queryFn: () => api<Attribute[]>(`${V1}/attributes`) })
export const useSavedGroups = () =>
  useQuery({ queryKey: ['saved-groups'], queryFn: () => api<SavedGroup[]>(`${V1}/saved-groups`) })
export const useSdkConnections = () =>
  useQuery({ queryKey: ['sdk-connections'], queryFn: () => api<SdkConnection[]>(`${V1}/sdk-connections`) })
export const useSdkConnection = (clientKey: string) =>
  useQuery({
    queryKey: ['sdk-connections', clientKey],
    queryFn: () => api<SdkConnection>(`${V1}/sdk-connections/${clientKey}`),
  })

type Upsert<T> = { key?: string; body: T; reason?: string }

/** Generic create (no key) / update (key) for the simple catalog resources. */
export function useSaveResource<T>(resource: string) {
  return useMutate(
    ({ key, body, reason }: Upsert<T>) =>
      key
        ? api(`${V1}/${resource}/${encodeURIComponent(key)}`, { method: 'PUT', body, reason })
        : api(`${V1}/${resource}`, { method: 'POST', body, reason }),
    [[resource]],
  )
}

export function useDeleteResource(resource: string) {
  return useMutate(
    ({ key, reason }: { key: string; reason?: string }) =>
      api(`${V1}/${resource}/${encodeURIComponent(key)}`, { method: 'DELETE', reason }),
    [[resource]],
  )
}

// ---- Features ----------------------------------------------------------------------------------

export interface FeatureFilter {
  search?: string
  projectKey?: string
  tag?: string
  archived?: boolean
}

export const useFeatures = (filter: FeatureFilter) =>
  useQuery({
    queryKey: ['features', filter],
    queryFn: () =>
      api<Feature[]>(`${V1}/features`, {
        query: { search: filter.search, projectKey: filter.projectKey, tag: filter.tag, archived: filter.archived ?? false },
      }),
  })

export const useFeature = (key: string) =>
  useQuery({ queryKey: ['features', key], queryFn: () => api<Feature>(`${V1}/features/${encodeURIComponent(key)}`) })

export const useFeatureDependents = (key: string) =>
  useQuery({ queryKey: ['features', key, 'dependents'], queryFn: () => api<Dependent[]>(`${V1}/features/${encodeURIComponent(key)}/dependents`) })

export const useFeatureRevisions = (key: string) =>
  useQuery({
    queryKey: ['features', key, 'revisions'],
    queryFn: () => api<FeatureRevision[]>(`${V1}/features/${encodeURIComponent(key)}/revisions`),
  })

export interface CreateFeature {
  key: string
  projectKey?: string | null
  valueType: ValueType
  defaultValue: Json
  description?: string
  owner?: string
  tags?: string[]
}

export const useCreateFeature = () =>
  useMutate((body: CreateFeature) => api<Feature>(`${V1}/features`, { method: 'POST', body }), [['features']])

// ---- Drafts & review ---------------------------------------------------------------------------

/** Every change to an existing feature is staged in a draft; only publishing changes what SDKs receive. */
const draftKeys: QueryKey[] = [['features'], ['drafts']]

/** Writes a draft returned by a mutation into the cache at once, so the next edit sends its current version. */
function rememberDraft(queryClient: QueryClient, draft: FeatureDraft) {
  const open = draft.status !== 'PUBLISHED' && draft.status !== 'DISCARDED'
  queryClient.setQueryData<FeatureDraft[]>(['drafts', 'feature', draft.featureKey], (drafts) => {
    if (!drafts) return drafts
    const others = drafts.filter((d) => d.id !== draft.id)
    if (!open) return others
    return others.length === drafts.length ? [...drafts, draft] : drafts.map((d) => (d.id === draft.id ? draft : d))
  })
  queryClient.setQueryData<DraftView>(['drafts', 'one', draft.id], (view) => (view ? { ...view, draft } : view))
}

export const useOpenDrafts = () =>
  useQuery({ queryKey: ['drafts', 'open'], queryFn: () => api<FeatureDraft[]>(`${V1}/drafts`) })

export const useDraftsByStatus = (status: DraftStatus[]) =>
  useQuery({
    queryKey: ['drafts', 'status', status],
    queryFn: () => api<FeatureDraft[]>(`${V1}/drafts?${status.map((s) => `status=${s}`).join('&')}`),
  })

export const useFeatureDrafts = (key: string) =>
  useQuery({
    queryKey: ['drafts', 'feature', key],
    queryFn: () => api<FeatureDraft[]>(`${V1}/features/${encodeURIComponent(key)}/drafts`),
  })

export const useDraft = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['drafts', 'one', id],
    enabled: Boolean(id),
    queryFn: () => api<DraftView>(`${V1}/drafts/${id}`),
  })

export const useCreateDraft = () =>
  useMutate(
    ({ key, title }: { key: string; title?: string }) =>
      api<FeatureDraft>(`${V1}/features/${encodeURIComponent(key)}/drafts`, { method: 'POST', body: { title } }),
    draftKeys,
    rememberDraft,
  )

export const useRevertToRevision = () =>
  useMutate(
    ({ key, revision }: { key: string; revision: number }) =>
      api<FeatureDraft>(`${V1}/features/${encodeURIComponent(key)}/revisions/${revision}/revert`, { method: 'POST' }),
    draftKeys,
    rememberDraft,
  )

export const useUpdateDraftEnvironment = () =>
  useMutate(
    ({ id, environmentKey, enabled, rules, version }: { id: string; environmentKey: string; enabled: boolean; rules: Rule[]; version: number }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/environments/${environmentKey}`, { method: 'PUT', body: { enabled, rules, version } }),
    draftKeys,
    rememberDraft,
  )

export interface DraftMetadata {
  projectKey?: string | null
  defaultValue: Json
  description?: string | null
  owner?: string | null
  tags: string[]
  archived: boolean
  version: number
}

export const useUpdateDraftMetadata = () =>
  useMutate(
    ({ id, ...body }: DraftMetadata & { id: string }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/metadata`, { method: 'PUT', body }),
    draftKeys,
    rememberDraft,
  )

export const useUpdateDraftPrerequisites = () =>
  useMutate(
    ({ id, prerequisites, version }: { id: string; prerequisites: Prerequisite[]; version: number }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/prerequisites`, { method: 'PUT', body: { prerequisites, version } }),
    draftKeys,
    rememberDraft,
  )

type DraftAction = 'request-review' | 'approve' | 'request-changes' | 'comments' | 'discard'

export const useDraftAction = () =>
  useMutate(
    ({ id, action, comment }: { id: string; action: DraftAction; comment?: string }) =>
      api<unknown>(`${V1}/drafts/${id}/${action}`, { method: 'POST', body: action === 'discard' ? undefined : { comment } }),
    draftKeys,
    // every action answers with the draft, except comments (the new event)
    (queryClient, result, { action }) => {
      if (action !== 'comments') rememberDraft(queryClient, result as FeatureDraft)
    },
  )

export const usePublishDraft = () =>
  useMutate(
    ({ id, bypass, reason }: { id: string; bypass?: boolean; reason?: string }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/publish`, { method: 'POST', query: { bypass: bypass ?? false }, reason }),
    draftKeys,
    rememberDraft,
  )

export const useRebaseDraft = () =>
  useMutate(
    ({ id, keepDraft, version }: { id: string; keepDraft: boolean; version: number }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/rebase`, { method: 'POST', query: { keepDraft }, body: { version } }),
    draftKeys,
    rememberDraft,
  )

export const useReviewSettings = () =>
  useQuery({ queryKey: ['settings', 'review'], queryFn: () => api<ReviewSettings>(`${V1}/settings/review`) })

export const useSaveReviewSettings = () =>
  useMutate(
    (body: Omit<ReviewSettings, 'updatedAt' | 'updatedBy'>) =>
      api<ReviewSettings>(`${V1}/settings/review`, { method: 'PUT', body }),
    [['settings']],
  )

// ---- Evaluation --------------------------------------------------------------------------------

export const useSimulate = () =>
  useMutation({
    mutationFn: (body: {
      featureKey: string
      environmentKey: string
      attributes: Json
      proposed?: EnvironmentSettings
      /** a whole draft: its default value and prerequisites apply too, not only its rules */
      proposedFeature?: FeatureSnapshot
      at?: string
    }) =>
      api<EvaluationResult>(`${V1}/simulate`, { method: 'POST', body }),
  })

export const useReplay = () =>
  useMutation({
    mutationFn: (body: { bundleHash: string; featureKey: string; attributes: Json }) =>
      api<ReplayResult>(`${V1}/replay`, { method: 'POST', body }),
  })

export const useReplayAt = () =>
  useMutation({
    mutationFn: (body: { clientKey: string; instant: string; featureKey: string; attributes: Json }) =>
      api<ReplayResult>(`${V1}/replay/at`, { method: 'POST', body }),
  })

// ---- Bundles & delivery ------------------------------------------------------------------------

export const useBundle = (hash: string | undefined) =>
  useQuery({
    queryKey: ['bundles', 'one', hash],
    enabled: Boolean(hash),
    queryFn: () => api<VerifiedBundle>(`${V1}/bundles/${hash}`),
    retry: false,
  })

export const useBundles = (clientKey: string) =>
  useQuery({
    queryKey: ['bundles', clientKey, 'list'],
    queryFn: () => api<Bundle[]>(`${V1}/sdk-connections/${clientKey}/bundles`),
  })

export const useActivations = (clientKey: string) =>
  useQuery({
    queryKey: ['bundles', clientKey, 'activations'],
    queryFn: () => api<BundleActivation[]>(`${V1}/sdk-connections/${clientKey}/activations`),
  })

export const useVerifyActivations = (clientKey: string) =>
  useQuery({
    queryKey: ['bundles', clientKey, 'verify'],
    queryFn: () => api<ChainVerification>(`${V1}/sdk-connections/${clientKey}/activations/verify`),
  })

export const useDeliveries = (clientKey: string) =>
  useQuery({
    queryKey: ['bundles', clientKey, 'deliveries'],
    queryFn: () => api<DeliveryLogEntry[]>(`${V1}/sdk-connections/${clientKey}/deliveries`),
  })

export const useRollback = (clientKey: string) =>
  useMutate(
    ({ hash, reason }: { hash: string; reason: string }) =>
      api<BundleActivation>(`${V1}/sdk-connections/${clientKey}/bundles/${hash}/activate`, { method: 'POST', reason }),
    [['sdk-connections']],
  )

export const useUnpin = (clientKey: string) =>
  useMutate(
    ({ reason }: { reason?: string }) =>
      api<BundleActivation[]>(`${V1}/sdk-connections/${clientKey}/unpin`, { method: 'POST', reason }),
    [['sdk-connections']],
  )

// ---- Audit & decisions -------------------------------------------------------------------------

export interface AuditFilter {
  entityType?: string
  entityKey?: string
  actor?: string
}

/**
 * Newest first, one page per "load more" (keyset: each page starts below the last seq of the previous one). A refetch
 * walks the pages again from the first, so entries added meanwhile push the list down instead of opening gaps.
 */
export const useAudit = (filter: AuditFilter, pageSize: number) =>
  useInfiniteQuery({
    queryKey: ['audit', 'pages', filter, pageSize],
    queryFn: ({ pageParam }) =>
      api<AuditEntry[]>(`${V1}/audit`, { query: { ...filter, beforeSeq: pageParam, limit: pageSize } }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length >= pageSize ? Math.min(...last.map((e) => e.seq)) : undefined),
  })

export const useVerifyAudit = () =>
  useQuery({ queryKey: ['audit', 'verify'], queryFn: () => api<ChainVerification>(`${V1}/audit/verify`) })

export interface DecisionFilter {
  clientKey?: string
  featureKey?: string
  bundleHash?: string
  limit?: number
}

export const useDecisions = (filter: DecisionFilter) =>
  useQuery({
    queryKey: ['decisions', filter],
    queryFn: () => api<DecisionEvent[]>(`${V1}/decisions`, { query: { ...filter } }),
  })

export const useVerifyDecisionAttributes = () =>
  useMutation({
    mutationFn: ({ eventId, attributes }: { eventId: string; attributes: Json }) =>
      api<{ eventId: string; matches: boolean }>(`${V1}/decisions/${eventId}/verify-attributes`, {
        method: 'POST',
        body: attributes,
      }),
  })

// ---- API tokens --------------------------------------------------------------------------------

export const useApiTokens = () => useQuery({ queryKey: ['api-tokens'], queryFn: () => api<ApiToken[]>(`${V1}/api-tokens`) })

export const useCreateApiToken = () =>
  useMutate(
    (body: { name: string; role: ApiTokenRole; expiresAt?: string | null }) =>
      api<CreatedApiToken>(`${V1}/api-tokens`, { method: 'POST', body }),
    [['api-tokens']],
  )

export const useRevokeApiToken = () =>
  useMutate((id: string) => api<ApiToken>(`${V1}/api-tokens/${id}`, { method: 'DELETE' }), [['api-tokens']])

// ---- Webhooks ----------------------------------------------------------------------------------

export interface WebhookInput {
  name: string
  url: string
  format: WebhookFormat
  events: string[]
  enabled?: boolean
  version?: number
}

export const useWebhooks = () => useQuery({ queryKey: ['webhooks'], queryFn: () => api<Webhook[]>(`${V1}/webhooks`) })

export const useWebhookEvents = () =>
  useQuery({ queryKey: ['webhooks', 'events'], queryFn: () => api<WebhookEventInfo[]>(`${V1}/webhooks/events`), staleTime: Infinity })

export const useWebhookDeliveries = (id: string, live: boolean) =>
  useQuery({
    queryKey: ['webhooks', id, 'deliveries'],
    queryFn: () => api<WebhookDelivery[]>(`${V1}/webhooks/${id}/deliveries`, { query: { limit: 20 } }),
    refetchInterval: live ? 3_000 : false,
  })

export const useCreateWebhook = () =>
  useMutate((body: WebhookInput) => api<CreatedWebhook>(`${V1}/webhooks`, { method: 'POST', body }), [['webhooks']])

export const useUpdateWebhook = () =>
  useMutate(({ id, ...body }: WebhookInput & { id: string }) => api<Webhook>(`${V1}/webhooks/${id}`, { method: 'PUT', body }), [['webhooks']])

export const useDeleteWebhook = () =>
  useMutate((id: string) => api<void>(`${V1}/webhooks/${id}`, { method: 'DELETE' }), [['webhooks']])

export const useTestWebhook = () =>
  useMutate((id: string) => api<void>(`${V1}/webhooks/${id}/test`, { method: 'POST' }), [['webhooks']])

/**
 * Whether the signed-in user may change features of this project (mirrors the server rule: admins, or no restriction,
 * or listed among the project's editor roles or users). The server enforces it either way. {@code undefined} while the
 * projects are not loaded (or failed to load): callers keep edit controls off until it is known.
 */
export function useCanEditProject(projectKey?: string | null): boolean | undefined {
  const user = useAuth()
  const projects = useProjects().data
  if (!user.can('ktoggle-editor')) return false
  if (!projectKey || user.can('ktoggle-admin')) return true
  if (!projects) return undefined
  return projectEditableBy(projects.find((p) => p.key === projectKey), user)
}

/** The project part of {@link useCanEditProject}; an unknown project is not restricted (as on the server). */
export function projectEditableBy(project: Project | undefined, user: CurrentUser): boolean {
  if (user.can('ktoggle-admin') || !project || project.editorRoles.length + project.editorUsers.length === 0) return true
  return project.editorUsers.includes(user.username) || project.editorRoles.some((r) => user.hasRole(r))
}

// ---- Encrypted payloads ------------------------------------------------------------------------

/** Admin only; fetched on demand ("Reveal key") so the key never sits in regular responses. */
export const useDecryptionKey = (clientKey: string, enabled: boolean) =>
  useQuery({
    queryKey: ['sdk-connections', clientKey, 'decryption-key'],
    queryFn: () => api<{ decryptionKey: string }>(`${V1}/sdk-connections/${clientKey}/decryption-key`),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })

/** Delivery options of a connection: payload encryption or remote evaluation (mutually exclusive). */
export const useSetDelivery = () =>
  useMutate(
    (c: SdkConnection) =>
      api<SdkConnection>(`${V1}/sdk-connections/${c.clientKey}`, {
        method: 'PUT',
        body: { name: c.name, projectKeys: c.projectKeys, encryptPayload: c.encryptPayload, remoteEval: c.remoteEval, version: c.version },
      }),
    [['sdk-connections']],
  )

export const useRotateKey = () =>
  useMutate(
    (clientKey: string) => api<SdkConnection>(`${V1}/sdk-connections/${clientKey}/rotate-key`, { method: 'POST' }),
    [['sdk-connections']],
  )

// ---- GrowthBook migration -----------------------------------------------------------------------

export const useMigrationStatus = () =>
  useQuery({ queryKey: ['migration', 'status'], queryFn: () => api<MigrationStatus>(`${V1}/growthbook/status`) })

export const useImport = () =>
  useMutate(
    (body: { dryRun: boolean; environmentMapping?: Record<string, string> }) =>
      api<ImportReport>(`${V1}/growthbook/import`, { method: 'POST', body }),
    [['features'], ['sdk-connections'], ['saved-groups'], ['attributes'], ['environments'], ['projects']],
  )

export const useShadowStatus = () =>
  useQuery({ queryKey: ['shadow'], queryFn: () => api<ShadowConnectionStatus[]>(`${V1}/shadow`), refetchInterval: 15_000 })

export const useShadowRuns = (clientKey: string) =>
  useQuery({ queryKey: ['shadow', clientKey], queryFn: () => api<ShadowRun[]>(`${V1}/shadow/${clientKey}/runs`, { query: { limit: 10 } }) })

export const useRunShadow = () =>
  useMutate(
    (clientKey?: string) => api<ShadowRun[]>(`${V1}/shadow/run`, { method: 'POST', query: { clientKey } }),
    [['shadow']],
  )

