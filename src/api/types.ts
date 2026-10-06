/** Types mirroring the ktoggle admin API (see /v3/api-docs on the backend). */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export type ValueType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON'

export interface Project {
  key: string
  name: string
  description?: string | null
  /** Keycloak roles allowed to change this project's features; with editorUsers empty too, every editor can. */
  editorRoles: string[]
  /** Usernames (or token:<name>) allowed to change this project's features. */
  editorUsers: string[]
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
  /** Serve encryptedFeatures (AES) instead of clear-text features; SDKs need the decryption key. */
  encryptPayload: boolean
  /** Identifies the current key without revealing it. */
  keyFingerprint?: string | null
  /** SDKs post their attributes to /api/eval and get values; rules never leave the server. */
  remoteEval: boolean
  createdAt: string
  updatedAt: string
  version: number
}

/** ISO instants; startsAt is inclusive, endsAt exclusive, either may be open. */
export interface RuleSchedule {
  startsAt?: string | null
  endsAt?: string | null
}

interface RuleBase {
  id?: string
  description?: string | null
  enabled: boolean
  condition?: Json | null
  /** Saved groups the user must be in, all of them. */
  savedGroups: string[]
  /** Saved groups the user must be in at least one of. */
  savedGroupsAny?: string[]
  /** Saved groups the user must not be in. */
  savedGroupsNone?: string[]
  /** Features this rule depends on; when unmet the rule is skipped. */
  prerequisites?: Prerequisite[]
  /** Optional live window; outside it the rule is left out of the SDK payload. */
  schedule?: RuleSchedule | null
}

export interface ForceRule extends RuleBase {
  type: 'force'
  value: Json
}

export interface RolloutRule extends RuleBase {
  type: 'rollout'
  value: Json
  coverage: number
  hashAttribute: string
}

export interface Variation {
  key: string
  name?: string | null
  value: Json
  /** 0..1; the weights of an experiment add up to 1 */
  weight: number
}

/** A/B test: the SDK splits users between variations and reports each exposure to its tracking callback. */
export interface ExperimentRule extends RuleBase {
  type: 'experiment'
  trackingKey: string
  hashAttribute: string
  /** share of matching users included in the experiment, 0..1 */
  coverage: number
  variations: Variation[]
  hashVersion?: number
  seed?: string | null
  /** read-only, sent by the server: the first variation's value */
  value?: Json
}

export type Rule = ForceRule | RolloutRule | ExperimentRule

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
  prerequisites: Prerequisite[]
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
  prerequisites?: Prerequisite[]
  environments: Record<string, EnvironmentSettings>
}

/** Depends on another feature: {@code condition} is evaluated against {@code {"value": <parent value>}}. */
export interface Prerequisite {
  featureKey: string
  condition: Json
}

/** A feature that depends on this one, at feature level and/or in rules of some environments. */
export interface Dependent {
  featureKey: string
  featureLevel: boolean
  ruleEnvironments: string[]
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

/** Mirrors the backend enum audit/EntityType. */
export type EntityType =
  | 'PROJECT' | 'ENVIRONMENT' | 'ATTRIBUTE' | 'SAVED_GROUP' | 'FEATURE' | 'SDK_CONNECTION' | 'REVIEW_SETTINGS' | 'BUNDLE'
  | 'API_TOKEN' | 'WEBHOOK'

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
  experiment?: ExperimentAssignment | null
}

/** What the SDK's tracking callback reports for this user. */
export interface ExperimentAssignment {
  trackingKey: string
  variationKey: string
  variationIndex: number
  inExperiment: boolean
  bucket?: number | null
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

export type ApiTokenRole = 'VIEWER' | 'EDITOR'

/** Credential for automation; the secret itself is only returned once, at creation. */
export interface ApiToken {
  id: string
  name: string
  /** first characters of the secret, to recognize it */
  prefix: string
  role: ApiTokenRole
  createdBy: string
  createdAt: string
  expiresAt?: string | null
  lastUsedAt?: string | null
  revokedBy?: string | null
  revokedAt?: string | null
}

export interface CreatedApiToken {
  token: ApiToken
  secret: string
}

export type WebhookFormat = 'GENERIC' | 'SLACK'

/** Outgoing notification endpoint; its signing secret is only returned at creation. */
export interface Webhook {
  id: string
  name: string
  url: string
  format: WebhookFormat
  /** event codes, e.g. "draft.published" */
  events: string[]
  enabled: boolean
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  version: number
}

export interface CreatedWebhook {
  webhook: Webhook
  secret: string
}

export interface WebhookEventInfo {
  code: string
  label: string
}

export type WebhookDeliveryStatus = 'PENDING' | 'SENDING' | 'RETRY' | 'DELIVERED' | 'FAILED'

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  payload: Json
  status: WebhookDeliveryStatus
  attempts: number
  nextAttemptAt: string
  lastStatusCode?: number | null
  lastError?: string | null
  createdAt: string
  deliveredAt?: string | null
}

// ---- GrowthBook migration -----------------------------------------------------------------------

export interface MigrationStatus {
  configured: boolean
  apiHost?: string | null
  sdkHost?: string | null
  canImport: boolean
  shadowEnabled: boolean
  shadowInterval: string
  samples: number
  readyAfter: number
}

export type ImportAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'UNSUPPORTED' | 'FAILED'

export interface ImportReport {
  dryRun: boolean
  items: { type: string; key: string; action: ImportAction; messages: string[] }[]
  totals: Record<ImportAction, number>
}

export type ShadowStatus = 'MATCH' | 'DIVERGENT' | 'NOT_IN_GROWTHBOOK' | 'NOT_IN_KTOGGLE' | 'ERROR'

export interface ShadowDivergence {
  featureKey: string
  kind: 'VALUE' | 'MISSING_IN_KTOGGLE' | 'MISSING_IN_GROWTHBOOK'
  divergingSamples: number
  /** simulated users, never real ones */
  examples: { attributes: Json; growthbook: Json; ktoggle: Json }[]
}

export interface ShadowRun {
  id: string
  clientKey: string
  startedAt: string
  durationMs: number
  status: ShadowStatus
  bundleHash?: string | null
  samples: number
  featuresCompared: number
  divergentFeatures: number
  divergences: ShadowDivergence[]
  error?: string | null
  triggeredBy: string
}

export interface ShadowConnectionStatus {
  clientKey: string
  name: string
  environmentKey: string
  lastRun?: ShadowRun | null
  cleanStreak: number
  ready: boolean
  readyAfter: number
}

