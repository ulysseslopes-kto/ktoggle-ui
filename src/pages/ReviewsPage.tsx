import { clsx } from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDraftsByStatus } from '@/api/hooks'
import type { DraftStatus } from '@/api/types'
import { APPROVER_ROLE, useAuth } from '@/auth/auth'
import { Badge, EmptyState, ErrorBanner, formatDate, PageHeader, Spinner, Table } from '@/components/ui/Display'
import { STATUS_LABEL, STATUS_TONE } from './features/draftLabels'

const TABS: { label: string; statuses: DraftStatus[] }[] = [
  { label: 'Aguardando revisão', statuses: ['PENDING_REVIEW'] },
  { label: 'Aprovados', statuses: ['APPROVED'] },
  { label: 'Alterações solicitadas', statuses: ['CHANGES_REQUESTED'] },
  { label: 'Rascunhos', statuses: ['DRAFT'] },
  { label: 'Todos abertos', statuses: ['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'] },
  { label: 'Publicados', statuses: ['PUBLISHED'] },
]

/** Review queue: every draft by status, with the ones the current user can review highlighted. */
export function ReviewsPage() {
  const user = useAuth()
  const [tab, setTab] = useState(0)
  const drafts = useDraftsByStatus(TABS[tab].statuses)
  const mayReview = user.hasRole('ktoggle-admin') || user.hasRole(APPROVER_ROLE)

  return (
    <>
      <PageHeader
        title="Revisões"
        subtitle="Toda alteração em uma feature passa por um draft. Ambientes protegidos exigem a aprovação de outra pessoa antes da publicação."
      />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setTab(i)}
            className={clsx(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === i ? 'border-kto-red text-white' : 'border-transparent text-muted hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ErrorBanner error={drafts.error} />
      {drafts.isLoading ? (
        <Spinner />
      ) : !drafts.data?.length ? (
        <EmptyState title="Nada por aqui">Nenhum draft com este status.</EmptyState>
      ) : (
        <Table head={['Feature', 'Draft', 'Status', 'Autor', 'Base', 'Atualizado']}>
          {drafts.data.map((d) => {
            const reviewable = mayReview && d.status === 'PENDING_REVIEW' && d.createdBy !== user.username
            return (
              <tr key={d.id} className={clsx('hover:bg-surface/60', reviewable && 'bg-kto-yellow/5')}>
                <td className="px-4 py-3">
                  <Link
                    to={`/features/${encodeURIComponent(d.featureKey)}?draft=${d.id}${d.status === 'PUBLISHED' ? '' : '&review=1'}`}
                    className="font-mono text-sm font-semibold hover:text-kto-red"
                  >
                    {d.featureKey}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">
                  {d.title ?? <span className="text-muted">sem título</span>}
                  {reviewable && <span className="ml-2 text-xs text-kto-yellow">você pode revisar</span>}
                </td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge></td>
                <td className="px-4 py-3 text-sm">{d.createdBy}</td>
                <td className="px-4 py-3 font-mono text-xs text-kto-yellow">
                  #{d.baseRevision}{d.publishedRevision ? ` → #${d.publishedRevision}` : ''}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                  {d.updatedBy}<br />{formatDate(d.updatedAt)}
                </td>
              </tr>
            )
          })}
        </Table>
      )}
    </>
  )
}
