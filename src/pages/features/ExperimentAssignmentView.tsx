import { FlaskConical } from 'lucide-react'
import type { ExperimentAssignment } from '@/api/types'

/** The exposure the SDK's tracking callback reports for this user (what analytics such as Mixpanel would receive). */
export function ExperimentAssignmentView({ assignment }: { assignment: ExperimentAssignment }) {
  return (
    <div className="mt-3 rounded-md border border-kto-red/40 bg-kto-red/5 px-3 py-2 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-white">
        <FlaskConical className="size-3.5 text-kto-red" />
        {assignment.inExperiment ? (
          <>
            In experiment <span className="font-mono">{assignment.trackingKey}</span> · variation{' '}
            <span className="font-mono text-kto-yellow">#{assignment.variationKey}</span>
          </>
        ) : (
          <>
            Not in experiment <span className="font-mono">{assignment.trackingKey}</span>
          </>
        )}
      </p>
      <p className="mt-1 text-muted">
        {assignment.inExperiment
          ? 'The SDK reports this exposure to the tracking callback.'
          : 'No exposure is tracked.'}
        {assignment.bucket != null && (
          <> · bucket <span className="font-mono text-soft">{assignment.bucket.toFixed(4)}</span></>
        )}
      </p>
    </div>
  )
}
