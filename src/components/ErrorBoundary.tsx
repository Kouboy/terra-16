import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let friendly = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        if (parsed.error.includes('Quota exceeded')) {
          friendly =
            'Le quota journalier gratuit Firestore a été atteint. Il sera réinitialisé demain automatiquement.';
        } else {
          friendly = `Erreur de synchronisation Cloud (${parsed.operationType || 'opération'}) : ${parsed.error}`;
        }
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, message: friendly };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#eadbc0] text-[#23170e] flex items-center justify-center p-6">
          <div className="max-w-lg w-full grimoire-folio-gold p-6 space-y-4">
            <h1 className="text-xl font-bold font-display text-[#23170e]">
              Interruption temporaire du Grimoire
            </h1>
            <p className="text-sm text-[#5c4028] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="px-4 py-2 text-sm font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1d12] jrpg-shadow hover:bg-[#b91c1c] transition-colors whitespace-nowrap shrink-0"
            >
              Rouvrir le Grimoire
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
