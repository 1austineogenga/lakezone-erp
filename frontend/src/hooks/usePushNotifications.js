import { useEffect } from 'react'
import { registerDeviceToken } from '../api/notifications'

export default function usePushNotifications() {
  useEffect(() => {
    // Only runs inside the Capacitor APK — plugin not available on web
    const cap = window?.Capacitor
    if (!cap?.isNativePlatform()) return

    // Access the plugin via the global registry (no import needed)
    const PushNotifications = cap.Plugins?.PushNotifications
    if (!PushNotifications) return

    const listeners = []

    PushNotifications.checkPermissions().then((result) => {
      const state = result?.receive
      if (state === 'prompt' || state === 'prompt-with-rationale') {
        return PushNotifications.requestPermissions()
      }
      return result
    }).then((result) => {
      if (result?.receive !== 'granted') return
      PushNotifications.register()
    }).catch(() => {})

    PushNotifications.addListener('registration', (token) => {
      registerDeviceToken(token.value, 'android').catch(() => {})
    }).then(h => listeners.push(h)).catch(() => {})

    PushNotifications.addListener('registrationError', () => {})
      .then(h => listeners.push(h)).catch(() => {})

    return () => {
      listeners.forEach(h => h?.remove?.())
    }
  }, [])
}
