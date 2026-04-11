import { useEffect, useMemo, useState } from 'react';
import { Building2, LogOut, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { usarTemaSalon } from '../../hooks/usarTemaSalon';
import { obtenerFechaLocalISO } from '../../utils/formato';
import { usarFlujoReserva } from './hooks/usarFlujoReserva';
import { SelectorServicio } from './componentes/SelectorServicio';
import { SelectorCalendario } from './componentes/SelectorCalendario';
import { SelectorEspecialistaHorario } from './componentes/SelectorEspecialistaHorario';
import { FormularioContacto } from './componentes/FormularioContacto';
import { ConfirmacionReserva } from './componentes/ConfirmacionReserva';
import { Spinner } from '../../componentes/ui/Spinner';
import { URL_BASE } from '../../lib/clienteHTTP';
import {
  obtenerSalonPublico,
  obtenerSalonPublicoPorClave,
} from '../../servicios/servicioClienteApp';
import type { Estudio, Moneda, SalonDetalle } from '../../tipos';

const PALABRAS_COLOR = [
  'tinte',
  'color',
  'balayage',
  'babylights',
  'canas',
  'ombré',
  'decoloración',
  'rayitos',
  'mechas',
];

export function PaginaReserva() {
  const { claveEstudio } = useParams<{ claveEstudio: string }>();
  const { cerrarSesion, rol } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const navegar = useNavigate();
  const flujo = usarFlujoReserva();
  const [estudio, setEstudio] = useState<Estudio | null>(null);
  const [estudioActivo, setEstudioActivo] = useState<Estudio | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!claveEstudio) {
      setEstudio(null);
      setEstudioActivo(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    void obtenerSalonPublicoPorClave(claveEstudio)
      .then((salon) => {
        if (cancelado) return;
        const identificadorAcceso = claveEstudio.trim();
        const estudioBase = mapearSalonDetalleAEstudio(salon, identificadorAcceso);
        setEstudio(estudioBase);
        setEstudioActivo(estudioBase);
        sessionStorage.setItem('btp_reserva_estudio_id', salon.id);
        sessionStorage.setItem('btp_reserva_estudio_nombre', salon.nombre);
        sessionStorage.setItem('btp_reserva_estudio_clave', identificadorAcceso);
        usarTiendaAuth.setState({
          estudioActual: salon.id,
          slugEstudioActual: salon.slug ?? null,
          claveClienteActual: identificadorAcceso,
        });
      })
      .catch(() => {
        if (!cancelado) {
          setEstudio(null);
          setEstudioActivo(null);
          usarTiendaAuth.setState({ estudioActual: null, claveClienteActual: null });
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [claveEstudio]);

  usarTemaSalon(estudio?.colorPrimario);

  useEffect(() => {
    if (estudio?.name) document.title = `${estudio.name} — Reservar cita`;
    return () => {
      document.title = 'Beauty Time Pro';
    };
  }, [estudio?.name]);

  useEffect(() => {
    const sedesReservables = estudio?.sedes ?? [];
    if (sedesReservables.length === 1 && !flujo.sucursalSeleccionada) {
      flujo.seleccionarSucursal(sedesReservables[0]?.id ?? '');
    }
  }, [estudio?.id, estudio?.sedes, flujo.sucursalSeleccionada]);

  useEffect(() => {
    if (!estudio) return;

    const sedesReservables = estudio.sedes ?? [];
    const sedeActiva =
      sedesReservables.find((sede) => sede.id === flujo.sucursalSeleccionada) ?? null;

    if (!sedeActiva || sedeActiva.id === estudio.id) {
      setEstudioActivo(estudio);
      return;
    }

    let cancelado = false;
    void obtenerSalonPublico(sedeActiva.id)
      .then((salon) => {
        if (cancelado) return;
        setEstudioActivo(
          mapearSalonDetalleAEstudio(salon, claveEstudio?.trim() ?? sedeActiva.slug ?? ''),
        );
      })
      .catch(() => {
        if (!cancelado) {
          setEstudioActivo(estudio);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [claveEstudio, estudio, flujo.sucursalSeleccionada]);

  const totalDuracion = useMemo(
    () => flujo.serviciosSeleccionados.reduce((acc, s) => acc + s.duration, 0),
    [flujo.serviciosSeleccionados],
  );

  if (cargando)
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <Spinner tamaño="lg" />
      </div>
    );
  if (!estudio || !estudioActivo)
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400 font-bold">Salón no encontrado o enlace inválido.</p>
      </div>
    );

  const sedesReservables = estudio.sedes ?? [];
  const sedeActiva =
    sedesReservables.find((sede) => sede.id === flujo.sucursalSeleccionada) ??
    (sedesReservables.length === 1 ? sedesReservables[0] : null);
  const requiereSucursal = sedesReservables.length > 1;
  const sucursalActiva = sedeActiva?.nombre ?? estudioActivo.name ?? 'Main location';
  const moneda: Moneda = estudioActivo.country === 'Colombia' ? 'COP' : 'MXN';
  const requiereColor = flujo.serviciosSeleccionados.some((s) =>
    PALABRAS_COLOR.some((kw) => s.name.toLowerCase().includes(kw)),
  );
  const fechaStr = obtenerFechaLocalISO(flujo.fechaSeleccionada);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {flujo.reservaExitosa && (
        <ConfirmacionReserva
          nombreCliente={flujo.nombreClienteReservado}
          descripcionRecompensa={flujo.descripcionRecompensaGanada}
          salon={estudio.name}
          sucursal={sucursalActiva}
          especialista={flujo.resumenReservaConfirmada?.especialista ?? ''}
          servicios={flujo.resumenReservaConfirmada?.servicios ?? []}
          duracion={flujo.resumenReservaConfirmada?.duracion ?? 0}
          total={flujo.resumenReservaConfirmada?.total ?? 0}
          fecha={flujo.resumenReservaConfirmada?.fecha ?? ''}
          hora={flujo.resumenReservaConfirmada?.hora ?? ''}
          moneda={moneda}
          onCerrar={() => {
            flujo.reiniciar(requiereSucursal ? '' : (sedeActiva?.id ?? estudioActivo.id));
            if (rol === 'empleado') {
              navegar('/empleado/agenda');
              return;
            }
            if (rol === 'dueno') {
              navegar(`/estudio/${estudio.slug || estudio.id}/agenda`);
              return;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-100 bg-white/90 p-4 shadow-sm backdrop-blur-md md:p-6">
        <div className="flex items-center gap-4">
          {estudio.logoUrl ? (
            <img
              src={`${URL_BASE}${estudio.logoUrl}`}
              alt={`Logo de ${estudio.name}`}
              className="w-12 h-12 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm"
              style={{ backgroundColor: estudio.colorPrimario ?? '#C2185B' }}
              aria-label="Ícono predeterminado del salón"
            >
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none">
              {estudio.name}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Reserva de citas
            </p>
          </div>
        </div>
        {rol ? (
          <button
            onClick={async () => {
              await cerrarSesion();
              navegar('/iniciar-sesion');
            }}
            aria-label="Cerrar sesión"
            className="rounded-full bg-slate-50 p-3 text-slate-400 hover:bg-slate-100"
          >
            <LogOut />
          </button>
        ) : null}
      </header>

      {(estudio.descripcion || estudio.direccion) && (
        <div className="bg-slate-50 border-b border-slate-100 px-6 md:px-8 py-4">
          <div className="max-w-4xl mx-auto space-y-1">
            {estudio.descripcion && <p className="text-sm text-slate-600">{estudio.descripcion}</p>}
            <p className="text-xs font-semibold text-slate-500">
              {sucursalActiva}
              {estudioActivo.direccion ? ` · ${estudioActivo.direccion}` : ''}
            </p>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8 pb-32">
        <section className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Reserva pública
              </p>
              <h2 className="mt-2 text-lg font-black text-slate-900">Elige sede y continúa</h2>
            </div>
            {requiereSucursal ? (
              <label className="block w-full md:max-w-sm">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <Building2 className="h-4 w-4" /> Sede
                </span>
                <select
                  value={flujo.sucursalSeleccionada}
                  onChange={(evento) => flujo.seleccionarSucursal(evento.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-pink-400"
                >
                  <option value="">Selecciona una sede</option>
                  {sedesReservables.map((sede) => (
                    <option key={sede.id} value={sede.id}>
                      {sede.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <MapPin className="h-4 w-4 text-pink-500" /> {sucursalActiva}
              </div>
            )}
          </div>
        </section>

        {/* Paso 1: Servicios */}
        <SelectorServicio
          estudio={estudioActivo}
          sucursalSeleccionada={sucursalActiva}
          requiereSucursal={requiereSucursal}
          serviciosSeleccionados={flujo.serviciosSeleccionados}
          moneda={moneda}
          onAlternar={flujo.alternarServicio}
        />

        {/* Paso 2: Calendario — solo cuando hay servicios seleccionados */}
        {(!requiereSucursal || Boolean(flujo.sucursalSeleccionada)) &&
          flujo.serviciosSeleccionados.length > 0 && (
            <SelectorCalendario
              estudio={estudioActivo}
              fechaSeleccionada={flujo.fechaSeleccionada}
              totalDuracion={totalDuracion}
              onCambiarFecha={flujo.seleccionarFecha}
            />
          )}

        {/* Paso 3: Especialistas disponibles para el día elegido */}
        {(!requiereSucursal || Boolean(flujo.sucursalSeleccionada)) &&
          flujo.serviciosSeleccionados.length > 0 &&
          totalDuracion > 0 && (
            <SelectorEspecialistaHorario
              salonId={estudioActivo.id}
              sucursalSeleccionada={sucursalActiva}
              fecha={fechaStr}
              totalDuracion={totalDuracion}
              serviciosSeleccionados={flujo.serviciosSeleccionados}
              personalSeleccionado={flujo.personalSeleccionado}
              horaSeleccionada={flujo.horaSeleccionada}
              onSeleccionar={flujo.seleccionarEspecialistaYHora}
            />
          )}

        {/* Paso 4: Formulario de contacto */}
        {flujo.horaSeleccionada && flujo.personalSeleccionado && (
          <FormularioContacto
            estudio={estudioActivo}
            flujo={flujo}
            requiereColor={requiereColor}
            onEnviar={(datos) => flujo.enviarReserva(estudioActivo, mostrarToast, datos)}
          />
        )}
      </main>
    </div>
  );
}

function mapearSalonDetalleAEstudio(salon: SalonDetalle, claveSalon: string): Estudio {
  return {
    id: salon.id,
    slug: salon.slug ?? '',
    name: salon.nombre,
    owner: '',
    phone: salon.telefono,
    country: salon.pais,
    plan: 'STANDARD',
    branches: salon.sucursales && salon.sucursales.length > 0 ? salon.sucursales : ['Principal'],
    assignedKey: '',
    clientKey: claveSalon,
    subscriptionStart: '',
    paidUntil: '',
    holidays: salon.festivos,
    schedule: salon.horario,
    selectedServices: salon.servicios,
    customServices: [],
    staff: salon.personal.map((miembro) => ({
      id: miembro.id,
      name: miembro.nombre,
      specialties: miembro.especialidades,
      active: true,
      shiftStart: miembro.horaInicio,
      shiftEnd: miembro.horaFin,
      breakStart: miembro.descansoInicio,
      breakEnd: miembro.descansoFin,
      workingDays: (miembro.diasTrabajo as number[] | null | undefined) ?? null,
    })),
    colorPrimario: salon.colorPrimario,
    logoUrl: salon.logoUrl,
    descripcion: salon.descripcion,
    direccion: salon.direccion,
    emailContacto: salon.emailContacto,
    createdAt: '',
    updatedAt: '',
    estudioPrincipalId: salon.estudioPrincipalId ?? null,
    esSede: Boolean(salon.estudioPrincipalId),
    permiteReservasPublicas: salon.permiteReservasPublicas ?? true,
    sedes: salon.sedesReservables ?? [],
  };
}
