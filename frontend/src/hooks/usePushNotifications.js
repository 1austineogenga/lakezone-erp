import { useEffect } from 'react'
import { registerDeviceToken } from '../api/notifications'

export default function usePushNotifications() {
  useEffect(() => {
    const cap = window?.Capacitor
    if (!cap?.isNativePlatform()) return

    const PushNotifications = cap.Plugins?.PushNotifications
    if (!PushNotifications) return

    const listeners = []

    // Register listeners first, before requesting permission
    PushNotifications.addListener('registration', (token) => {
      registerDeviceToken(token.value, 'android').catch(() => {})
    }).then(h => listeners.push(h)).catch(() => {})

    PushNotifications.addListener('registrationError', () => {})
      .then(h => listeners.push(h)).catch(() => {})

    // Defer permission check + registration so it doesn't run during app mount
    const timer = setTimeout(() => {
      PushNotifications.checkPermissions().then((result) => {
        const state = result?.receive
        if (state === 'prompt' || state === 'prompt-with-rationale') {
          return PushNotifications.requestPermissions()
        }
        return result
      }).then((result) => {
        if (result?.receive !== 'granted') return
        // Further defer register() so FCM init doesn't block the WebView
        setTimeout(() => PushNotifications.register().catch(() => {}), 2000)
      }).catch(() => {})
    }, 3000)

    return () => {
      clearTimeout(timer)
      listeners.forEach(h => h?.remove?.())
    }
  }, [])
}
