import { create } from 'zustand';
import {
  iniciarSesionConEmailAPI,
  iniciarSesionConClaveAPI,
  refrescarSesion,
  cerrarSesionAPI,
} from '../servicios/servicioAuth';

export type RolUsuario = 'maestro' | 'dueno' | 'cliente';

interface ResultadoInicioSesion {
  exito: boolean;
  mensaje?: string;
  ruta?: string;
  estudioId?: string | null;
}

interface EstadoAuth {
  usuario: { rol: RolUsuario; estudioId: string | null; nombre: string; email: string } | null;
  rol: RolUsuario | null;
  estudioActual: string | null;
  claveClienteActual: string | null;
  iniciando: boolean;
  inicializarAutenticacion: () => () => void;
  iniciarSesion: (email: string, contrasena: string) => Promise<ResultadoInicioSesion>;
  iniciarSesionConClave: (clave: string) => Promise<ResultadoInicioSesion>;
  cerrarSesion: () => Promise<void>;
  establecerEstudio: (estudioId: string | null) => void;
}

let inicializacionPendiente = false;
const CLAVE_SESION = 'btp_tiene_sesion';

export function obtenerRutaPorRol(
  rol: RolUsuario | null,
  estudioActual: string | null,
  claveClienteActual: string | null,
) {
  if (rol === 'maestro') return '/maestro';
  if (rol === 'dueno' && estudioActual) return `/estudio/${estudioActual}/agenda`;
  if (rol === 'cliente' && claveClienteActual) return `/reserva/${claveClienteActual}`;
  return '/iniciar-sesion';
}

export const usarTiendaAuth = create<EstadoAuth>((set) => ({
  usuario: null,
  rol: null,
  estudioActual: null,
  claveClienteActual: null,
  iniciando: true,

  inicializarAutenticacion: () => {
    if (!inicializacionPendiente) {
      inicializacionPendiente = true;
      // Si nunca hubo una sesión en este dispositivo, no hace falta
      // llamar al servidor — evita el 401 en consola en visitas sin sesión.
      if (!localStorage.getItem(CLAVE_SESION)) {
        set({ iniciando: false });
        return () => {};
      }
      void refrescarSesion().then((datos) => {
        if (datos) {
          const rol = datos.rol as RolUsuario;
          set({
            usuario: { rol, estudioId: datos.estudioId, nombre: datos.nombre ?? '', email: datos.email ?? '' },
            rol,
            estudioActual: datos.estudioId,
            claveClienteActual: rol === 'cliente' ? datos.estudioId : null,
            iniciando: false,
          });
        } else {
          set({ iniciando: false });
        }
      });
    }
    return () => {
      // No hay suscripción que limpiar en el modelo JWT
    };
  },

  iniciarSesion: async (email, contrasena) => {
    try {
      const datos = await iniciarSesionConEmailAPI(email, contrasena);
      const rol = datos.rol as RolUsuario;
      localStorage.setItem(CLAVE_SESION, '1');
      set({
        usuario: { rol, estudioId: datos.estudioId, nombre: datos.nombre ?? '', email: datos.email ?? '' },
        rol,
        estudioActual: datos.estudioId,
        claveClienteActual: rol === 'cliente' ? datos.estudioId : null,
      });
      const ruta = obtenerRutaPorRol(rol, datos.estudioId, rol === 'cliente' ? datos.estudioId : null);
      return { exito: true, ruta, estudioId: datos.estudioId };
    } catch (error) {
      return {
        exito: false,
        mensaje: error instanceof Error ? error.message : 'Credenciales incorrectas. Verifica tus datos.',
      };
    }
  },

  iniciarSesionConClave: async (clave) => {
    try {
      const datos = await iniciarSesionConClaveAPI(clave);
      const rol = datos.rol as RolUsuario;
      localStorage.setItem(CLAVE_SESION, '1');
      set({
        usuario: { rol, estudioId: datos.estudioId, nombre: datos.nombre ?? '', email: datos.email ?? '' },
        rol,
        estudioActual: datos.estudioId,
        claveClienteActual: rol === 'cliente' ? datos.estudioId : null,
      });
      const ruta = obtenerRutaPorRol(rol, datos.estudioId, rol === 'cliente' ? datos.estudioId : null);
      return { exito: true, ruta, estudioId: datos.estudioId };
    } catch (error) {
      return {
        exito: false,
        mensaje: error instanceof Error ? error.message : 'Clave incorrecta.',
      };
    }
  },

  cerrarSesion: async () => {
    await cerrarSesionAPI();
    localStorage.removeItem(CLAVE_SESION);
    inicializacionPendiente = false;
    set({ usuario: null, rol: null, estudioActual: null, claveClienteActual: null });
  },

  establecerEstudio: (estudioId) => {
    set({ estudioActual: estudioId });
  },
}));