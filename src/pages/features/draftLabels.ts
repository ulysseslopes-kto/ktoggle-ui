import type { DraftEventType, DraftStatus } from '@/api/types'

export const STATUS_LABEL: Record<DraftStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  DISCARDED: 'Discarded',
}

export const STATUS_TONE: Record<DraftStatus, 'neutral' | 'yellow' | 'red' | 'green' | 'outline'> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'yellow',
  CHANGES_REQUESTED: 'red',
  APPROVED: 'green',
  PUBLISHED: 'outline',
  DISCARDED: 'outline',
}

export const EVENT_LABEL: Record<DraftEventType, string> = {
  CREATED: 'created the draft',
  UPDATED: 'changed',
  REVIEW_REQUESTED: 'requested a review',
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'requested changes',
  REVIEW_RESET: 'approval was reset',
  COMMENTED: 'commented',
  REBASED: 'updated with the live version',
  PUBLISHED: 'published',
  BYPASS_PUBLISHED: 'published WITHOUT APPROVAL (emergency)',
  DISCARDED: 'discarded',
}

const FIELD_LABEL: Record<string, string> = {
  defaultValue: 'Default value',
  projectKey: 'Project',
  description: 'Description',
  owner: 'Owner',
  tags: 'Tags',
  archived: 'Archived',
}

export function sectionLabel(section: string): string {
  return section.startsWith('environments.') ? `Environment ${section.slice('environments.'.length)}` : FIELD_LABEL[section] ?? section
}
