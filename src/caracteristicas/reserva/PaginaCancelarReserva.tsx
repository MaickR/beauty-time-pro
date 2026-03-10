import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarX2, CheckCircle2 } from 'lucide-react';
import { Spinner } from '../../componentes/ui/Spinner';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { cancelarReservaPorToken, obtenerReservaCancelable } from '../../servicios/servicioReservas';

function obtenerNombreServicio(servicio: { name?: string } | string): string {
  if (typeof servicio === 'string') return servicio;
  return servicio.name ?? 'Servicio';
}

export function PaginaCancelarReserva() {
  usarTituloPagina('Cancelar reserva');
  const { reservaId, token } = useParams<{ reservaId: string; token: string }>();
  const [cancelada, setCancelada] = useState(false);

  const consulta = useQuery({
    queryKey: ['reserva-cancelable', token],
    enabled: Boolean(token),
    queryFn: () => obtenerReservaCancelable(token!),
  });

  const mutacion = useMutation({
    mutationFn: () => cancelarReservaPorToken(token!),
    onSuccess: () => setCancelada(true),
  });

  if (!token) {
    return <EstadoError mensaje="El enlace de cancelación es inválido." />;
  }

  if (consulta.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Spinner tamaño="lg" /></div>;
  }

  if (consulta.isError || !consulta.data || consulta.data.id !== reservaId) {
    return <EstadoError mensaje="No pudimos encontrar la cita. El enlace puede haber expirado o ser inválido." />;
  }

  if (cancelada) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-4xl p-8 text-center shadow-sm">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Tu cita fue cancelada</h1>
          <p className="text-slate-500">La cancelación se registró correctamente. Si deseas reagendar, contacta al salón o vuelve a reservar desde su enlace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white border border-slate-200 rounded-4xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6 text-rose-600">
          <CalendarX2 className="w-8 h-8" />
          <h1 className="text-2xl font-black text-slate-900">Cancelar mi cita</h1>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2 mb-6">
          <p className="text-sm"><strong>Salón:</strong> {consulta.data.salon}</p>
          <p className="text-sm"><strong>Especialista:</strong> {consulta.data.especialista}</p>
          <p className="text-sm"><strong>Fecha:</strong> {consulta.data.fecha}</p>
          <p className="text-sm"><strong>Hora:</strong> {consulta.data.horaInicio}</p>
          <p className="text-sm"><strong>Servicio(s):</strong> {consulta.data.servicios.map(obtenerNombreServicio).join(', ')}</p>
        </div>

        {mutacion.isError && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
            {mutacion.error instanceof Error ? mutacion.error.message : 'No fue posible cancelar la cita.'}
          </div>
        )}

        <button
          type="button"
          onClick={() => mutacion.mutate()}
          disabled={mutacion.isPending}
          className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest disabled:opacity-60"
        >
          {mutacion.isPending ? 'Cancelando...' : 'Sí, cancelar mi cita'}
        </button>

        <div className="text-center mt-4">
          <Link to="/iniciar-sesion" className="text-sm text-slate-400 hover:text-slate-600">Volver</Link>
        </div>
      </div>
    </div>
  );
}

function EstadoError({ mensaje }: { mensaje: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-4xl p-8 text-center shadow-sm">
        <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-slate-900 mb-2">No es posible cancelar esta cita</h1>
        <p className="text-slate-500">{mensaje}</p>
      </div>
    </div>
  );
}