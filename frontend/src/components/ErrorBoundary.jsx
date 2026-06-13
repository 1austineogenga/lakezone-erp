import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-brand-red font-semibold text-lg mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <pre className="text-left text-xs bg-white border border-red-100 rounded p-3 overflow-auto max-h-40 text-red-700">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              className="mt-4 px-4 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
