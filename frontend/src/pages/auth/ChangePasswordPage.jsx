import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../../api/auth'
import { getMe } from '../../api/auth'
import useAuthStore from '../../store/authStore'
import logoFull from '../../assets/logo-full.png'
import { LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.new_password !== form.confirm) {
      setError('New passwords do not match.')
      return
    }
    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await changePassword(form.old_password, form.new_password)
      const { data: me } = await getMe()
      setUser(me)
      setDone(true)
      setTimeout(() => navigate('/'), 1800)
    } catch (err) {
      const msg = err?.response?.data?.old_password || err?.response?.data?.new_password || err?.response?.data?.detail
      setError(msg || 'Failed to change password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">

          <div className="flex justify-center mb-6">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <img src={logoFull} alt="Lake Zone Enterprises" className="h-10 w-auto" />
            </div>
          </div>

          {done ? (
            <div className="text-center py-4">
              <CheckCircleIcon className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-800 mb-1">Password Updated</h2>
              <p className="text-sm text-gray-500">Redirecting you to the dashboard…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-brand-red/10 rounded-lg">
                  <LockClosedIcon className="h-5 w-5 text-brand-red" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-800">Change Your Password</h1>
                  <p className="text-xs text-gray-500">You must set a new password before continuing.</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 mt-4">
                <p className="text-xs text-amber-800">
                  Your account was set up with a temporary password. Please choose a strong, unique password that you will remember.
                </p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current (Temporary) Password</label>
                  <input
                    type="password" required
                    value={form.old_password}
                    onChange={e => setForm({ ...form, old_password: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                    placeholder="Enter the password you received"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <input
                    type="password" required
                    value={form.new_password}
                    onChange={e => setForm({ ...form, new_password: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <input
                    type="password" required
                    value={form.confirm}
                    onChange={e => setForm({ ...form, confirm: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                    placeholder="Repeat new password"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-brand-red hover:bg-brand-red-dark text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-60 mt-2"
                >
                  {loading ? 'Saving…' : 'Set New Password'}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">Lake Zone Enterprises ERP · erp.lakezone.ke</p>
      </div>
    </div>
  )
}
