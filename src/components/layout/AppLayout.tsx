import { clsx } from 'clsx'
import {
  Boxes,
  Flag,
  FlaskConical,
  GitPullRequest,
  History,
  Layers,
  LogOut,
  PlugZap,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  KeyRound,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useDraftsByStatus } from '@/api/hooks'
import { useAuth } from '@/auth/auth'

const NAV = [
  { section: 'Feature flags', items: [
    { to: '/features', label: 'Features', icon: Flag },
    { to: '/drafts', label: 'Reviews', icon: GitPullRequest },
    { to: '/saved-groups', label: 'Saved groups', icon: Users },
    { to: '/attributes', label: 'Attributes', icon: Tags },
  ] },
  { section: 'Configuration', items: [
    { to: '/environments', label: 'Environments', icon: Layers },
    { to: '/projects', label: 'Projects', icon: Boxes },
    { to: '/sdk-connections', label: 'SDK connections', icon: PlugZap },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/api-tokens', label: 'API tokens', icon: KeyRound, adminOnly: true },
  ] },
  { section: 'Auditing', items: [
    { to: '/audit', label: 'Audit log', icon: ScrollText },
    { to: '/replay', label: 'Replay', icon: History },
    { to: '/decisions', label: 'Decisions', icon: ShieldCheck },
  ] },
  { section: 'Demo', items: [{ to: '/playground', label: 'SDK playground', icon: FlaskConical }] },
]

export function AppLayout() {
  const user = useAuth()
  const pending = useDraftsByStatus(['PENDING_REVIEW']).data?.length ?? 0
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-ink">
        <div className="flex h-16 items-center gap-2 border-b border-line px-5">
          <span className="inline-block h-4 w-7 rounded-full bg-kto-red p-0.5">
            <span className="ml-auto block size-3 rounded-full bg-white" />
          </span>
          <span className="headline text-2xl">
            kto<span className="text-kto-red">ggle</span>
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.section} className="mb-5">
              <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-kto-grey">{group.section}</p>
              {group.items.filter((item) => !('adminOnly' in item) || user.can('ktoggle-admin')).map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 rounded-md border-l-2 px-2 py-2 text-sm transition-colors',
                      isActive
                        ? 'border-kto-red bg-surface text-white'
                        : 'border-transparent text-soft hover:bg-surface hover:text-white',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
                  {to === '/drafts' && pending > 0 && (
                    <span className="ml-auto rounded-full bg-kto-red px-1.5 text-[0.6875rem] font-bold text-white">{pending}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.roles.length ? user.roles.join(', ') : 'no access'}</p>
          <button
            type="button"
            onClick={user.logout}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-kto-red"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto bg-ink">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
