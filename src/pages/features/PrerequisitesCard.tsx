import { GitFork, Link2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeatureDependents, useUpdateDraftPrerequisites } from '@/api/hooks'
import type { FeatureDraft, FeatureSnapshot, Prerequisite } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Card, ErrorBanner } from '@/components/ui/Display'
import { PrerequisiteEditor } from './PrerequisiteEditor'
import { describePrerequisite } from './prerequisites'

/**
 * Feature-level prerequisites (GrowthBook "Prerequisite features"): unless every parent condition passes for the user,
 * the feature is off (null) in every environment. Also lists the features that depend on this one.
 */
export function PrerequisitesCard({ content, editable, ensureDraft }: {
  content: FeatureSnapshot
  editable: boolean
  ensureDraft: () => Promise<FeatureDraft>
}) {
  const [editing, setEditing] = useState(false)
  const dependents = useFeatureDependents(content.key).data ?? []
  const prerequisites = content.prerequisites ?? []

  return (
    <Card
      title={<span className="flex items-center gap-2"><Link2 className="size-4 text-kto-red" /> Prerequisites</span>}
      actions={editable && (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Edit</Button>
      )}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">This feature requires</p>
          {prerequisites.length === 0 ? (
            <p className="text-sm text-muted">Nothing: it is evaluated on its own.</p>
          ) : (
            <ul className="space-y-1.5">
              {prerequisites.map((p) => (
                <li key={p.featureKey} className="text-sm">
                  <Link to={`/features/${p.featureKey}`} className="font-mono text-white hover:text-kto-red">{p.featureKey}</Link>{' '}
                  <span className="text-soft">{describePrerequisite(p).slice(p.featureKey.length + 1)}</span>
                </li>
              ))}
              <li className="pt-1 text-xs text-muted">Otherwise the feature is off (null) for that user, in every environment.</li>
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
            <GitFork className="size-3.5" /> Features that depend on this one
          </p>
          {dependents.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="space-y-1.5">
              {dependents.map((d) => (
                <li key={d.featureKey} className="flex flex-wrap items-center gap-2 text-sm">
                  <Link to={`/features/${d.featureKey}`} className="font-mono text-white hover:text-kto-red">{d.featureKey}</Link>
                  {d.featureLevel && <Badge tone="outline">whole feature</Badge>}
                  {d.ruleEnvironments.map((env) => <Badge key={env}>rules in {env}</Badge>)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title="Prerequisites"
        description="The feature is served only to users for whom every prerequisite passes; otherwise it is off (null)."
      >
        {editing && <PrerequisitesForm content={content} ensureDraft={ensureDraft} onDone={() => setEditing(false)} />}
      </Dialog>
    </Card>
  )
}

function PrerequisitesForm({ content, ensureDraft, onDone }: {
  content: FeatureSnapshot
  ensureDraft: () => Promise<FeatureDraft>
  onDone: () => void
}) {
  const [value, setValue] = useState<Prerequisite[]>(content.prerequisites ?? [])
  const [valid, setValid] = useState(true)
  const update = useUpdateDraftPrerequisites()

  const save = async () => {
    if (!valid) return
    const draft = await ensureDraft()
    await update.mutateAsync({ id: draft.id, prerequisites: value, version: draft.version })
    onDone()
  }

  return (
    <div className="space-y-4">
      <PrerequisiteEditor featureKey={content.key} projectKey={content.projectKey} value={value} onChange={setValue} onValidityChange={setValid} />
      <ErrorBanner error={update.error} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={() => void save()} loading={update.isPending} disabled={!valid}>Save to draft</Button>
      </div>
    </div>
  )
}
