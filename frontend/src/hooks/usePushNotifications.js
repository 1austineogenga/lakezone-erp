import { useEffect } from 'react'
import { registerDeviceToken } from '../api/notifications'

export default function usePushNotifications() {
  useEffect(() => {
    // Only runs inside the Capacitor APK
    if (!window?.Capacitor?.isNativePlatform()) return

    let cleanup = null

    import('@capacitor/push-notifications').then(({ PushNotifications }) => {
      PushNotifications.checkPermissions().then((result) => {
        if (result.receive === 'prompt' || result.receive === 'prompt-with-rationale') {
          return PushNotifications.requestPermissions()
        }
        return result
      }).then((result) => {
        if (result.receive !== 'granted') return
        PushNotifications.register()
      })

      const regListener = PushNotifications.addListener('registration', (token) => {
        registerDeviceToken(token.value, 'android').catch(() => {})
      })

      const errListener = PushNotifications.addListener('registrationError', () => {})

      cleanup = () => {
        regListener.then(h => h.remove()).catch(() => {})
        errListener.then(h => h.remove()).catch(() => {})
      }
    }).catch(() => {})

    return () => { if (cleanup) cleanup() }
  }, [])
}
