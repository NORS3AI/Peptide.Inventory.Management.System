import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Catches render/lifecycle errors in its subtree and shows a
 * contained fallback instead of unmounting the whole app.
 *
 * Place one keyed by the active tab around the main content so a
 * crash in one view doesn't take down the header/nav, and a root
 * one as a final backstop.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface in the console for debugging; no remote logging here.
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label || 'this section';
    return (
      <div className="max-w-2xl mx-auto my-8 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Something went wrong in {label}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              The rest of PIMS is still usable — switch tabs, or try again. If this
              keeps happening, reload the app.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Reload app
              </button>
            </div>

            <details className="mt-4">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                Technical details
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-red-700 dark:text-red-300 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {String(error?.stack || error?.message || error)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }
}
