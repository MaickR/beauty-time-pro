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
  neutro: 'border-[#c9c1bb] bg-white text-[#5f5854] hover:border-[#b2a8a1] hover:bg-[#f4efec]',
  primario:
    'border-[#c6968c] bg-[#f4e9e5] text-[#5c423e] hover:border-[#ab7f76] hover:bg-[#fbf6f4]',
  advertencia:
    'border-[#c9c1bb] bg-[#f4efec] text-[#5f5854] hover:border-[#b2a8a1] hover:bg-[#e9e4e0]',
  peligro: 'border-[#9e2b1f] bg-[#fef2f2] text-[#991b1b] hover:border-[#7f1d1d] hover:bg-[#fee2e2]',
  exito: 'border-[#143c32] bg-[#eff5f3] text-[#143c32] hover:border-[#0a2823] hover:bg-[#d9e8e3]',
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
