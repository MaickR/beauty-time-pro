import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './Tooltip';

type TonoBotonIcono = 'neutro' | 'primario' | 'advertencia' | 'peligro' | 'exito';

interface PropsBotonIconoAccion
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  descripcion: string;
  icono: ReactNode;
  tono?: TonoBotonIcono;
}

const ESTILOS_TONO: Record<TonoBotonIcono, string> = {
  neutro: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700',
  primario: 'border-pink-200 bg-pink-50 text-pink-700 hover:border-pink-300 hover:bg-pink-100',
  advertencia: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100',
  peligro: 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100',
  exito: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
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
        className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS_TONO[tono]} ${className}`.trim()}
        {...props}
      >
        {icono}
      </button>
    </Tooltip>
  );
}