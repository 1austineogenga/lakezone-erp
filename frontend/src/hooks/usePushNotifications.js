import { useEffect } from 'react'
import { registerDeviceToken } from '../api/notifications'

export default function usePushNotifications() {
  useEffect(() => {
    const cap = window?.Capacitor
    if (!cap?.isNativePlatform()) return

    const FcmPlugin = cap.Plugins?.FcmPlugin
    if (!FcmPlugin) return

    // Defer so FCM token fetch doesn't run during app mount
    const timer = setTimeout(() => {
      FcmPlugin.getToken()
        .then(({ token }) => {
          if (token) registerDeviceToken(token, 'android').catch(() => {})
        })
        .catch(() => {})
    }, 4000)

    return () => clearTimeout(timer)
  }, [])
}
