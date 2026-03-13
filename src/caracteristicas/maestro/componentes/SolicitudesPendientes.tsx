import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { CheckCircle, XCircle, Clock, MapPin, Phone, Users, Tag } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import {
  obtenerSolicitudesPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
} from '../../../servicios/servicioAdmin';
import type { SolicitudSalon } from '../../../tipos';
import 'react-day-picker/style.css';

interface PropsModalAprobacion {
  solicitud: SolicitudSalon;
  onCerrar: () => void;
  onConfirmar: (fechaVencimiento: string) => void;
  cargando: boolean;
}

function ModalAprobacion({ solicitud, onCerrar, onConfirmar, cargando }: PropsModalAprobacion) {
  const hoy = new Date();
  const porDefecto = addDays(hoy, 30);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(porDefecto);

  const confirmar = () => {
    onConfirmar(format(fechaSeleccionada, 'yyyy-MM-dd'));
  };

  return (
    <div
      role="dialog"
      aria-labelledby="titulo-aprobacion"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-8">
        <h2 id="titulo-aprobacion" className="text-2xl font-black text-slate-900 mb-1">
          Aprobar salón
        </h2>
        <p className="text-slate-500 text-sm mb-6">{solicitud.nombre}</p>

        <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-1 text-sm">
          <p>
            <span className="font-semibold text-slate-700">Admin:</span>{' '}
            <span className="text-slate-600">
              {solicitud.dueno?.nombre} · {solicitud.dueno?.email}
            </span>
          </p>
          <p>
            <span className="font-semibold text-slate-700">Dirección:</span>{' '}
            <span className="text-slate-600">{solicitud.direccion ?? '—'}</span>
          </p>
        </div>

        <p className="text-sm font-semibold text-slate-700 mb-3">
          Fecha de vencimiento de suscripción
        </p>
        <div className="flex justify-center mb-5">
          <DayPicker
            mode="single"
            selected={fechaSeleccionada}
            defaultMonth={porDefecto}
            onSelect={(d) => d && setFechaSeleccionada(d)}
            disabled={{ before: addDays(hoy, 1) }}
            locale={es}
          />
        </div>
        <p className="text-xs text-center text-slate-400 mb-6">
          Seleccionado:{' '}
          <strong>{format(fechaSeleccionada, "d 'de' MMMM yyyy", { locale: es })}</strong>
        </p>
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Si necesitas alinear el corte con otra fecha, puedes aprobar con un periodo inicial corto,
          incluso de 5 días.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCerrar}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={cargando}
            className="flex-1 py-3 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {cargando ? 'Aprobando…' : 'Aprobar salón'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PropsModalRechazo {
  solicitud: SolicitudSalon;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => void;
  cargando: boolean;
}

function ModalRechazo({ solicitud, onCerrar, onConfirmar, cargando }: PropsModalRechazo) {
  const [motivo, setMotivo] = useState('');
  const errorMotivo = motivo.trim().length > 0 && motivo.trim().length < 10;

  return (
    <div
      role="dialog"
      aria-labelledby="titulo-rechazo"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        <h2 id="titulo-rechazo" className="text-2xl font-black text-slate-900 mb-1">
          Rechazar solicitud
        </h2>
        <p className="text-slate-500 text-sm mb-6">{solicitud.nombre}</p>

        <div className="mb-5">
          <label
            htmlFor="motivo-rechazo"
            className="block text-sm font-semibold text-slate-700 mb-2"
          >
            Motivo del rechazo
          </label>
          <textarea
            id="motivo-rechazo"
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explica por qué se rechaza esta solicitud…"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
            aria-describedby="ayuda-motivo"
          />
          {errorMotivo && (
            <p role="alert" className="mt-1 text-xs text-red-500">
              Mínimo 10 caracteres
            </p>
          )}
          <p id="ayuda-motivo" className="mt-2 text-xs text-slate-400">
            Este motivo le llegará al salón por email para que pueda corregir su solicitud.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCerrar}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(motivo)}
            disabled={cargando || motivo.trim().length < 10}
            className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {cargando ? 'Rechazando…' : 'Rechazar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PropsSolicitudesPendientes {
  onCambio?: () => void;
}

export function SolicitudesPendientes({ onCambio }: PropsSolicitudesPendientes) {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [idAprobar, setIdAprobar] = useState<string | null>(null);
  const [idRechazar, setIdRechazar] = useState<string | null>(null);

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes-pendientes'],
    queryFn: obtenerSolicitudesPendientes,
    staleTime: 30 * 1000,
  });

  const mutAprobar = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha: string }) => aprobarSolicitud(id, fecha),
    onSuccess: () => {
      setIdAprobar(null);
      mostrarToast({ mensaje: 'Salón aprobado correctamente', variante: 'exito' });
      void clienteConsulta.invalidateQueries({ queryKey: ['solicitudes-pendientes'] });
      void clienteConsulta.invalidateQueries({ queryKey: ['historial-salones'] });
      void clienteConsulta.invalidateQueries({ queryKey: ['admin', 'metricas'] });
      onCambio?.();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  const mutRechazar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => rechazarSolicitud(id, motivo),
    onSuccess: () => {
      setIdRechazar(null);
      mostrarToast({ mensaje: 'Solicitud rechazada', variante: 'info' });
      void clienteConsulta.invalidateQueries({ queryKey: ['solicitudes-pendientes'] });
      void clienteConsulta.invalidateQueries({ queryKey: ['historial-salones'] });
      void clienteConsulta.invalidateQueries({ queryKey: ['admin', 'metricas'] });
      onCambio?.();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  const solicitudAprobar = solicitudes.find((s) => s.id === idAprobar) ?? null;
  const solicitudRechazar = solicitudes.find((s) => s.id === idRechazar) ?? null;

  const badgeColor =
    solicitudes.length > 0
      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      : 'bg-slate-100 text-slate-500';

  return (
    <section aria-labelledby="titulo-solicitudes">
      <div className="flex items-center gap-3 mb-6">
        <h2 id="titulo-solicitudes" className="text-2xl font-black text-slate-900">
          Solicitudes pendientes
        </h2>
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${badgeColor}`}>
          {isLoading ? '…' : solicitudes.length}
        </span>
      </div>

      {isLoading && (
        <div aria-busy="true" className="flex justify-center py-10">
          <span className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && solicitudes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center bg-white rounded-3xl border border-slate-100">
          <CheckCircle className="w-14 h-14 text-green-400 mb-4" aria-hidden="true" />
          <p className="font-bold text-slate-700 text-lg">¡Todo al día!</p>
          <p className="text-slate-400 text-sm mt-1">No hay solicitudes pendientes.</p>
        </div>
      )}

      {!isLoading && solicitudes.length > 0 && (
        <div className="space-y-4">
          {solicitudes.map((s) => (
            <TarjetaSolicitud
              key={s.id}
              solicitud={s}
              onAprobar={() => setIdAprobar(s.id)}
              onRechazar={() => setIdRechazar(s.id)}
            />
          ))}
        </div>
      )}

      {solicitudAprobar && (
        <ModalAprobacion
          solicitud={solicitudAprobar}
          onCerrar={() => setIdAprobar(null)}
          onConfirmar={(fecha) => mutAprobar.mutate({ id: solicitudAprobar.id, fecha })}
          cargando={mutAprobar.isPending}
        />
      )}

      {solicitudRechazar && (
        <ModalRechazo
          solicitud={solicitudRechazar}
          onCerrar={() => setIdRechazar(null)}
          onConfirmar={(motivo) => mutRechazar.mutate({ id: solicitudRechazar.id, motivo })}
          cargando={mutRechazar.isPending}
        />
      )}
    </section>
  );
}

interface PropsTarjetaSolicitud {
  solicitud: SolicitudSalon;
  onAprobar: () => void;
  onRechazar: () => void;
}

function TarjetaSolicitud({ solicitud, onAprobar, onRechazar }: PropsTarjetaSolicitud) {
  const categorias = solicitud.categorias
    ? solicitud.categorias
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  const dias = solicitud.diasAtencion
    ? solicitud.diasAtencion.split(',').map((d) => d.trim().slice(0, 2).toUpperCase())
    : [];

  const diasLabel = `Hace ${solicitud.diasDesdeRegistro === 0 ? 'menos de 1' : solicitud.diasDesdeRegistro} día${solicitud.diasDesdeRegistro !== 1 ? 's' : ''}`;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl shrink-0"
            style={{ backgroundColor: solicitud.colorPrimario ?? '#C2185B' }}
            aria-hidden="true"
          />
          <div>
            <h3 className="font-black text-slate-900 text-lg leading-tight">{solicitud.nombre}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {diasLabel}
            </p>
          </div>
        </div>
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {categorias.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 text-xs font-semibold flex items-center gap-1"
              >
                <Tag className="w-2.5 h-2.5" aria-hidden="true" /> {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Users className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span>
            {solicitud.dueno?.nombre ?? '—'} · {solicitud.dueno?.email ?? '—'}
          </span>
        </div>
        {solicitud.direccion && (
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span>{solicitud.direccion}</span>
          </div>
        )}
        {solicitud.telefono && (
          <div className="flex items-center gap-2 text-slate-600">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span>{solicitud.telefono}</span>
          </div>
        )}
        {solicitud.horarioApertura && solicitud.horarioCierre && (
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span>
              {solicitud.horarioApertura} – {solicitud.horarioCierre}
            </span>
          </div>
        )}
        {solicitud.numeroEspecialistas && (
          <p className="text-slate-500 text-xs col-span-2">
            {solicitud.numeroEspecialistas} especialista
            {solicitud.numeroEspecialistas !== 1 ? 's' : ''} aproximados
          </p>
        )}
        {dias.length > 0 && (
          <div className="flex gap-1 col-span-2">
            {dias.map((d) => (
              <span
                key={d}
                className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-bold"
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onRechazar}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors"
        >
          <XCircle className="w-4 h-4" aria-hidden="true" /> Rechazar
        </button>
        <button
          onClick={onAprobar}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors"
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" /> Aprobar
        </button>
      </div>
    </div>
  );
}
