import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { PropsWithChildren } from 'react';
import { ErrorAPI, peticion } from '../lib/clienteHTTP';
import { usarTiendaAuth } from '../tienda/tiendaAuth';
import type { Estudio, Reserva, Pago, Personal } from '../tipos';

interface ValorContextoApp {
  estudios: Estudio[];
  reservas: Reserva[];
  pagos: Pago[];
  cargando: boolean;
  recargar: () => void;
}

const ContextoApp = createContext<ValorContextoApp | null>(null);

export function ProveedorContextoApp({ children }: PropsWithChildren) {
  const usuario = usarTiendaAuth((s) => s.usuario);
  const rol = usarTiendaAuth((s) => s.rol);
  const estudioActual = usarTiendaAuth((s) => s.estudioActual);
  const inicializarAutenticacion = usarTiendaAuth((s) => s.inicializarAutenticacion);
  const cerrarSesion = usarTiendaAuth((s) => s.cerrarSesion);
  const [estudios, setEstudios] = useState<Estudio[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [contador, setContador] = useState(0);

  useEffect(() => {
    const desuscribir = inicializarAutenticacion();
    return desuscribir;
  }, [inicializarAutenticacion]);

  const recargar = useCallback(() => setContador((c) => c + 1), []);

  useEffect(() => {
    if (!usuario || (rol !== 'maestro' && rol !== 'dueno')) return;

    const refrescarAlEnfocar = () => setContador((valor) => valor + 1);
    const refrescarAlVisibilizar = () => {
      if (document.visibilityState === 'visible') {
        refrescarAlEnfocar();
      }
    };

    window.addEventListener('focus', refrescarAlEnfocar);
    document.addEventListener('visibilitychange', refrescarAlVisibilizar);

    return () => {
      window.removeEventListener('focus', refrescarAlEnfocar);
      document.removeEventListener('visibilitychange', refrescarAlVisibilizar);
    };
  }, [usuario, rol]);

  useEffect(() => {
    const tokenSesion =
      typeof window !== 'undefined' ? sessionStorage.getItem('btp_access_token') : null;

    if (rol === 'cliente') {
      setEstudios([]);
      setReservas([]);
      setPagos([]);
      setCargando(false);
      return;
    }

    if (!usuario) {
      setEstudios([]);
      setReservas([]);
      setPagos([]);
      setCargando(false);
      return;
    }

    if (!tokenSesion) {
      setEstudios([]);
      setReservas([]);
      setPagos([]);
      setCargando(false);
      return;
    }

    setCargando(true);

    void (async () => {
      try {
        if (rol === 'maestro') {
          const [resEstudios, resReservas, resPagos] = await Promise.all([
            peticion<{ datos: Estudio[] }>('/estudios'),
            peticion<{ datos: unknown[] }>('/reservas/todas').catch(() => ({
              datos: [] as unknown[],
            })),
            peticion<{ datos: unknown[] }>('/pagos/todos').catch(() => ({
              datos: [] as unknown[],
            })),
          ]);
          const estudiosMapeados = mapearEstudios(resEstudios.datos);
          const estudiosMap = new Map(estudiosMapeados.map((e) => [e.id, e]));
          setEstudios(estudiosMapeados);
          setReservas(mapearReservas(resReservas.datos, estudiosMap));
          setPagos(mapearPagos(resPagos.datos, estudiosMap));
        } else if (rol === 'dueno' && estudioActual) {
          const [resEstudio, resReservas, resPagos] = await Promise.all([
            peticion<{ datos: Estudio }>(`/estudios/${estudioActual}`),
            peticion<{ datos: unknown[] }>(`/estudios/${estudioActual}/reservas`),
            peticion<{ datos: unknown[] }>(`/estudios/${estudioActual}/pagos`).catch(() => ({
              datos: [] as unknown[],
            })),
          ]);
          const estudiosMapeados = mapearEstudios([resEstudio.datos]);
          const estudiosMap = new Map(estudiosMapeados.map((e) => [e.id, e]));
          setEstudios(estudiosMapeados);
          setReservas(mapearReservas(resReservas.datos, estudiosMap));
          setPagos(mapearPagos(resPagos.datos, estudiosMap));
        }
      } catch (error) {
        const estudioEliminado =
          error instanceof ErrorAPI &&
          error.estado === 404 &&
          Boolean(estudioActual) &&
          rol === 'dueno';

        const sesionInvalida = error instanceof ErrorAPI && error.estado === 401;

        if (estudioEliminado || sesionInvalida) {
          setEstudios([]);
          setReservas([]);
          setPagos([]);
          await cerrarSesion();
          return;
        }

        console.error('Error cargando datos:', error);
      } finally {
        setCargando(false);
      }
    })();
  }, [usuario, rol, estudioActual, contador, cerrarSesion]);

  return (
    <ContextoApp.Provider value={{ estudios, reservas, pagos, cargando, recargar }}>
      {children}
    </ContextoApp.Provider>
  );
}

export function usarContextoApp(): ValorContextoApp {
  const contexto = useContext(ContextoApp);
  if (!contexto) {
    throw new Error('usarContextoApp debe usarse dentro de ProveedorContextoApp');
  }
  return contexto;
}

// ──────────────────────────────────────────────
// Helpers de mapeo: API (español) → tipos del frontend (inglés legacy)
// ──────────────────────────────────────────────

function mapearPersonal(datos: Record<string, unknown>[]): Personal[] {
  return datos.map((p) => ({
    id: p['id'] as string,
    name: (p['nombre'] as string) ?? '',
    avatarUrl: (p['avatarUrl'] as string | null | undefined) ?? null,
    specialties: (p['especialidades'] as string[]) ?? [],
    active: (p['activo'] as boolean) ?? true,
    shiftStart: (p['horaInicio'] as string | null) ?? null,
    shiftEnd: (p['horaFin'] as string | null) ?? null,
    breakStart: (p['descansoInicio'] as string | null) ?? null,
    breakEnd: (p['descansoFin'] as string | null) ?? null,
    workingDays: (p['diasTrabajo'] as number[] | null | undefined) ?? null,
  }));
}

function mapearEstudios(datos: Estudio[]): Estudio[] {
  if (!datos.length) return datos;
  // Si el primer elemento ya tiene 'name' (formato legacy), devolver tal cual
  if ('name' in datos[0]!) return datos;
  // Si viene del API (formato nuevo), mapear
  return datos.map((e) => {
    const d = e as unknown as Record<string, unknown>;
    const personalRaw = (d['personal'] as Record<string, unknown>[]) ?? [];
    return {
      ...e,
      slug: (d['slug'] as string) ?? '',
      name: (d['nombre'] as string) ?? '',
      owner: (d['propietario'] as string) ?? '',
      phone: (d['telefono'] as string) ?? '',
      website: d['sitioWeb'] as string | undefined,
      country: ((d['pais'] as string) ?? 'Mexico') as import('../tipos').Pais,
      plan: ((d['plan'] as string) ?? 'STANDARD') as import('../tipos').PlanEstudio,
      branches: (d['sucursales'] as string[]) ?? [],
      assignedKey: (d['claveDueno'] as string) ?? '',
      clientKey: (d['claveCliente'] as string) ?? '',
      subscriptionStart: (d['inicioSuscripcion'] as string) ?? '',
      paidUntil: (d['fechaVencimiento'] as string) ?? '',
      schedule: (d['horario'] as Record<string, import('../tipos').TurnoTrabajo>) ?? {},
      selectedServices: (d['servicios'] as import('../tipos').Servicio[]) ?? [],
      customServices: (d['serviciosCustom'] as import('../tipos').ServicioPersonalizado[]) ?? [],
      holidays: (d['festivos'] as string[]) ?? [],
      staff: mapearPersonal(personalRaw),
      colorPrimario: (d['colorPrimario'] as string | null) ?? null,
      logoUrl: (d['logoUrl'] as string | null) ?? null,
      descripcion: (d['descripcion'] as string | null) ?? null,
      direccion: (d['direccion'] as string | null) ?? null,
      emailContacto: (d['emailContacto'] as string | null) ?? null,
      primeraVez: (d['primeraVez'] as boolean | undefined) ?? true,
      cancelacionSolicitada: (d['cancelacionSolicitada'] as boolean) ?? false,
      fechaSolicitudCancelacion: (d['fechaSolicitudCancelacion'] as string | null) ?? null,
      motivoCancelacion: (d['motivoCancelacion'] as string | null) ?? null,
      precioSuscripcionActual: (d['precioSuscripcionActual'] as number | null | undefined) ?? null,
      monedaSuscripcion:
        (d['monedaSuscripcion'] as import('../tipos').Moneda | null | undefined) ?? null,
      precioSuscripcionProximo:
        (d['precioSuscripcionProximo'] as number | null | undefined) ?? null,
      fechaAplicacionPrecioProximo:
        (d['fechaAplicacionPrecioProximo'] as string | null | undefined) ?? null,
      precioRenovacion: (d['precioRenovacion'] as number | null | undefined) ?? null,
      pinCancelacionConfigurado: (d['pinCancelacionConfigurado'] as boolean) ?? false,
    } as Estudio;
  });
}

function mapearReservas(datos: unknown[], estudiosMap: Map<string, Estudio>): Reserva[] {
  return datos.map((r) => {
    const d = r as Record<string, unknown>;
    const estudio = estudiosMap.get(d['estudioId'] as string);
    const empleado = estudio?.staff?.find((s) => s.id === (d['personalId'] as string));
    const servicios = (d['servicios'] as import('../tipos').Servicio[]) ?? [];
    const serviciosDetalle =
      (d['serviciosDetalle'] as import('../tipos').DetalleServicioReserva[] | undefined) ??
      undefined;
    return {
      id: d['id'] as string,
      studioId: (d['estudioId'] as string) ?? '',
      studioName: estudio?.name ?? '',
      clientName: (d['nombreCliente'] as string) ?? '',
      clientPhone: (d['telefonoCliente'] as string) ?? '',
      services: servicios,
      serviceDetails: serviciosDetalle,
      totalDuration: (d['duracion'] as number) ?? 0,
      totalPrice: (d['precioTotal'] as number) ?? 0,
      status: (d['estado'] as import('../tipos').EstadoReserva) ?? 'pending',
      branch: (d['sucursal'] as string) ?? '',
      staffId: (d['personalId'] as string) ?? '',
      staffName: empleado?.name ?? '',
      date: (d['fecha'] as string) ?? '',
      time: (d['horaInicio'] as string) ?? '',
      colorBrand: (d['marcaTinte'] as string | null) ?? null,
      colorNumber: (d['tonalidad'] as string | null) ?? null,
      observaciones: (d['observaciones'] as string | null) ?? null,
      createdAt: (d['creadoEn'] as string) ?? '',
    };
  });
}

function mapearPagos(datos: unknown[], estudiosMap: Map<string, Estudio>): Pago[] {
  return datos.map((p) => {
    const d = p as Record<string, unknown>;
    const estudio = estudiosMap.get(d['estudioId'] as string);
    return {
      id: d['id'] as string,
      studioId: (d['estudioId'] as string) ?? '',
      studioName: (d['estudioNombre'] as string) ?? estudio?.name ?? '',
      amount: (d['monto'] as number) ?? 0,
      currency: (d['moneda'] as import('../tipos').Moneda) ?? 'MXN',
      country: (d['pais'] as import('../tipos').Pais) ?? estudio?.country ?? 'Mexico',
      date: (d['fecha'] as string) ?? '',
      createdAt: (d['creadoEn'] as string) ?? '',
      concepto: (d['concepto'] as string | undefined) ?? undefined,
      referencia: (d['referencia'] as string | null | undefined) ?? null,
      registradoPorNombre: (d['registradoPorNombre'] as string | null | undefined) ?? null,
      registradoPorEmail: (d['registradoPorEmail'] as string | null | undefined) ?? null,
      fechaBaseRenovacion: (d['fechaBaseRenovacion'] as string | null | undefined) ?? null,
      nuevaFechaVencimiento: (d['nuevaFechaVencimiento'] as string | null | undefined) ?? null,
      estrategiaRenovacion:
        (d['estrategiaRenovacion'] as import('../tipos').Pago['estrategiaRenovacion']) ?? null,
    };
  });
}
