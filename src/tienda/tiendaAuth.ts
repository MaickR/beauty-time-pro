import { create } from 'zustand';
import {
  iniciarSesionConEmailAPI,
  iniciarSesionConClaveAPI,
  refrescarSesion,
  cerrarSesionAPI,
  type PermisosSesionMaestro,
} from '../servicios/servicioAuth';
import { ErrorAPI } from '../lib/clienteHTTP';

export type RolUsuario = 'maestro' | 'dueno' | 'cliente';

interface ResultadoInicioSesion {
  exito: boolean;
  mensaje?: string;
  ruta?: string;
  estudioId?: string | null;
  codigo?: string;
  motivo?: string;
}

interface EstadoAuth {
  usuario: {
    rol: RolUsuario;
    estudioId: string | null;
    nombre: string;
    email: string;
    esMaestroTotal: boolean;
    permisos: PermisosSesionMaestro;
  } | null;
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

function crearPermisosVacios(): PermisosSesionMaestro {
  return {
    aprobarSalones: false,
    gestionarPagos: false,
    crearAdmins: false,
    verAuditLog: false,
    verMetricas: false,
    suspenderSalones: false,
  };
}

export function obtenerRutaPorRol(
  rol: RolUsuario | null,
  estudioActual: string | null,
  claveClienteActual: string | null,
) {
  if (rol === 'maestro') return '/maestro';
  if (rol === 'dueno' && estudioActual) return `/estudio/${estudioActual}/agenda`;
  if (rol === 'cliente') return claveClienteActual ? `/reserva/${claveClienteActual}` : '/inicio';
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
            usuario: {
              rol,
              estudioId: datos.estudioId,
              nombre: datos.nombre ?? '',
              email: datos.email ?? '',
              esMaestroTotal: datos.esMaestroTotal ?? false,
              permisos: datos.permisos ?? crearPermisosVacios(),
            },
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
        usuario: {
          rol,
          estudioId: datos.estudioId,
          nombre: datos.nombre ?? '',
          email: datos.email ?? '',
          esMaestroTotal: datos.esMaestroTotal ?? false,
          permisos: datos.permisos ?? crearPermisosVacios(),
        },
        rol,
        estudioActual: datos.estudioId,
        claveClienteActual: rol === 'cliente' ? datos.estudioId : null,
      });
      const ruta = obtenerRutaPorRol(
        rol,
        datos.estudioId,
        rol === 'cliente' ? datos.estudioId : null,
      );
      return { exito: true, ruta, estudioId: datos.estudioId };
    } catch (error) {
      const mensajeError =
        error instanceof TypeError ||
        (error instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(error.message))
          ? 'No se pudo conectar con el servidor. Verifica que el backend esté activo en el puerto 3000.'
          : error instanceof Error
            ? error.message
            : 'Credenciales incorrectas. Verifica tus datos.';
      return {
        exito: false,
        mensaje: mensajeError,
        codigo: error instanceof ErrorAPI ? error.codigo : undefined,
        motivo: error instanceof ErrorAPI ? error.motivo : undefined,
      };
    }
  },

  iniciarSesionConClave: async (clave) => {
    try {
      const datos = await iniciarSesionConClaveAPI(clave);
      const rol = datos.rol as RolUsuario;
      localStorage.setItem(CLAVE_SESION, '1');
      set({
        usuario: {
          rol,
          estudioId: datos.estudioId,
          nombre: datos.nombre ?? '',
          email: datos.email ?? '',
          esMaestroTotal: datos.esMaestroTotal ?? false,
          permisos: datos.permisos ?? crearPermisosVacios(),
        },
        rol,
        estudioActual: datos.estudioId,
        claveClienteActual: rol === 'cliente' ? datos.estudioId : null,
      });
      const ruta = obtenerRutaPorRol(
        rol,
        datos.estudioId,
        rol === 'cliente' ? datos.estudioId : null,
      );
      return { exito: true, ruta, estudioId: datos.estudioId };
    } catch (error) {
      const mensajeError =
        error instanceof TypeError ||
        (error instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(error.message))
          ? 'No se pudo conectar con el servidor. Verifica que el backend esté activo en el puerto 3000.'
          : error instanceof Error
            ? error.message
            : 'Clave incorrecta.';
      return {
        exito: false,
        mensaje: mensajeError,
        codigo: error instanceof ErrorAPI ? error.codigo : undefined,
        motivo: error instanceof ErrorAPI ? error.motivo : undefined,
      };
    }
  },

  cerrarSesion: async () => {
    try {
      await cerrarSesionAPI();
    } finally {
      localStorage.removeItem(CLAVE_SESION);
      inicializacionPendiente = false;
      set({ usuario: null, rol: null, estudioActual: null, claveClienteActual: null });
    }
  },

  establecerEstudio: (estudioId) => {
    set({ estudioActual: estudioId });
  },
}));
