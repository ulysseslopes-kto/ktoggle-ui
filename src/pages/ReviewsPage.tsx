import { clsx } from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDraftsByStatus, useReviewSettings } from '@/api/hooks'
import type { DraftStatus, FeatureDraft, ReviewSettings } from '@/api/types'
import { useAuth, type CurrentUser } from '@/auth/auth'
import { Badge, EmptyState, ErrorBanner, formatDate, PageHeader, Spinner, Table } from '@/components/ui/Display'
import { STATUS_LABEL, STATUS_TONE } from './features/draftLabels'

const TABS: { label: string; statuses: DraftStatus[] }[] = [
  { label: 'Pending review', statuses: ['PENDING_REVIEW'] },
  { label: 'Approved', statuses: ['APPROVED'] },
  { label: 'Changes requested', statuses: ['CHANGES_REQUESTED'] },
  { label: 'Drafts', statuses: ['DRAFT'] },
  { label: 'All open', statuses: ['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'] },
  { label: 'Published', statuses: ['PUBLISHED'] },
]

/** Review queue: every draft by status, with the ones the current user can review highlighted. */
export function ReviewsPage() {
  const user = useAuth()
  const [tab, setTab] = useState(0)
  const drafts = useDraftsByStatus(TABS[tab].statuses)
  const settings = useReviewSettings().data

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Every change to a feature goes through a draft. Protected environments require approval from someone else before publishing."
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
        <EmptyState title="Nothing here">No drafts with this status.</EmptyState>
      ) : (
        <Table head={['Feature', 'Draft', 'Status', 'Author', 'Base', 'Updated']}>
          {drafts.data.map((d) => {
            const reviewable = d.status === 'PENDING_REVIEW' && canApprove(settings, user, d)
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
                  {d.title ?? <span className="text-muted">untitled</span>}
                  {reviewable && <span className="ml-2 text-xs text-kto-yellow">you can review</span>}
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

/** Mirrors the server's review policy: listed as approver (user or role), and not the author unless self-approval is on. */
function canApprove(settings: ReviewSettings | undefined, user: CurrentUser, draft: FeatureDraft): boolean {
  if (!settings) return false
  const eligible = settings.approverUsers.includes(user.username) || settings.approverRoles.some((r) => user.hasRole(r))
  return eligible && (settings.allowSelfApproval || draft.createdBy !== user.username)
}
