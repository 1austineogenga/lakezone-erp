import { useState, useEffect, useRef } from 'react'
import { ArrowDownTrayIcon, XMarkIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'

// Shared state so both the banner and sidebar button stay in sync
let _prompt = null
const _listeners = new Set()
const notify = () => _listeners.forEach(fn => fn(_prompt))

if (typeof window !== 'undefined') {
  const capture = (e) => { e.preventDefault(); _prompt = e; notify() }
  if (window.__pwaInstallPrompt) {
    _prompt = window.__pwaInstallPrompt
  } else {
    window.addEventListener('beforeinstallprompt', capture)
  }
}

export function usePWAInstall() {
  const isStandalone = typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches
  const isIOS = typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  const [prompt, setPrompt] = useState(_prompt)

  useEffect(() => {
    const update = (p) => setPrompt(p)
    _listeners.add(update)
    return () => _listeners.delete(update)
  }, [])

  const install = async () => {
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') { _prompt = null; notify() }
    return outcome === 'accepted'
  }

  return { prompt, isIOS, isStandalone, install }
}

// ── Bottom banner (auto-shows, dismissable) ───────────────────────────────────

export default function InstallBanner() {
  const { prompt, isIOS, isStandalone, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(() => {
    const last = localStorage.getItem('pwa-banner-dismissed')
    return !!last && Date.now() - Number(last) < 7 * 24 * 60 * 60 * 1000
  })

  if (isStandalone || dismissed) return null
  if (!prompt && !isIOS) return null   // Android: wait for the prompt event

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-banner-dismissed', String(Date.now()))
  }

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
              Tap <strong className="text-white">Share</strong> then{' '}
              <strong className="text-white">Add to Home Screen</strong>.
            </p>
          ) : (
            <>
              <p className="text-xs text-white/70 mt-0.5">
                Install for faster access and offline support.
              </p>
              <button onClick={install}
                className="mt-2 flex items-center gap-1.5 bg-brand-red text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90">
                <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Install App
              </button>
            </>
          )}
        </div>
        <button onClick={handleDismiss} className="text-white/50 hover:text-white shrink-0 mt-0.5">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// ── Timed nudge banner (appears 15 s after mount, guides users to Chrome menu) ─

export function NudgeBanner() {
  const { isStandalone, prompt } = usePWAInstall()
  const isAndroid = typeof window !== 'undefined' &&
    /android/i.test(navigator.userAgent)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  const dismissed = () => {
    const last = localStorage.getItem('pwa-nudge-dismissed')
    return !!last && Date.now() - Number(last) < 3 * 24 * 60 * 60 * 1000
  }

  useEffect(() => {
    // Only nudge Android users who haven't installed and haven't dismissed
    if (isStandalone || !isAndroid || dismissed()) return
    // If native prompt is already available, InstallBanner handles it
    if (prompt) return
    timerRef.current = setTimeout(() => setVisible(true), 15000)
    return () => clearTimeout(timerRef.current)
  }, [isStandalone, isAndroid, prompt])

  if (!visible) return null

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem('pwa-nudge-dismissed', String(Date.now()))
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="bg-brand-slate text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 max-w-md mx-auto">
        <div className="p-2 bg-white/10 rounded-xl shrink-0">
          <DevicePhoneMobileIcon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Install LZ ERP</p>
          <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
            Tap <strong className="text-white">⋮</strong> in Chrome, then tap{' '}
            <strong className="text-white">Install app</strong> or{' '}
            <strong className="text-white">Add to Home screen</strong>.
          </p>
        </div>
        <button onClick={handleDismiss} className="text-white/50 hover:text-white shrink-0 mt-0.5">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// ── Sidebar install button (always visible, manual trigger) ───────────────────

export function SidebarInstallButton() {
  const { prompt, isIOS, isStandalone, install } = usePWAInstall()
  const [showGuide, setShowGuide] = useState(false)

  if (isStandalone) return null   // already installed

  const handleClick = async () => {
    if (prompt) {
      await install()
    } else {
      // No native prompt — show manual instructions
      setShowGuide(true)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors">
        <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
        Install App
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setShowGuide(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-brand-slate">Install LZ ERP</p>
              <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {isIOS ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="bg-brand-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                  Open this page in <strong>Safari</strong> (required on iPhone)
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-brand-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                  Tap the <strong>Share</strong> button (box with arrow) at the bottom
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-brand-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                  Scroll down and tap <strong>Add to Home Screen</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-brand-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">4</span>
                  Tap <strong>Add</strong> in the top right
                </li>
              </ol>
            ) : (
              <>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  Must be opened in <strong>Google Chrome</strong>. Other browsers (Firefox, Samsung Internet) do not support installation.
                </p>
                <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="bg-brand-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                  Tap the <strong>⋮</strong> (three dots) menu in Chrome
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-brand-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                  Look for <strong>Install app</strong> or <strong>Add to Home screen</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-brand-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                  Tap <strong>Install</strong> or <strong>Add</strong> to confirm
                </li>
              </ol>
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-3">
                  Don't see <strong>Install app</strong>? Use the app for a few minutes and check again — Chrome enables this option after brief engagement with the site.
                </p>
              </>
            )}
            <button onClick={() => setShowGuide(false)}
              className="mt-5 w-full bg-brand-slate text-white py-2.5 rounded-xl text-sm font-semibold">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
