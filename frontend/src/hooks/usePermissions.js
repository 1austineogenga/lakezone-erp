import useAuthStore from '../store/authStore'
import { getPermissions, canAccess, canWrite, canAdmin } from '../utils/permissions'

export default function usePermissions() {
  const { user } = useAuthStore()
  const role = user?.role || ''
  const perms = getPermissions(role)

  return {
    role,
    perms,
    can:      (module) => canAccess(role, module),
    canWrite: (module) => canWrite(role, module),
    canAdmin: (module) => canAdmin(role, module),
    isAdmin:  role === 'system_admin',
    isExec:   ['system_admin', 'managing_director', 'general_manager'].includes(role),
  }
}
