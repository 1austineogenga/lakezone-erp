import { useState, useEffect } from 'react'
import { SignalSlashIcon, SignalIcon } from '@heroicons/react/24/outline'

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    const goOffline = () => setOnline(false)
    const goOnline  = () => { setOnline(true); setShowBack(true); setTimeout(() => setShowBack(false), 3000) }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  if (online && !showBack) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-colors
      ${online ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
      {online
        ? <><SignalIcon className="h-4 w-4" /> Back online — syncing…</>
        : <><SignalSlashIcon className="h-4 w-4" /> You are offline — cached data shown</>
      }
    </div>
  )
}
