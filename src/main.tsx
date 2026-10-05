import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/archivo/900-italic.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initAuth } from './auth/auth'
import { config } from './config'

const root = createRoot(document.getElementById('root')!)

initAuth()
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="headline text-4xl">
          kto<span className="text-kto-red">ggle</span>
        </h1>
        <p className="text-soft">Could not reach Keycloak at {config.keycloakUrl}.</p>
        <p className="text-sm text-muted">
          Start the local stack with <code className="font-mono">docker compose up -d</code> in the ktoggle repository.
        </p>
      </div>,
    ),
  )
