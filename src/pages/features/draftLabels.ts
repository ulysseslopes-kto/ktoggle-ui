import type { DraftEventType, DraftStatus } from '@/api/types'

export const STATUS_LABEL: Record<DraftStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_REVIEW: 'Aguardando revisão',
  CHANGES_REQUESTED: 'Alterações solicitadas',
  APPROVED: 'Aprovado',
  PUBLISHED: 'Publicado',
  DISCARDED: 'Descartado',
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
  CREATED: 'criou o draft',
  UPDATED: 'alterou',
  REVIEW_REQUESTED: 'pediu revisão',
  APPROVED: 'aprovou',
  CHANGES_REQUESTED: 'solicitou alterações',
  REVIEW_RESET: 'a aprovação foi invalidada',
  COMMENTED: 'comentou',
  REBASED: 'atualizou com a versão no ar',
  PUBLISHED: 'publicou',
  BYPASS_PUBLISHED: 'publicou SEM APROVAÇÃO (emergência)',
  DISCARDED: 'descartou',
}

const FIELD_LABEL: Record<string, string> = {
  defaultValue: 'Valor padrão',
  projectKey: 'Projeto',
  description: 'Descrição',
  owner: 'Responsável',
  tags: 'Tags',
  archived: 'Arquivada',
}

export function sectionLabel(section: string): string {
  return section.startsWith('environments.') ? `Ambiente ${section.slice('environments.'.length)}` : FIELD_LABEL[section] ?? section
}
