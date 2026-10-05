/** Runtime configuration (Vite env vars, with local-development defaults matching ktoggle's docker-compose). */
export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8090',
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8180',
  keycloakRealm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'mobilt',
  keycloakClientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'ktoggle-ui',
}
