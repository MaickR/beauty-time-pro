import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { usarTemaSalon } from '../../hooks/usarTemaSalon';
import { obtenerFechaLocalISO } from '../../utils/formato';
import { obtenerSlotsDisponibles } from '../../utils/programacion';
import { DIAS_SEMANA } from '../../lib/constantes';
import { usarFlujoReserva } from './hooks/usarFlujoReserva';
import { SelectorPersonal } from './componentes/SelectorPersonal';
import { SelectorServicio } from './componentes/SelectorServicio';
import { SelectorCalendario } from './componentes/SelectorCalendario';
import { GrillaSlots } from './componentes/GrillaSlots';
import { FormularioContacto } from './componentes/FormularioContacto';
import { ConfirmacionReserva } from './componentes/ConfirmacionReserva';
import { Spinner } from '../../componentes/ui/Spinner';
import { URL_BASE } from '../../lib/clienteHTTP';
import type { Moneda } from '../../tipos';

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
  const { claveCliente } = useParams<{ claveCliente: string }>();
  const { estudios, reservas, cargando } = usarContextoApp();
  const { cerrarSesion } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const flujo = usarFlujoReserva();

  const estudio = estudios.find((s) => s.clientKey === claveCliente);

  // Aplicar tema del salón en la página pública
  usarTemaSalon(estudio?.colorPrimario);

  // Actualizar título con el nombre del salón
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
  }, [estudio?.id]); // intencionalmente limitado: solo al cambio de studio

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
  const reservasEstudio = reservas.filter((r) => r.studioId === estudio.id);
  const totalDuracion = flujo.serviciosSeleccionados.reduce((acc, s) => acc + s.duration, 0);
  const requiereColor = flujo.serviciosSeleccionados.some((s) =>
    PALABRAS_COLOR.some((kw) => s.name.toLowerCase().includes(kw)),
  );

  const fechaStr = obtenerFechaLocalISO(flujo.fechaSeleccionada);
  const nombreDia = DIAS_SEMANA[flujo.fechaSeleccionada.getDay()];
  const horarioDia = estudio.schedule[nombreDia];
  const esFestivo = !!estudio.holidays?.includes(fechaStr);
  const estaCerrado = !horarioDia?.isOpen;

  const slots = (() => {
    if (
      !flujo.personalSeleccionado ||
      flujo.serviciosSeleccionados.length === 0 ||
      esFestivo ||
      estaCerrado
    )
      return [];
    const miembro = estudio.staff.find((s) => s.id === flujo.personalSeleccionado);
    const reservasDia = reservasEstudio.filter(
      (b) =>
        b.staffId === flujo.personalSeleccionado && b.date === fechaStr && b.status !== 'cancelled',
    );
    return obtenerSlotsDisponibles({
      horarioDia,
      miembro: miembro ?? { shiftStart: null, shiftEnd: null, breakStart: null, breakEnd: null },
      reservasExistentes: reservasDia,
      duracionSlot: totalDuracion,
      fechaStr,
      filtrarPasados: true,
      filtrarDemasiadoCortos: true,
    });
  })();

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
          onClick={cerrarSesion}
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
        <SelectorPersonal
          estudio={estudio}
          personalSeleccionado={flujo.personalSeleccionado}
          onSeleccionar={flujo.seleccionarPersonal}
        />

        {flujo.personalSeleccionado && (
          <SelectorServicio
            estudio={estudio}
            personalSeleccionado={flujo.personalSeleccionado}
            serviciosSeleccionados={flujo.serviciosSeleccionados}
            moneda={moneda}
            onAlternar={flujo.alternarServicio}
          />
        )}

        {flujo.serviciosSeleccionados.length > 0 && (
          <>
            <SelectorCalendario
              estudio={estudio}
              fechaSeleccionada={flujo.fechaSeleccionada}
              totalDuracion={totalDuracion}
              onCambiarFecha={flujo.seleccionarFecha}
            />
            <GrillaSlots
              slots={slots}
              horaSeleccionada={flujo.horaSeleccionada}
              esFestivo={esFestivo}
              estaCerrado={estaCerrado}
              nombreDia={nombreDia}
              totalDuracion={totalDuracion}
              onSeleccionar={flujo.seleccionarHora}
            />
          </>
        )}

        {flujo.horaSeleccionada && (
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
