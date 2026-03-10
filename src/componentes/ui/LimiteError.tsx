import { Component, type ReactNode, type ErrorInfo } from 'react';

interface PropsLimiteError {
  children: ReactNode;
}

interface EstadoLimiteError {
  tieneError: boolean;
}

export class LimiteError extends Component<PropsLimiteError, EstadoLimiteError> {
  state: EstadoLimiteError = { tieneError: false };

  static getDerivedStateFromError(): EstadoLimiteError {
    return { tieneError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[LimiteError]', error, info);
  }

  render(): ReactNode {
    if (this.state.tieneError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md w-full text-center bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 mb-4">
              Algo salió mal
            </h2>
            <p className="text-slate-500 font-medium mb-8">
              Ocurrió un error inesperado en esta sección. Por favor intenta de nuevo.
            </p>
            <button
              onClick={() => this.setState({ tieneError: false })}
              className="bg-slate-900 text-white font-black px-8 py-4 rounded-2xl uppercase tracking-widest hover:bg-black transition-colors"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
