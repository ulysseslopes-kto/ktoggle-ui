import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/auth'
import { AppLayout } from './components/layout/AppLayout'
import { ApiTokensPage } from './pages/ApiTokensPage'
import { AttributesPage } from './pages/AttributesPage'
import { AuditPage } from './pages/AuditPage'
import { DecisionsPage } from './pages/DecisionsPage'
import { EnvironmentsPage } from './pages/EnvironmentsPage'
import { FeatureDetailPage } from './pages/features/FeatureDetailPage'
import { FeaturesPage } from './pages/features/FeaturesPage'
import { PlaygroundPage } from './pages/PlaygroundPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReplayPage } from './pages/ReplayPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { SavedGroupsPage } from './pages/SavedGroupsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WebhooksPage } from './pages/WebhooksPage'
import { SdkConnectionDetailPage } from './pages/sdk/SdkConnectionDetailPage'
import { SdkConnectionsPage } from './pages/sdk/SdkConnectionsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 } },
})

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/features" replace /> },
      { path: 'features', element: <FeaturesPage /> },
      { path: 'features/:key', element: <FeatureDetailPage /> },
      { path: 'drafts', element: <ReviewsPage /> },
      { path: 'saved-groups', element: <SavedGroupsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'api-tokens', element: <ApiTokensPage /> },
      { path: 'webhooks', element: <WebhooksPage /> },
      { path: 'attributes', element: <AttributesPage /> },
      { path: 'environments', element: <EnvironmentsPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'sdk-connections', element: <SdkConnectionsPage /> },
      { path: 'sdk-connections/:clientKey', element: <SdkConnectionDetailPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'replay', element: <ReplayPage /> },
      { path: 'decisions', element: <DecisionsPage /> },
      { path: 'playground', element: <PlaygroundPage /> },
      { path: '*', element: <Navigate to="/features" replace /> },
    ],
  },
])

export function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthProvider>
  )
}
