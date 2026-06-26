import { Navigate } from 'react-router-dom'
import usePermissions from '../hooks/usePermissions'

/**
 * Wraps a route and redirects to / if the user lacks module access.
 * Usage: <PrivateRoute module="fleet"> ... </PrivateRoute>
 */
export default function PrivateRoute({ module, children }) {
  const { can } = usePermissions()
  if (!can(module)) return <Navigate to="/" replace />
  return children
}
