import { NavLink } from 'react-router-dom'
import {
  HomeIcon, DocumentTextIcon, Squares2X2Icon,
  BellIcon, UserCircleIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid, DocumentTextIcon as DocumentSolid,
  Squares2X2Icon as GridSolid, BellIcon as BellSolid,
  UserCircleIcon as UserSolid,
} from '@heroicons/react/24/solid'
import { useQuery } from '@tanstack/react-query'
import { getNotifications } from '../../api/notifications'

const TABS = [
  { to: '/',             label: 'Home',     Icon: HomeIcon,         ActiveIcon: HomeSolid,    end: true },
  { to: '/requisitions', label: 'Requests', Icon: DocumentTextIcon, ActiveIcon: DocumentSolid },
  { to: '/menu',         label: 'Menu',     Icon: Squares2X2Icon,   ActiveIcon: GridSolid },
  { to: '/alerts',       label: 'Alerts',   Icon: BellIcon,         ActiveIcon: BellSolid,    bell: true },
  { to: '/profile',      label: 'Account',  Icon: UserCircleIcon,   ActiveIcon: UserSolid },
]

export default function BottomNav() {
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then(r => r.data?.results ?? r.data ?? []),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
  const unread = notifications.filter(n => !n.is_read).length

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch h-16">
        {TABS.map(({ to, label, Icon, ActiveIcon, end, bell }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors relative
               ${isActive ? 'text-[#BF2026]' : 'text-gray-400'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  {isActive
                    ? <ActiveIcon className="h-6 w-6" />
                    : <Icon className="h-6 w-6" />
                  }
                  {bell && unread > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-[#BF2026] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span>{label}</span>
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-0.5 bg-[#BF2026] rounded-b-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
