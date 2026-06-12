import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getMe } from '../../api/auth'
import useAuthStore from '../../store/authStore'
import logoFull from '../../assets/logo-full.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await login(form.email, form.password)
      setTokens(data.access, data.refresh)
      const { data: me } = await getMe()
      setUser(me)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-slate-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header stripe */}
          <div className="bg-brand-red h-2" />

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <img src={logoFull} alt="Lake Zone Enterprises Ltd" className="h-14" />
            </div>

            <h2 className="text-xl font-semibold text-brand-slate text-center mb-1">
              ERP System Login
            </h2>
            <p className="text-sm text-gray-500 text-center mb-8">
              Sign in to your account
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                  placeholder="you@lakezone.ke"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-red hover:bg-brand-red-dark text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Footer stripe */}
          <div className="bg-brand-gray-light px-8 py-3 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Lake Zone Enterprises Ltd
          </div>
        </div>
      </div>
    </div>
  )
}
