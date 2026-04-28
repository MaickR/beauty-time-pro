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
import {
  PanelIdentificacionReserva,
  type ClienteReservaVinculado,
} from './componentes/PanelIdentificacionReserva';
import { SelectorProductosPublicos } from './componentes/SelectorProductosPublicos';
import { Spinner } from '../../componentes/ui/Spinner';
import { URL_BASE } from '../../lib/clienteHTTP';
import { obtenerSalonPublicoPorClave } from '../../servicios/servicioClienteApp';
import type { Estudio, Moneda, SalonDetalle } from '../../tipos';

export function PaginaReserva() {
  const { claveEstudio } = useParams<{ claveEstudio: string }>();
  const { cerrarSesion, rol } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const navegar = useNavigate();
  const flujo = usarFlujoReserva();
  const [estudio, setEstudio] = useState<Estudio | null>(null);
  const [estudioActivo, setEstudioActivo] = useState<Estudio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [clienteVinculado, setClienteVinculado] = useState<ClienteReservaVinculado | null>(null);

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

  const sucursalActiva = estudioActivo.name ?? 'Main location';
  const moneda: Moneda = estudioActivo.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaStr = obtenerFechaLocalISO(flujo.fechaSeleccionada);
  const productosPublicos = estudioActivo.productos ?? [];
  const clienteListo = Boolean(clienteVinculado);

  const manejarVinculacionCliente = (cliente: ClienteReservaVinculado) => {
    setClienteVinculado(cliente);
    flujo.precargarContacto({
      nombreCliente: `${cliente.nombre} ${cliente.apellido}`.trim(),
      telefonoCliente: cliente.telefono ?? '',
      fechaNacimiento: cliente.fechaNacimiento ?? '',
      email: cliente.email,
    });
  };

  const limpiarClienteVinculado = () => {
    setClienteVinculado(null);
    flujo.reiniciar(estudioActivo.id);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {flujo.reservaExitosa && (
        <ConfirmacionReserva
          nombreCliente={flujo.nombreClienteReservado}
          descripcionRecompensa={flujo.descripcionRecompensaGanada}
          salon={estudio.name}
          especialista={flujo.resumenReservaConfirmada?.especialista ?? ''}
          servicios={flujo.resumenReservaConfirmada?.servicios ?? []}
          productos={flujo.resumenReservaConfirmada?.productos ?? []}
          duracion={flujo.resumenReservaConfirmada?.duracion ?? 0}
          total={flujo.resumenReservaConfirmada?.total ?? 0}
          fecha={flujo.resumenReservaConfirmada?.fecha ?? ''}
          hora={flujo.resumenReservaConfirmada?.hora ?? ''}
          moneda={moneda}
          onCerrar={() => {
            flujo.reiniciar(estudioActivo.id);
            void cerrarSesion();
            navegar('/iniciar-sesion');
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
              style={{ backgroundColor: estudio.colorPrimario ?? '#C6968C' }}
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

      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 pb-32 md:p-8">
        <section className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Reserva pública
              </p>
              <h2 className="mt-2 text-lg font-black text-slate-900">Reserva en este salón</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              <MapPin className="h-4 w-4 text-pink-500" /> {sucursalActiva}
            </div>
          </div>
        </section>

        <PanelIdentificacionReserva
          salonId={estudioActivo.id}
          clienteVinculado={clienteVinculado}
          onVincularCliente={manejarVinculacionCliente}
          onLimpiarCliente={limpiarClienteVinculado}
        />

        {clienteListo ? (
          <>
            <SelectorCalendario
              estudio={estudioActivo}
              fechaSeleccionada={flujo.fechaSeleccionada}
              totalDuracion={0}
              onCambiarFecha={flujo.seleccionarFecha}
              mostrarDuracion={false}
              titulo="Selecciona la fecha de tu cita"
              indicadorPaso="1"
            />

            <SelectorServicio
              estudio={estudioActivo}
              sucursalSeleccionada={sucursalActiva}
              requiereSucursal={false}
              serviciosSeleccionados={flujo.serviciosSeleccionados}
              moneda={moneda}
              onAlternar={flujo.alternarServicio}
              indicadorPaso="2"
            />

            {estudioActivo.plan === 'PRO' && productosPublicos.length > 0 ? (
              <SelectorProductosPublicos
                productos={productosPublicos}
                productosSeleccionados={flujo.productosSeleccionados}
                moneda={moneda}
                onAlternarProducto={flujo.alternarProducto}
                onActualizarCantidad={flujo.actualizarCantidadProducto}
              />
            ) : null}
          </>
        ) : (
          <section className="rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-600">
            Primero identifica al cliente o crea su cuenta para habilitar el calendario y el resto
            del flujo de reserva.
          </section>
        )}

        {clienteListo && flujo.serviciosSeleccionados.length > 0 && totalDuracion > 0 && (
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
        {clienteListo && flujo.horaSeleccionada && flujo.personalSeleccionado && (
          <FormularioContacto
            estudio={estudioActivo}
            flujo={flujo}
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
    plan: salon.plan,
    branches: [salon.nombre],
    assignedKey: '',
    clientKey: claveSalon,
    subscriptionStart: '',
    paidUntil: '',
    holidays: salon.festivos,
    schedule: salon.horario,
    selectedServices: salon.servicios,
    productos: salon.productos,
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
      commissionBasePercentage: 0,
      serviceCommissionPercentages: {},
    })),
    colorPrimario: salon.colorPrimario,
    logoUrl: salon.logoUrl,
    descripcion: salon.descripcion,
    direccion: salon.direccion,
    emailContacto: salon.emailContacto,
    metodosPagoReserva: salon.metodosPagoReserva,
    createdAt: '',
    updatedAt: '',
    estudioPrincipalId: salon.estudioPrincipalId ?? null,
    esSede: Boolean(salon.estudioPrincipalId),
    permiteReservasPublicas: salon.permiteReservasPublicas ?? true,
    sedes: [],
  };
}
