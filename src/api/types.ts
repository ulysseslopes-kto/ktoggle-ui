/** Types mirroring the ktoggle admin API (see /v3/api-docs on the backend). */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export type ValueType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON'

export interface Project {
  key: string
  name: string
  description?: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface Environment {
  key: string
  name: string
  description?: string | null
  sortOrder: number
  requiresReview: boolean
  createdAt: string
  updatedAt: string
  version: number
}

export type AttributeDatatype = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'STRING_ARRAY' | 'NUMBER_ARRAY' | 'ENUM'

export interface Attribute {
  key: string
  datatype: AttributeDatatype
  description?: string | null
  hashAttribute: boolean
  pii: boolean
  enumValues: string[]
  archived: boolean
  createdAt: string
  updatedAt: string
  version: number
}

export type SavedGroupType = 'LIST' | 'CONDITION'

export interface SavedGroup {
  key: string
  name: string
  description?: string | null
  type: SavedGroupType
  attributeKey?: string | null
  values?: Json[] | null
  condition?: Json | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface SdkConnection {
  clientKey: string
  name: string
  environmentKey: string
  projectKeys: string[]
  pinnedBundleHash?: string | null
  createdAt: string
  updatedAt: string
  version: number
}

interface RuleBase {
  id?: string
  description?: string | null
  enabled: boolean
  condition?: Json | null
  savedGroups: string[]
  value: Json
}

export interface ForceRule extends RuleBase {
  type: 'force'
}

export interface RolloutRule extends RuleBase {
  type: 'rollout'
  coverage: number
  hashAttribute: string
}

export type Rule = ForceRule | RolloutRule

export interface EnvironmentSettings {
  enabled: boolean
  rules: Rule[]
}

export interface Feature {
  key: string
  projectKey?: string | null
  valueType: ValueType
  defaultValue: Json
  description?: string | null
  owner?: string | null
  tags: string[]
  archived: boolean
  environments: Record<string, EnvironmentSettings>
  revision: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  version: number
}

export interface FeatureSnapshot {
  key: string
  projectKey?: string | null
  valueType: ValueType
  defaultValue: Json
  description?: string | null
  owner?: string | null
  tags: string[]
  archived: boolean
  environments: Record<string, EnvironmentSettings>
}

export interface FeatureRevision {
  featureKey: string
  revision: number
  snapshot: FeatureSnapshot
  changeId: string
  comment?: string | null
  createdBy: string
  createdAt: string
}

export type EntityType = 'PROJECT' | 'ENVIRONMENT' | 'ATTRIBUTE' | 'SAVED_GROUP' | 'FEATURE' | 'SDK_CONNECTION' | 'BUNDLE'

export interface AuditEntry {
  seq: number
  id: string
  changeId: string
  actor: string
  action: string
  entityType: EntityType
  entityKey: string
  before?: Json
  after?: Json
  reason?: string | null
  occurredAt: string
  prevHash?: string | null
  hash: string
}

export interface ChainVerification {
  valid: boolean
  checked: number
  brokenAt?: number | null
  message?: string | null
}

export interface Bundle {
  hash: string
  contractVersion: string
  clientKey: string
  environmentKey: string
  content: string
  payloadHash: string
  signatureAlg: string
  keyId: string
  signature: string
  createdAt: string
  createdBy: string
}

export interface BundleBody {
  contractVersion: string
  target: { clientKey: string; environment: string; projects: string[] }
  evaluator: { spec: string; hashVersion: number; referenceEvaluator: string }
  sources: Record<string, number>
  payload: { features: Record<string, Json> }
}

export interface VerifiedBundle {
  bundle: Bundle
  body: BundleBody
}

export interface BundleActivation {
  id: string
  clientKey: string
  position: number
  bundleHash: string
  kind: 'PUBLISH' | 'ROLLBACK'
  changeId: string
  activatedBy: string
  activatedAt: string
  reason?: string | null
  prevHash?: string | null
  hash: string
}

export interface DeliveryLogEntry {
  clientKey: string
  bundleHash: string
  channel: 'POLL' | 'SSE'
  pod: string
  windowStart: string
  firstSeen: string
  lastSeen: string
  deliveries: number
  sdkHint?: string | null
}

export interface RuleTrace {
  ruleId: string
  type: string
  conditionMatched: boolean
  selected: boolean
}

export interface EvaluationResult {
  featureKey: string
  value: Json
  source?: string | null
  ruleId?: string | null
  evaluator: string
  trace: RuleTrace[]
}

export interface ReplayResult {
  bundleHash: string
  clientKey: string
  bundleEvaluator: string
  featureRevision?: number | null
  activation?: BundleActivation | null
  attributesDigest: string
  digestKeyId: string
  result: EvaluationResult
}

export interface DecisionEvent {
  eventId: string
  clientKey: string
  bundleHash: string
  featureKey: string
  value: Json
  ruleId?: string | null
  source?: string | null
  sdk?: string | null
  occurredAt: string
  receivedAt: string
  attributes: Record<string, Json>
  attributesDigest: string
  digestKeyId: string
}

// ---- Drafts & review ------------------------------------------------------------------------------

export type DraftStatus = 'DRAFT' | 'PENDING_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'PUBLISHED' | 'DISCARDED'

export interface FeatureDraft {
  id: string
  featureKey: string
  title?: string | null
  baseRevision: number
  status: DraftStatus
  proposed: FeatureSnapshot
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  publishedRevision?: number | null
  version: number
}

export type DraftEventType =
  | 'CREATED' | 'UPDATED' | 'REVIEW_REQUESTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_RESET'
  | 'COMMENTED' | 'REBASED' | 'PUBLISHED' | 'BYPASS_PUBLISHED' | 'DISCARDED'

export interface DraftEvent {
  id: string
  draftId: string
  type: DraftEventType
  actor: string
  comment?: string | null
  occurredAt: string
}

export interface SectionChange {
  section: string
  live: Json
  proposed: Json
}

export interface DraftView {
  draft: FeatureDraft
  liveRevision: number
  changes: SectionChange[]
  conflicts: string[]
  reviewEnvironments: string[]
  events: DraftEvent[]
  permissions: {
    edit: boolean
    requestReview: boolean
    review: boolean
    publish: boolean
    bypass: boolean
    discard: boolean
  }
  blockers: string[]
}

export interface ReviewSettings {
  approverRoles: string[]
  approverUsers: string[]
  allowSelfApproval: boolean
  resetReviewOnChange: boolean
  bypassEnabled: boolean
  updatedAt: string
  updatedBy: string
  version: number
}
