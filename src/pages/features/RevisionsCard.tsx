import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useFeatureRevisions, useRevertToRevision } from '@/api/hooks'
import type { Feature, FeatureDraft, FeatureRevision } from '@/api/types'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Card, ErrorBanner, formatDate, JsonBlock, Spinner } from '@/components/ui/Display'

/** Immutable revision history. Reverting creates a draft with the old content — it still goes through review. */
export function RevisionsCard({ feature, onDraftCreated }: { feature: Feature; onDraftCreated: (draft: FeatureDraft) => void }) {
  const { can } = useAuth()
  const revisions = useFeatureRevisions(feature.key)
  const revert = useRevertToRevision()
  const [viewing, setViewing] = useState<FeatureRevision | null>(null)

  return (
    <Card title="Histórico de revisões">
      {revisions.isLoading && <Spinner />}
      <ErrorBanner error={revisions.error ?? revert.error} />
      <ol className="divide-y divide-line">
        {revisions.data?.map((revision) => (
          <li key={revision.revision} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm">
                <span className="font-mono font-bold text-kto-yellow">#{revision.revision}</span>
                {revision.revision === feature.revision && <Badge tone="green">no ar</Badge>}
                <span className="font-semibold">{revision.createdBy}</span>
                <span className="text-muted">· {formatDate(revision.createdAt)}</span>
              </p>
              {revision.comment && <p className="mt-0.5 text-sm text-soft">“{revision.comment}”</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setViewing(revision)}>Ver</Button>
              {can('ktoggle-editor') && revision.revision !== feature.revision && (
                <Button size="sm" variant="secondary" loading={revert.isPending}
                  onClick={() => revert.mutate({ key: feature.key, revision: revision.revision }, { onSuccess: onDraftCreated })}>
                  <RotateCcw className="size-3.5" /> Reverter (cria draft)
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)} wide title={`Revisão #${viewing?.revision}`}
        description={viewing ? `${viewing.createdBy} · ${formatDate(viewing.createdAt)} · change ${viewing.changeId}` : undefined}>
        {viewing && <JsonBlock value={viewing.snapshot} className="max-h-[60vh]" />}
      </Dialog>
    </Card>
  )
}
