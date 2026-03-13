import { useState } from 'react';
import { ShieldCheck, ShieldOff, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  obtenerAccesoPersonal,
  actualizarAccesoEmpleado,
  eliminarAccesoEmpleado,
  crearAccesoEmpleado,
} from '../../../servicios/servicioEmpleados';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { ModalCrearAccesoEmpleado } from './ModalCrearAccesoEmpleado';

interface PropsSeccionAccesoEmpleado {
  estudioId: string;
  personalId: string;
  nombreEmpleado: string;
}

function generarContrasenaSegura(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let c = '';
  for (let i = 0; i < 12; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function SeccionAccesoEmpleado({
  estudioId,
  personalId,
  nombreEmpleado,
}: PropsSeccionAccesoEmpleado) {
  const [expandido, setExpandido] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const { mostrarToast } = usarToast();
  const queryClient = useQueryClient();

  const { data: acceso, isLoading } = useQuery({
    queryKey: ['acceso-empleado', personalId],
    queryFn: () => obtenerAccesoPersonal(estudioId, personalId),
    enabled: expandido,
    staleTime: 1000 * 60,
  });

  const { mutate: toggleActivo, isPending: toggling } = useMutation({
    mutationFn: (activo: boolean) => actualizarAccesoEmpleado(estudioId, personalId, activo),
    onSuccess: (datos) => {
      void queryClient.invalidateQueries({ queryKey: ['acceso-empleado', personalId] });
      mostrarToast(datos.activo ? 'Acceso activado' : 'Acceso desactivado');
    },
    onError: (error: Error) =>
      mostrarToast({ mensaje: error.message ?? 'Error al actualizar', variante: 'error' }),
  });

  const { mutate: revocar, isPending: revocando } = useMutation({
    mutationFn: () => eliminarAccesoEmpleado(estudioId, personalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['acceso-empleado', personalId] });
      setConfirmarBorrar(false);
      mostrarToast('Acceso revocado correctamente');
    },
    onError: (error: Error) =>
      mostrarToast({ mensaje: error.message ?? 'Error al revocar', variante: 'error' }),
  });

  const { mutate: resetearContrasena, isPending: reseteando } = useMutation({
    mutationFn: () => {
      if (!acceso?.email) throw new Error('Sin email');
      const nuevaContrasena = generarContrasenaSegura();
      return crearAccesoEmpleado(estudioId, personalId, {
        email: acceso.email,
        contrasena: nuevaContrasena,
        forzarCambioContrasena: true,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['acceso-empleado', personalId] });
      mostrarToast('Nueva contraseña enviada por email al empleado');
    },
    onError: (error: Error) =>
      mostrarToast({ mensaje: error.message ?? 'Error al resetear', variante: 'error' }),
  });

  const formateoFecha = (iso: string | null) => {
    if (!iso) return 'Nunca';
    return new Date(iso).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between mt-3 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-widest"
        aria-expanded={expandido}
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          Acceso al sistema
        </span>
        {expandido ? (
          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        )}
      </button>

      {expandido && (
        <div className="mt-2 px-3 pb-3 space-y-3">
          {isLoading && (
            <p className="text-xs text-slate-400 italic" aria-busy="true">
              Cargando…
            </p>
          )}

          {!isLoading && !acceso && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Sin acceso configurado</p>
              <button
                type="button"
                onClick={() => setModalAbierto(true)}
                className="px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 transition-colors"
              >
                Dar acceso al sistema
              </button>
            </div>
          )}

          {!isLoading && acceso && (
            <>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${acceso.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                >
                  {acceso.activo ? (
                    <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <ShieldOff className="w-3 h-3" aria-hidden="true" />
                  )}
                  {acceso.activo ? 'Con acceso' : 'Desactivado'}
                </span>
                <span className="text-xs text-slate-500 truncate">{acceso.email}</span>
              </div>

              <p className="text-[10px] text-slate-400">
                Último acceso: {formateoFecha(acceso.ultimoAcceso)}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleActivo(!acceso.activo)}
                  disabled={toggling}
                  aria-busy={toggling}
                  aria-label={
                    acceso.activo ? 'Desactivar acceso del empleado' : 'Activar acceso del empleado'
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${acceso.activo ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'} disabled:opacity-50`}
                >
                  {acceso.activo ? 'Desactivar' : 'Activar'}
                </button>

                <button
                  type="button"
                  onClick={() => resetearContrasena()}
                  disabled={reseteando}
                  aria-busy={reseteando}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  {reseteando ? 'Enviando…' : 'Resetear contraseña'}
                </button>

                {!confirmarBorrar ? (
                  <button
                    type="button"
                    onClick={() => setConfirmarBorrar(true)}
                    aria-label="Revocar acceso del empleado"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" /> Revocar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-bold">¿Confirmar?</span>
                    <button
                      type="button"
                      onClick={() => revocar()}
                      disabled={revocando}
                      aria-busy={revocando}
                      className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarBorrar(false)}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <ModalCrearAccesoEmpleado
        estudioId={estudioId}
        personalId={personalId}
        nombreEmpleado={nombreEmpleado}
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
      />
    </>
  );
}
