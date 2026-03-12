import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type FocusEventHandler,
  type MouseEventHandler,
  type ReactElement,
  type TouchEventHandler,
} from 'react';

interface PropsTooltip {
  texto: string;
  children: ReactElement<PropsHijoTooltip>;
}

type PosicionTooltip = 'arriba' | 'abajo';

interface PropsHijoTooltip {
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  onTouchStart?: TouchEventHandler<HTMLElement>;
}

export function Tooltip({ texto, children }: PropsTooltip) {
  const [visible, setVisible] = useState(false);
  const [posicion, setPosicion] = useState<PosicionTooltip>('arriba');
  const temporizadorHover = useRef<number | null>(null);
  const temporizadorTouch = useRef<number | null>(null);
  const contenedorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(
    () => () => {
      if (temporizadorHover.current) {
        window.clearTimeout(temporizadorHover.current);
      }

      if (temporizadorTouch.current) {
        window.clearTimeout(temporizadorTouch.current);
      }
    },
    [],
  );

  if (!isValidElement(children)) {
    return children;
  }

  const actualizarPosicion = () => {
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setPosicion(rect.top < 88 ? 'abajo' : 'arriba');
  };

  const mostrarConRetraso = () => {
    if (temporizadorHover.current) {
      window.clearTimeout(temporizadorHover.current);
    }

    actualizarPosicion();
    temporizadorHover.current = window.setTimeout(() => setVisible(true), 300);
  };

  const ocultar = () => {
    if (temporizadorHover.current) {
      window.clearTimeout(temporizadorHover.current);
    }

    setVisible(false);
  };

  const mostrarEnTouch = () => {
    if (temporizadorTouch.current) {
      window.clearTimeout(temporizadorTouch.current);
    }

    actualizarPosicion();
    setVisible(true);
    temporizadorTouch.current = window.setTimeout(() => setVisible(false), 2000);
  };

  const hijo = cloneElement<PropsHijoTooltip>(children, {
    onMouseEnter: (evento) => {
      children.props.onMouseEnter?.(evento);
      mostrarConRetraso();
    },
    onMouseLeave: (evento) => {
      children.props.onMouseLeave?.(evento);
      ocultar();
    },
    onFocus: (evento) => {
      children.props.onFocus?.(evento);
      mostrarConRetraso();
    },
    onBlur: (evento) => {
      children.props.onBlur?.(evento);
      ocultar();
    },
    onTouchStart: (evento) => {
      children.props.onTouchStart?.(evento);
      mostrarEnTouch();
    },
  });

  return (
    <span ref={contenedorRef} className="relative inline-flex">
      {hijo}
      {visible && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-[140] -translate-x-1/2 whitespace-nowrap rounded-xl bg-gray-800 px-3 py-2 text-xs font-bold text-white shadow-xl ${
            posicion === 'arriba' ? 'bottom-[calc(100%+12px)]' : 'top-[calc(100%+12px)]'
          }`}
        >
          {texto}
          <span
            className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-gray-800 ${
              posicion === 'arriba' ? 'bottom-[-5px]' : 'top-[-5px]'
            }`}
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}
