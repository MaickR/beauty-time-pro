import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './Tooltip';

type TonoBotonIcono = 'neutro' | 'primario' | 'advertencia' | 'peligro' | 'exito';

interface PropsBotonIconoAccion extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  descripcion: string;
  icono: ReactNode;
  tono?: TonoBotonIcono;
}

const ESTILOS_TONO: Record<TonoBotonIcono, string> = {
  neutro:
    'border-[var(--c-border-strong)] bg-[var(--c-white)] text-[var(--c-text-secondary)] hover:border-[var(--c-border)] hover:bg-[var(--c-bg-tertiary)]',
  primario:
    'border-[var(--c-accent)] bg-[var(--c-accent-50)] text-[var(--c-accent-text)] hover:border-[var(--c-accent-hover)] hover:bg-[var(--c-accent-100)]',
  advertencia:
    'border-[var(--c-border-strong)] bg-[var(--c-bg-tertiary)] text-[var(--c-text-secondary)] hover:border-[var(--c-border)] hover:bg-[var(--c-bg-secondary)]',
  peligro:
    'border-[var(--c-danger)] bg-[var(--c-danger-bg)] text-[var(--c-danger-text)] hover:border-[var(--c-danger-text)] hover:bg-[var(--c-danger-bg)]',
  exito:
    'border-[var(--c-primary-dark)] bg-[var(--c-primary-50)] text-[var(--c-primary-dark)] hover:border-[var(--c-primary-deeper)] hover:bg-[var(--c-primary-100)]',
};

export function BotonIconoAccion({
  descripcion,
  icono,
  tono = 'neutro',
  type = 'button',
  className = '',
  disabled,
  ...props
}: PropsBotonIconoAccion) {
  return (
    <Tooltip texto={descripcion}>
      <button
        type={type}
        aria-label={descripcion}
        disabled={disabled}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-180 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-0 hover:-translate-y-0.5 ${ESTILOS_TONO[tono]} ${className}`.trim()}
        {...props}
      >
        {icono}
      </button>
    </Tooltip>
  );
}
