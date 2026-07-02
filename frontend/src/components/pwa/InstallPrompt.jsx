import { useState, useEffect } from 'react'
import { ArrowDownTrayIcon, XMarkIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow]                     = useState(false)
  const [isIOS, setIsIOS]                   = useState(false)

  useEffect(() => {
    // Don't show if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if dismissed within last 7 days
    const last = localStorage.getItem('pwa-prompt-dismissed')
    if (last && Date.now() - Number(last) < 7 * 24 * 60 * 60 * 1000) return

    // iOS — no beforeinstallprompt, show manual instructions
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    if (ios) {
      setIsIOS(true)
      setShow(true)
      return
    }

    // Android/Chrome: event may have already fired before React mounted —
    // pick it up from window where index.html captured it, or listen normally.
    const attach = (e) => {
      setDeferredPrompt(e)
      setShow(true)
    }

    if (window.__pwaInstallPrompt) {
      attach(window.__pwaInstallPrompt)
    } else {
      window.addEventListener('beforeinstallprompt', attach)
      return () => window.removeEventListener('beforeinstallprompt', attach)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      window.__pwaInstallPrompt = null
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('pwa-prompt-dismissed', String(Date.now()))
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="bg-brand-slate text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 max-w-md mx-auto">
        <div className="p-2 bg-white/10 rounded-xl shrink-0">
          <DevicePhoneMobileIcon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Install LZ ERP</p>
          {isIOS ? (
            <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
              Tap <strong className="text-white">Share</strong> then <strong className="text-white">Add to Home Screen</strong> to install this app on your iPhone.
            </p>
          ) : (
            <p className="text-xs text-white/70 mt-0.5">
              Install for faster access, offline support and a native app feel.
            </p>
          )}
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-2 flex items-center gap-1.5 bg-brand-red text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90">
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              Install App
            </button>
          )}
        </div>
        <button onClick={handleDismiss} className="text-white/50 hover:text-white shrink-0 mt-0.5">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
