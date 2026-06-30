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
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-slate-dark flex-col items-center justify-center px-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-brand-red opacity-10" />
        <div className="absolute -bottom-24 -right-16 w-96 h-96 rounded-full bg-brand-red opacity-10" />

        <div className="relative z-10 text-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl inline-block mb-8">
            <img src={logoFull} alt="Lake Zone Enterprises Ltd" className="h-20 w-auto" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">Enterprise Resource Planning</h2>
          <p className="text-brand-gray text-sm leading-relaxed max-w-xs">
            Managing projects, procurement, fleet, HR, finance and inventory — all in one place.
          </p>
        </div>

        {/* Bottom tag */}
        <p className="absolute bottom-6 text-brand-gray text-xs opacity-60">
          © {new Date().getFullYear()} Lake Zone Enterprises Ltd
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="bg-white rounded-xl p-4 shadow-md">
              <img src={logoFull} alt="Lake Zone Enterprises Ltd" className="h-12 w-auto" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-brand-slate mb-1">Welcome back</h1>
          <p className="text-sm text-gray-600 mb-8">Sign in to your ERP account</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                placeholder="you@lakezone.ke"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-red hover:bg-brand-red-dark text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
