import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import {
  obtenerSolicitudesCancelacion,
  procesarCancelacion,
} from '../../../servicios/servicioSuscripcion';
import type { SolicitudCancelacion } from '../../../tipos';

export function SolicitudesCancelacion() {
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const [idAprobar, setIdAprobar] = useState<string | null>(null);
  const [idRechazar, setIdRechazar] = useState<string | null>(null);
  const [respuestaRechazo, setRespuestaRechazo] = useState('');
  const [expandida, setExpandida] = useState<string | null>(null);

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudCancelacion[]>({
    queryKey: ['admin', 'cancelaciones'],
    queryFn: obtenerSolicitudesCancelacion,
    staleTime: 2 * 60 * 1000,
  });

  const invalidar = () => {
    void clienteConsulta.invalidateQueries({ queryKey: ['admin', 'cancelaciones'] });
    void clienteConsulta.invalidateQueries({ queryKey: ['admin', 'metricas'] });
  };

  const mutAprobar = useMutation({
    mutationFn: (id: string) => procesarCancelacion(id, 'aprobar'),
    onSuccess: () => {
      mostrarToast({
        mensaje: 'Cancelación aprobada. El salón ha sido suspendido.',
        variante: 'exito',
      });
      setIdAprobar(null);
      invalidar();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  const mutRechazar = useMutation({
    mutationFn: ({ id, respuesta }: { id: string; respuesta: string }) =>
      procesarCancelacion(id, 'rechazar', respuesta.trim() || undefined),
    onSuccess: () => {
      mostrarToast({ mensaje: 'Solicitud rechazada', variante: 'info' });
      setIdRechazar(null);
      setRespuestaRechazo('');
      invalidar();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  if (isLoading) {
    return (
      <section aria-labelledby="titulo-cancelaciones">
        <h2 id="titulo-cancelaciones" className="text-2xl font-black text-slate-900 mb-5">
          Solicitudes de cancelación
        </h2>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <EsqueletoTarjeta key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (solicitudes.length === 0) return null;

  return (
    <section aria-labelledby="titulo-cancelaciones">
      <div className="flex items-center gap-3 mb-5">
        <h2 id="titulo-cancelaciones" className="text-2xl font-black text-slate-900">
          Solicitudes de cancelación
        </h2>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-black">
          {solicitudes.length}
        </span>
      </div>

      <div className="space-y-4">
        {solicitudes.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden"
          >
            <button
              onClick={() => setExpandida(expandida === s.id ? null : s.id)}
              aria-expanded={expandida === s.id}
              aria-controls={`cancelacion-detalle-${s.id}`}
              className="w-full text-left flex items-center justify-between gap-4 p-5 hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <p className="font-black text-slate-900">{s.nombre}</p>
                  <p className="text-xs text-slate-400 font-medium">
                    Vence: {s.fechaVencimiento} &middot; Solicitado el{' '}
                    {new Date(s.fechaSolicitudCancelacion).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              {expandida === s.id ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {expandida === s.id && (
              <div
                id={`cancelacion-detalle-${s.id}`}
                className="px-5 pb-5 space-y-4 border-t border-red-100 pt-4"
              >
                {s.dueno && (
                  <p className="text-sm text-slate-600">
                    <span className="font-black">Dueño:</span> {s.dueno.nombre} ({s.dueno.email})
                  </p>
                )}
                {s.motivoCancelacion && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                      Motivo
                    </p>
                    <p className="text-sm text-slate-700">{s.motivoCancelacion}</p>
                  </div>
                )}

                {/* Panel de rechazo inline */}
                {idRechazar === s.id ? (
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <label
                      htmlFor={`respuesta-${s.id}`}
                      className="text-xs font-black text-slate-600 uppercase tracking-wider"
                    >
                      Motivo del rechazo (opcional)
                    </label>
                    <textarea
                      id={`respuesta-${s.id}`}
                      value={respuestaRechazo}
                      onChange={(e) => setRespuestaRechazo(e.target.value.slice(0, 300))}
                      rows={3}
                      placeholder="Explica por qué se rechaza la solicitud..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setIdRechazar(null);
                          setRespuestaRechazo('');
                        }}
                        className="flex-1 py-2 bg-slate-200 text-slate-600 font-black rounded-xl text-xs uppercase hover:bg-slate-300 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() =>
                          mutRechazar.mutate({ id: s.id, respuesta: respuestaRechazo })
                        }
                        disabled={mutRechazar.isPending}
                        aria-busy={mutRechazar.isPending}
                        className="flex-1 py-2 bg-slate-900 text-white font-black rounded-xl text-xs uppercase hover:bg-black transition-colors disabled:opacity-60"
                      >
                        {mutRechazar.isPending ? 'Enviando...' : 'Confirmar rechazo'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIdRechazar(s.id);
                        setRespuestaRechazo('');
                        setIdAprobar(null);
                      }}
                      className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-black rounded-2xl text-xs uppercase hover:bg-slate-200 transition-colors"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => {
                        setIdAprobar(s.id);
                        setIdRechazar(null);
                      }}
                      className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-2xl text-xs uppercase hover:bg-red-700 transition-colors"
                    >
                      Aprobar cancelación
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <DialogoConfirmacion
        abierto={idAprobar !== null}
        variante="peligro"
        mensaje="¿Aprobar cancelación?"
        descripcion="El salón será suspendido de inmediato y el dueño recibirá un correo de confirmación."
        textoConfirmar="Sí, suspender salón"
        textoCancelar="No, volver"
        cargando={mutAprobar.isPending}
        onConfirmar={() => idAprobar && mutAprobar.mutate(idAprobar)}
        onCancelar={() => setIdAprobar(null)}
      />
    </section>
  );
}
