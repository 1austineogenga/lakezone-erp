import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline'
import useAuthStore from '../../store/authStore'

export default function TopBar({ onToggleSidebar }) {
  const { user } = useAuthStore()

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
          <BellIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-brand-red flex items-center justify-center text-white text-sm font-semibold">
            {user?.first_name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block text-sm">
            <p className="font-medium text-gray-800">
              {user ? `${user.first_name} ${user.last_name}` : 'User'}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
