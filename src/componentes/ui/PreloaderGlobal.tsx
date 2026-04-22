import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import './preloader-global.css';

interface PreloaderVisualProps {
  porcentaje: number;
  mensaje: string;
  subtitulo: string;
  saliendo?: boolean;
}

function PreloaderVisual({
  porcentaje,
  mensaje,
  subtitulo,
  saliendo = false,
}: PreloaderVisualProps) {
  const porcentajeSeguro = Math.max(0, Math.min(100, Math.round(porcentaje)));

  return (
    <div
      className="btp-preloader-overlay"
      data-exit={saliendo ? 'true' : 'false'}
      role="status"
      aria-live="polite"
    >
      <div className="btp-preloader-card">
        <img className="btp-preloader-logo" src="/btp-login.png" alt="Beauty Time Pro" />
        <p className="btp-preloader-subtitle">{subtitulo}</p>
        <p className="btp-preloader-message">{mensaje}</p>
        <div className="btp-preloader-track" aria-hidden="true">
          <span className="btp-preloader-fill" style={{ width: `${porcentajeSeguro}%` }} />
        </div>
        <p className="btp-preloader-percent" aria-label={`Carga ${porcentajeSeguro}%`}>
          {porcentajeSeguro}%
        </p>
      </div>
    </div>
  );
}

export function PreloaderRutaFallback({ mensaje = 'Cargando vista...' }: { mensaje?: string }) {
  const [porcentaje, setPorcentaje] = useState(16);

  useEffect(() => {
    const temporizador = window.setInterval(() => {
      setPorcentaje((actual) => {
        if (actual >= 94) return 94;
        return actual < 70 ? actual + 4 : actual + 2;
      });
    }, 40);

    return () => {
      window.clearInterval(temporizador);
    };
  }, []);

  return <PreloaderVisual porcentaje={porcentaje} mensaje={mensaje} subtitulo="Salon Pro Master" />;
}

export function CapaPreloaderGlobal({ children }: PropsWithChildren) {
  const ubicacion = useLocation();
  const claveRuta = ubicacion.pathname;

  const [visible, setVisible] = useState(true);
  const [saliendo, setSaliendo] = useState(false);
  const [porcentaje, setPorcentaje] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.__ocultarPreloader === 'function') {
      window.__ocultarPreloader();
    }
  }, []);

  useEffect(() => {
    setVisible(true);
    setSaliendo(false);
    setPorcentaje(10);

    const progreso = window.setInterval(() => {
      setPorcentaje((actual) => {
        if (actual >= 92) return 92;
        if (actual < 58) return actual + 8;
        if (actual < 80) return actual + 4;
        return actual + 2;
      });
    }, 28);

    const salida = window.setTimeout(() => {
      setPorcentaje(100);
      setSaliendo(true);
    }, 360);

    const ocultar = window.setTimeout(() => {
      setVisible(false);
    }, 560);

    return () => {
      window.clearInterval(progreso);
      window.clearTimeout(salida);
      window.clearTimeout(ocultar);
    };
  }, [claveRuta]);

  return (
    <>
      {children}
      {visible ? (
        <PreloaderVisual
          porcentaje={porcentaje}
          mensaje="Preparando tu experiencia"
          subtitulo="Beauty Time Pro"
          saliendo={saliendo}
        />
      ) : null}
    </>
  );
}
