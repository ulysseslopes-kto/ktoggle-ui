import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { api } from './client'
import type {
  Attribute,
  AuditEntry,
  BundleActivation,
  Bundle,
  ChainVerification,
  DecisionEvent,
  DraftStatus,
  DraftView,
  DeliveryLogEntry,
  Environment,
  EnvironmentSettings,
  EvaluationResult,
  Feature,
  FeatureDraft,
  FeatureRevision,
  Json,
  Project,
  ReplayResult,
  ReviewSettings,
  Rule,
  SavedGroup,
  SdkConnection,
  ValueType,
  VerifiedBundle,
} from './types'

const V1 = '/admin/v1'

/** Mutations invalidate everything that may show derived state (bundles, audit) — simple and always correct. */
function useMutate<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, invalidate: QueryKey[] = []) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
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
  )

export const useRevertToRevision = () =>
  useMutate(
    ({ key, revision }: { key: string; revision: number }) =>
      api<FeatureDraft>(`${V1}/features/${encodeURIComponent(key)}/revisions/${revision}/revert`, { method: 'POST' }),
    draftKeys,
  )

export const useUpdateDraftEnvironment = () =>
  useMutate(
    ({ id, environmentKey, enabled, rules, version }: { id: string; environmentKey: string; enabled: boolean; rules: Rule[]; version: number }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/environments/${environmentKey}`, { method: 'PUT', body: { enabled, rules, version } }),
    draftKeys,
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
  )

type DraftAction = 'request-review' | 'approve' | 'request-changes' | 'comments' | 'discard'

export const useDraftAction = () =>
  useMutate(
    ({ id, action, comment }: { id: string; action: DraftAction; comment?: string }) =>
      api<unknown>(`${V1}/drafts/${id}/${action}`, { method: 'POST', body: action === 'discard' ? undefined : { comment } }),
    draftKeys,
  )

export const usePublishDraft = () =>
  useMutate(
    ({ id, bypass, reason }: { id: string; bypass?: boolean; reason?: string }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/publish`, { method: 'POST', query: { bypass: bypass ?? false }, reason }),
    draftKeys,
  )

export const useRebaseDraft = () =>
  useMutate(
    ({ id, keepDraft, version }: { id: string; keepDraft: boolean; version: number }) =>
      api<FeatureDraft>(`${V1}/drafts/${id}/rebase`, { method: 'POST', query: { keepDraft }, body: { version } }),
    draftKeys,
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
    mutationFn: (body: { featureKey: string; environmentKey: string; attributes: Json; proposed?: EnvironmentSettings; at?: string }) =>
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
  beforeSeq?: number
  limit?: number
}

export const useAudit = (filter: AuditFilter) =>
  useQuery({
    queryKey: ['audit', filter],
    queryFn: () => api<AuditEntry[]>(`${V1}/audit`, { query: { ...filter } }),
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
