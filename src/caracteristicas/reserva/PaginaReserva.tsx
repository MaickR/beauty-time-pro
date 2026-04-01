import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
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
import { obtenerSalonPublicoPorClave } from '../../servicios/servicioClienteApp';
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
  const { cerrarSesion } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const navegar = useNavigate();
  const flujo = usarFlujoReserva();
  const [estudio, setEstudio] = useState<Estudio | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!claveEstudio) {
      setEstudio(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    void obtenerSalonPublicoPorClave(claveEstudio)
      .then((salon) => {
        if (cancelado) return;
        const claveNormalizada = claveEstudio.trim().toUpperCase();
        setEstudio(mapearSalonDetalleAEstudio(salon, claveNormalizada));
        sessionStorage.setItem('btp_reserva_estudio_id', salon.id);
        sessionStorage.setItem('btp_reserva_estudio_nombre', salon.nombre);
        sessionStorage.setItem('btp_reserva_estudio_clave', claveNormalizada);
        usarTiendaAuth.setState({
          estudioActual: salon.id,
          claveClienteActual: claveNormalizada,
        });
      })
      .catch(() => {
        if (!cancelado) {
          setEstudio(null);
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
    if (estudio?.branches.length && !flujo.sucursalSeleccionada) {
      flujo.seleccionarSucursal(estudio.branches[0]);
    }
  }, [estudio?.id]);

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
  if (!estudio)
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400 font-bold">Studio no encontrado o clave inválida.</p>
      </div>
    );

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
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
          onCerrar={flujo.reiniciar}
        />
      )}

      <header className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-md z-50 shadow-sm">
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
            >
              {estudio.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none">
              {estudio.name}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Reserva de Citas en Línea
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            await cerrarSesion();
            navegar('/iniciar-sesion');
          }}
          aria-label="Cerrar sesión"
          className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400"
        >
          <LogOut />
        </button>
      </header>

      {(estudio.descripcion || estudio.direccion) && (
        <div className="bg-slate-50 border-b border-slate-100 px-6 md:px-8 py-4">
          <div className="max-w-4xl mx-auto space-y-1">
            {estudio.descripcion && <p className="text-sm text-slate-600">{estudio.descripcion}</p>}
            {estudio.direccion && <p className="text-xs text-slate-400">📍 {estudio.direccion}</p>}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8 pb-32">
        {/* Paso 1: Servicios */}
        <SelectorServicio
          estudio={estudio}
          serviciosSeleccionados={flujo.serviciosSeleccionados}
          moneda={moneda}
          onAlternar={flujo.alternarServicio}
        />

        {/* Paso 2: Calendario — solo cuando hay servicios seleccionados */}
        {flujo.serviciosSeleccionados.length > 0 && (
          <SelectorCalendario
            estudio={estudio}
            fechaSeleccionada={flujo.fechaSeleccionada}
            totalDuracion={totalDuracion}
            onCambiarFecha={flujo.seleccionarFecha}
          />
        )}

        {/* Paso 3: Especialistas disponibles para el día elegido */}
        {flujo.serviciosSeleccionados.length > 0 && totalDuracion > 0 && (
          <SelectorEspecialistaHorario
            salonId={estudio.id}
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
            estudio={estudio}
            flujo={flujo}
            requiereColor={requiereColor}
            onEnviar={(datos) => flujo.enviarReserva(estudio, mostrarToast, datos)}
          />
        )}
      </main>
    </div>
  );
}

function mapearSalonDetalleAEstudio(salon: SalonDetalle, claveSalon: string): Estudio {
  return {
    id: salon.id,
    slug: '',
    name: salon.nombre,
    owner: '',
    phone: salon.telefono,
    country: salon.pais,
    plan: 'STANDARD',
    branches: ['Principal'],
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
  };
}
