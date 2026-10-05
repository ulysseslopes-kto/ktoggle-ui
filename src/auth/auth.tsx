import Keycloak from 'keycloak-js'
import { createContext, useContext, type ReactNode } from 'react'
import { config } from '@/config'

export type Role = 'ktoggle-viewer' | 'ktoggle-editor' | 'ktoggle-admin'

/** Realm roles relevant to ktoggle, including ones outside the viewer < editor < admin ladder (e.g. approver). */
export const APPROVER_ROLE = 'ktoggle-approver'

const ROLE_RANK: Record<Role, number> = { 'ktoggle-viewer': 1, 'ktoggle-editor': 2, 'ktoggle-admin': 3 }

export const keycloak = new Keycloak({
  url: config.keycloakUrl,
  realm: config.keycloakRealm,
  clientId: config.keycloakClientId,
})

/** Logs in (PKCE) before the app renders; tokens are refreshed shortly before they expire. */
export async function initAuth(): Promise<void> {
  await keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false })
  setInterval(() => {
    keycloak.updateToken(60).catch(() => keycloak.login())
  }, 20_000)
}

export async function accessToken(): Promise<string> {
  await keycloak.updateToken(30)
  return keycloak.token ?? ''
}

export interface CurrentUser {
  username: string
  name: string
  role: Role | null
  /** All realm roles of the token. */
  roles: string[]
  can: (role: Role) => boolean
  hasRole: (role: string) => boolean
  logout: () => void
}

function currentUser(): CurrentUser {
  const token = keycloak.tokenParsed as
    | { preferred_username?: string; name?: string; realm_access?: { roles?: string[] } }
    | undefined
  const allRoles = token?.realm_access?.roles ?? []
  const ranked = allRoles.filter((r): r is Role => r in ROLE_RANK)
  const role = ranked.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? null
  return {
    username: token?.preferred_username ?? 'unknown',
    name: token?.name ?? token?.preferred_username ?? 'unknown',
    role,
    roles: allRoles.filter((r) => r.startsWith('ktoggle-')),
    hasRole: (r) => allRoles.includes(r),
    can: (required) => role !== null && ROLE_RANK[role] >= ROLE_RANK[required],
    logout: () => keycloak.logout({ redirectUri: window.location.origin }),
  }
}

const AuthContext = createContext<CurrentUser | null>(null)

export function AuthProvider({ children, user }: { children: ReactNode; user?: CurrentUser }) {
  return <AuthContext.Provider value={user ?? currentUser()}>{children}</AuthContext.Provider>
}

export function useAuth(): CurrentUser {
  const user = useContext(AuthContext)
  if (!user) throw new Error('useAuth outside AuthProvider')
  return user
}
