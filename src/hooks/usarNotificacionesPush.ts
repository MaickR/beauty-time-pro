import { useEffect, useMemo, useState } from 'react';
import { peticion } from '../lib/clienteHTTP';
import { usarTiendaAuth } from '../tienda/tiendaAuth';

async function limpiarServiceWorkersLocales() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const registros = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registros.map((registro) => registro.unregister()));
}

function urlBase64AUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Url);
  return Uint8Array.from([...raw].map((caracter) => caracter.charCodeAt(0)));
}

async function obtenerRegistroServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  if (import.meta.env.DEV) {
    await limpiarServiceWorkersLocales();
    return null;
  }

  const registroExistente = await navigator.serviceWorker.getRegistration('/sw.js');
  if (registroExistente) return registroExistente;

  return navigator.serviceWorker.register('/sw.js');
}

export function usarNotificacionesPush() {
  const usuario = usarTiendaAuth((estado) => estado.usuario);
  const [notificacionesActivas, setNotificacionesActivas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [descartado, setDescartado] = useState(false);

  const soportadoNavegador =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const contextoSeguroPush =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(window.location.hostname));
  const esDesarrollo = import.meta.env.DEV;
  const soportado = soportadoNavegador && contextoSeguroPush && !esDesarrollo;
  const claveUsuario = useMemo(() => {
    if (!usuario) return 'anonimo';
    return `${usuario.rol}:${usuario.email || usuario.estudioId || usuario.nombre}`;
  }, [usuario]);
  const claveDescartar = `btp_push_descartado_${claveUsuario}`;

  useEffect(() => {
    setDescartado(localStorage.getItem(claveDescartar) === '1');
  }, [claveDescartar]);

  useEffect(() => {
    if (!soportado) {
      if (esDesarrollo) {
        void limpiarServiceWorkersLocales();
      }
      setNotificacionesActivas(false);
      setCargando(false);
      return;
    }

    let cancelado = false;

    void (async () => {
      try {
        if (Notification.permission !== 'granted') {
          if (!cancelado) setNotificacionesActivas(false);
          return;
        }

        const registro = await navigator.serviceWorker.getRegistration('/sw.js');
        const suscripcion = await registro?.pushManager.getSubscription();
        if (!cancelado) {
          setNotificacionesActivas(Boolean(suscripcion));
        }
        // Si el navegador ya tiene suscripción, re-registrarla en el servidor
        // para el usuario actual (por si inició sesión en un dispositivo que otro
        // usuario ya había suscripto). El backend hace upsert por endpoint.
        if (suscripcion && !cancelado) {
          peticion('/push/suscribir', {
            method: 'POST',
            body: JSON.stringify(suscripcion.toJSON()),
          }).catch(() => {});
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [esDesarrollo, soportado]);

  const activar = async () => {
    if (!soportadoNavegador) return false;

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('[Push] Solo disponible en HTTPS');
      return false;
    }

    const registro = await obtenerRegistroServiceWorker();
    if (!registro) return false;

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      setNotificacionesActivas(false);
      return false;
    }

    const { clavePublica } = await peticion<{ clavePublica: string }>('/push/clave-publica');
    let suscripcion = await registro.pushManager.getSubscription();

    if (!suscripcion) {
      const claveAplicacion = urlBase64AUint8Array(clavePublica) as unknown as BufferSource;
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveAplicacion,
      });
    }

    await peticion('/push/suscribir', {
      method: 'POST',
      body: JSON.stringify(suscripcion.toJSON()),
    });

    localStorage.removeItem(claveDescartar);
    setDescartado(false);
    setNotificacionesActivas(true);
    return true;
  };

  const desactivar = async () => {
    if (!soportado) return false;

    const registro = await navigator.serviceWorker.getRegistration('/sw.js');
    const suscripcion = await registro?.pushManager.getSubscription();

    if (suscripcion?.endpoint) {
      await peticion('/push/cancelar', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: suscripcion.endpoint }),
      });
    }

    await suscripcion?.unsubscribe();
    setNotificacionesActivas(false);
    return true;
  };

  const descartar = () => {
    localStorage.setItem(claveDescartar, '1');
    setDescartado(true);
  };

  return {
    activar,
    desactivar,
    descartar,
    soportado,
    cargando,
    notificacionesActivas,
    bannerVisible: soportado && !cargando && !notificacionesActivas && !descartado,
  };
}
