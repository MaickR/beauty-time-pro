import { Component, type ReactNode, type ErrorInfo } from 'react';
import { PaginaError } from './PaginaError';

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
        <PaginaError
          titulo="Algo salió mal"
          mensaje="Ocurrió un error inesperado en esta sección. Por favor intenta de nuevo."
          onReintentar={() => this.setState({ tieneError: false })}
        />
      );
    }

    return this.props.children;
  }
}
