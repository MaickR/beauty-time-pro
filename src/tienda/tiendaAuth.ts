import { create } from 'zustand';
import {
  iniciarSesionInteligenteAPI,
  iniciarSesionConClaveAPI,
  buscarAccesoSalonPorClaveAPI,
  refrescarSesion,
  cerrarSesionAPI,
  type PermisosSesionMaestro,
  type PermisosSesionSupervisor,
} from '../servicios/servicioAuth';
import { obtenerAccesoPrincipalCliente } from '../servicios/servicioClienteApp';
import { ErrorAPI, limpiarToken, registrarCallbackSesionExpirada } from '../lib/clienteHTTP';

export type RolUsuario = 'maestro' | 'supervisor' | 'vendedor' | 'dueno' | 'cliente' | 'empleado';

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
    permisosSupervisor: PermisosSesionSupervisor;
    personalId: string | null;
    forzarCambioContrasena: boolean;
  } | null;
  rol: RolUsuario | null;
  estudioActual: string | null;
  slugEstudioActual: string | null;
  claveClienteActual: string | null;
  iniciando: boolean;
  inicializarAutenticacion: () => () => void;
  iniciarSesion: (
    identificador: string | null,
    contrasena: string,
  ) => Promise<ResultadoInicioSesion>;
  iniciarSesionConClave: (clave: string) => Promise<ResultadoInicioSesion>;
  cerrarSesion: () => Promise<void>;
  establecerEstudio: (estudioId: string | null, slugEstudio?: string | null) => void;
  completarCambioContrasenaEmpleado: () => void;
}

let inicializacionPendiente = false;
const CLAVE_SESION = 'btp_tiene_sesion';
const CLAVE_AVISO_INICIO_SESION = 'btp_aviso_inicio_sesion';
const CLAVE_RESERVA_ESTUDIO_ID = 'btp_reserva_estudio_id';
const CLAVE_RESERVA_ESTUDIO_NOMBRE = 'btp_reserva_estudio_nombre';
const CLAVE_RESERVA_ESTUDIO_CLAVE = 'btp_reserva_estudio_clave';

export interface AvisoInicioSesionTransitorio {
  titulo?: string;
  mensaje: string;
  codigo?: string;
  motivo?: string | null;
  tono?: 'amber' | 'red' | 'blue' | 'emerald';
}

export function guardarAvisoInicioSesion(aviso: AvisoInicioSesionTransitorio): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CLAVE_AVISO_INICIO_SESION, JSON.stringify(aviso));
}

export function consumirAvisoInicioSesion(): AvisoInicioSesionTransitorio | null {
  if (typeof window === 'undefined') return null;
  const contenido = sessionStorage.getItem(CLAVE_AVISO_INICIO_SESION);
  if (!contenido) return null;
  sessionStorage.removeItem(CLAVE_AVISO_INICIO_SESION);

  try {
    return JSON.parse(contenido) as AvisoInicioSesionTransitorio;
  } catch {
    return null;
  }
}

function guardarSesionReserva(datos: {
  estudioId: string;
  nombreSalon: string;
  claveSalon: string;
}) {
  sessionStorage.setItem(CLAVE_RESERVA_ESTUDIO_ID, datos.estudioId);
  sessionStorage.setItem(CLAVE_RESERVA_ESTUDIO_NOMBRE, datos.nombreSalon);
  sessionStorage.setItem(CLAVE_RESERVA_ESTUDIO_CLAVE, datos.claveSalon);
}

function leerSesionReserva() {
  const estudioId = sessionStorage.getItem(CLAVE_RESERVA_ESTUDIO_ID);
  const nombreSalon = sessionStorage.getItem(CLAVE_RESERVA_ESTUDIO_NOMBRE);
  const claveSalon = sessionStorage.getItem(CLAVE_RESERVA_ESTUDIO_CLAVE);

  if (!estudioId || !nombreSalon || !claveSalon) {
    return null;
  }

  return { estudioId, nombreSalon, claveSalon };
}

function limpiarSesionReserva() {
  sessionStorage.removeItem(CLAVE_RESERVA_ESTUDIO_ID);
  sessionStorage.removeItem(CLAVE_RESERVA_ESTUDIO_NOMBRE);
  sessionStorage.removeItem(CLAVE_RESERVA_ESTUDIO_CLAVE);
}

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

function crearPermisosSupervisorVacios(): PermisosSesionSupervisor {
  return {
    verTotalSalones: false,
    verControlSalones: false,
    verReservas: false,
    verVentas: false,
    verDirectorio: false,
    editarDirectorio: false,
    verControlCobros: false,
    accionRecordatorio: false,
    accionRegistroPago: false,
    accionSuspension: false,
    activarSalones: false,
    verPreregistros: false,
  };
}

function esClaveClientePublica(clave: string) {
  const claveNormalizada = clave.trim().toUpperCase();
  return (
    /^CLI[0-9A-F]{20}$/.test(claveNormalizada) ||
    /^[A-Z][A-Z0-9]{1,29}[0-9]{2}$/.test(claveNormalizada)
  );
}

async function resolverAccesoPrincipalCliente() {
  try {
    const acceso = await obtenerAccesoPrincipalCliente();

    if (!acceso.encontrado || !acceso.estudioId) {
      return null;
    }

    return {
      estudioId: acceso.estudioId,
      slugEstudio: acceso.slug ?? null,
      nombreSalon: acceso.nombreSalon ?? 'Salon',
      claveCliente: acceso.claveCliente?.trim() || acceso.estudioId,
    };
  } catch {
    return null;
  }
}

export function obtenerRutaPorRol(
  rol: RolUsuario | null,
  estudioActual: string | null,
  slugEstudioActual: string | null,
  claveClienteActual: string | null,
  _forzarCambioContrasena = false,
) {
  if (rol === 'maestro') return '/maestro';
  if (rol === 'supervisor') return '/supervisor';
  if (rol === 'vendedor') return '/vendedor';
  if (rol === 'dueno' && estudioActual) {
    const identificadorRuta = slugEstudioActual ?? estudioActual;
    return `/estudio/${identificadorRuta}/agenda`;
  }
  if (rol === 'cliente') {
    if (claveClienteActual) return `/reservar/${claveClienteActual}`;
    return estudioActual ? `/reservar/${estudioActual}` : '/cliente/inicio';
  }
  if (rol === 'empleado') return '/empleado/agenda';
  return '/iniciar-sesion';
}

export const usarTiendaAuth = create<EstadoAuth>((set) => ({
  usuario: null,
  rol: null,
  estudioActual: null,
  slugEstudioActual: null,
  claveClienteActual: null,
  iniciando: true,

  inicializarAutenticacion: () => {
    if (!inicializacionPendiente) {
      inicializacionPendiente = true;
      const sesionReserva = leerSesionReserva();
      if (sesionReserva) {
        set({
          estudioActual: sesionReserva.estudioId,
          claveClienteActual: sesionReserva.claveSalon,
        });
      }
      // Si nunca hubo una sesión en este dispositivo, no hace falta
      // llamar al servidor — evita el 401 en consola en visitas sin sesión.
      if (!localStorage.getItem(CLAVE_SESION)) {
        set({ iniciando: false });
        return () => {};
      }
      void refrescarSesion().then(async (datos) => {
        if (datos) {
          const rol = datos.rol as RolUsuario;

          let estudioActual = datos.estudioId;
          let slugEstudioActual = datos.slugEstudio ?? null;
          let claveClienteActual: string | null = null;

          if (rol === 'cliente') {
            const accesoPrincipal = await resolverAccesoPrincipalCliente();
            if (accesoPrincipal) {
              estudioActual = accesoPrincipal.estudioId;
              slugEstudioActual = accesoPrincipal.slugEstudio;
              claveClienteActual = accesoPrincipal.claveCliente;
              guardarSesionReserva({
                estudioId: accesoPrincipal.estudioId,
                nombreSalon: accesoPrincipal.nombreSalon,
                claveSalon: accesoPrincipal.claveCliente,
              });
            } else {
              limpiarSesionReserva();
            }
          }

          set({
            usuario: {
              rol,
              estudioId: rol === 'cliente' ? estudioActual : datos.estudioId,
              nombre: datos.nombre ?? '',
              email: datos.email ?? '',
              esMaestroTotal: datos.esMaestroTotal ?? false,
              permisos: datos.permisos ?? crearPermisosVacios(),
              permisosSupervisor: datos.permisosSupervisor ?? crearPermisosSupervisorVacios(),
              personalId: datos.personalId ?? null,
              forzarCambioContrasena: datos.forzarCambioContrasena ?? false,
            },
            rol,
            estudioActual,
            slugEstudioActual,
            claveClienteActual,
            iniciando: false,
          });
        } else {
          localStorage.removeItem(CLAVE_SESION);
          limpiarToken();
          set({
            usuario: null,
            rol: null,
            estudioActual: sesionReserva?.estudioId ?? null,
            slugEstudioActual: null,
            claveClienteActual: sesionReserva?.claveSalon ?? null,
            iniciando: false,
          });
        }
      });
    }
    return () => {
      // No hay suscripción que limpiar en el modelo JWT
    };
  },

  iniciarSesion: async (identificador, contrasena) => {
    try {
      const datos = await iniciarSesionInteligenteAPI(identificador, contrasena);
      const rol = datos.rol as RolUsuario;

      let estudioActual = datos.estudioId;
      let slugEstudioActual = datos.slugEstudio ?? null;
      let claveClienteActual: string | null = null;

      if (rol === 'cliente') {
        const accesoPrincipal = await resolverAccesoPrincipalCliente();
        if (accesoPrincipal) {
          estudioActual = accesoPrincipal.estudioId;
          slugEstudioActual = accesoPrincipal.slugEstudio;
          claveClienteActual = accesoPrincipal.claveCliente;
          guardarSesionReserva({
            estudioId: accesoPrincipal.estudioId,
            nombreSalon: accesoPrincipal.nombreSalon,
            claveSalon: accesoPrincipal.claveCliente,
          });
        } else {
          limpiarSesionReserva();
        }
      }

      localStorage.setItem(CLAVE_SESION, '1');
      if (rol !== 'cliente') {
        limpiarSesionReserva();
      }
      set({
        usuario: {
          rol,
          estudioId: rol === 'cliente' ? estudioActual : datos.estudioId,
          nombre: datos.nombre ?? '',
          email: datos.email ?? '',
          esMaestroTotal: datos.esMaestroTotal ?? false,
          permisos: datos.permisos ?? crearPermisosVacios(),
          permisosSupervisor: datos.permisosSupervisor ?? crearPermisosSupervisorVacios(),
          personalId: datos.personalId ?? null,
          forzarCambioContrasena: datos.forzarCambioContrasena ?? false,
        },
        rol,
        estudioActual,
        slugEstudioActual,
        claveClienteActual,
      });
      const ruta = obtenerRutaPorRol(
        rol,
        estudioActual,
        slugEstudioActual,
        claveClienteActual,
        datos.forzarCambioContrasena ?? false,
      );
      return { exito: true, ruta, estudioId: estudioActual };
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
      const claveNormalizada = clave.trim().toUpperCase();

      if (esClaveClientePublica(claveNormalizada)) {
        try {
          const datosReserva = await buscarAccesoSalonPorClaveAPI(claveNormalizada);
          limpiarToken();
          guardarSesionReserva(datosReserva);
          set({
            estudioActual: datosReserva.estudioId,
            claveClienteActual: datosReserva.claveSalon,
          });
          return {
            exito: true,
            ruta: `/reservar/${datosReserva.claveSalon}`,
            estudioId: datosReserva.estudioId,
          };
        } catch {
          // Si la clave parece pública pero no existe, el backend de auth resolverá el error final.
        }
      }

      const datos = await iniciarSesionConClaveAPI(claveNormalizada);
      const rol = datos.rol as RolUsuario;

      if (rol === 'cliente') {
        guardarSesionReserva({
          estudioId: datos.estudioId ?? '',
          nombreSalon: datos.nombre,
          claveSalon: claveNormalizada,
        });
        set({
          usuario: {
            rol,
            estudioId: datos.estudioId,
            nombre: datos.nombre,
            email: datos.email,
            esMaestroTotal: datos.esMaestroTotal,
            permisos: datos.permisos ?? crearPermisosVacios(),
            permisosSupervisor: datos.permisosSupervisor ?? crearPermisosSupervisorVacios(),
            personalId: datos.personalId ?? null,
            forzarCambioContrasena: datos.forzarCambioContrasena ?? false,
          },
          rol,
          estudioActual: datos.estudioId,
          slugEstudioActual: datos.slugEstudio ?? null,
          claveClienteActual: claveNormalizada,
        });
        return {
          exito: true,
          ruta: `/reservar/${claveNormalizada}`,
          estudioId: datos.estudioId,
        };
      }

      localStorage.setItem(CLAVE_SESION, '1');
      limpiarSesionReserva();
      set({
        usuario: {
          rol,
          estudioId: datos.estudioId,
          nombre: datos.nombre,
          email: datos.email,
          esMaestroTotal: datos.esMaestroTotal,
          permisos: datos.permisos ?? crearPermisosVacios(),
          permisosSupervisor: datos.permisosSupervisor ?? crearPermisosSupervisorVacios(),
          personalId: datos.personalId ?? null,
          forzarCambioContrasena: datos.forzarCambioContrasena ?? false,
        },
        rol,
        estudioActual: datos.estudioId,
        slugEstudioActual: datos.slugEstudio ?? null,
        claveClienteActual: null,
      });

      const ruta = obtenerRutaPorRol(
        rol,
        datos.estudioId,
        datos.slugEstudio ?? null,
        null,
        datos.forzarCambioContrasena ?? false,
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
      limpiarSesionReserva();
      limpiarToken();
      inicializacionPendiente = false;
      set({
        usuario: null,
        rol: null,
        estudioActual: null,
        slugEstudioActual: null,
        claveClienteActual: null,
      });
    }
  },

  establecerEstudio: (estudioId, slugEstudio = null) => {
    set({ estudioActual: estudioId, slugEstudioActual: slugEstudio });
  },

  completarCambioContrasenaEmpleado: () => {
    set((estado) => ({
      usuario: estado.usuario ? { ...estado.usuario, forzarCambioContrasena: false } : null,
    }));
  },
}));

// Cuando el backend invalida la sesión por expiración o bloqueo, limpiar estado
// y redirigir al login mostrando el motivo exacto.
registrarCallbackSesionExpirada(({ mensaje, codigo }) => {
  localStorage.removeItem(CLAVE_SESION);
  limpiarSesionReserva();
  inicializacionPendiente = false;
  usarTiendaAuth.setState({
    usuario: null,
    rol: null,
    estudioActual: null,
    slugEstudioActual: null,
    claveClienteActual: null,
  });
  if (typeof window !== 'undefined') {
    guardarAvisoInicioSesion({
      titulo: 'Session ended',
      mensaje: mensaje || 'Your session is no longer active. Sign in again to continue.',
      codigo,
      tono: codigo ? 'amber' : 'blue',
    });
    window.location.replace('/iniciar-sesion');
  }
});
