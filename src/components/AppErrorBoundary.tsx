import { Component, ErrorInfo, ReactNode } from 'react';
import { supportMailto } from '../lib/contact';

type State = { hasError: boolean };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Carleton Lodge website error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-serif text-slate-900">This page could not be displayed</h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">Your lodge information is still safe. Reload the page, return home, or email us if the problem continues.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="min-h-12 rounded-lg bg-slate-900 px-6 font-semibold text-amber-300">Reload Page</button>
            <a href="/" className="inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-6 font-semibold text-slate-800">Return Home</a>
          </div>
          <a href={supportMailto('Website error')} className="mt-6 inline-flex min-h-11 items-center font-semibold text-blue-900 underline underline-offset-4">Email us for help</a>
        </div>
      </div>
    );
  }
}
