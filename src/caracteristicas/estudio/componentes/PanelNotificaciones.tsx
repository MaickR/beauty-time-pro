import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  X,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  CalendarClock,
  Settings2,
} from 'lucide-react';
import type { NotificacionEstudio } from '../hooks/usarNotificacionesEstudio';

const WHATSAPP_MEXICO = '5255641341516';
const WHATSAPP_COLOMBIA = '573006934216';

interface PropsPanelNotificaciones {
  notificaciones: NotificacionEstudio[];
  pais: string;
  onMarcarLeida: (id: string) => void;
}

function obtenerIconoTipo(tipo: NotificacionEstudio['tipo']) {
  switch (tipo) {
    case 'recordatorio_pago':
      return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />;
    case 'pago_confirmado':
      return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" aria-hidden="true" />;
    case 'cambio_precio_plan':
      return <Bell className="w-5 h-5 text-sky-500 shrink-0" aria-hidden="true" />;
    case 'suspension':
      return <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" aria-hidden="true" />;
    case 'nueva_reserva':
      return <CalendarClock className="w-5 h-5 text-pink-500 shrink-0" aria-hidden="true" />;
    case 'reserva_cancelada':
      return <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" aria-hidden="true" />;
    case 'reserva_reagendada':
      return <CalendarClock className="w-5 h-5 text-cyan-500 shrink-0" aria-hidden="true" />;
    case 'actualizacion_horario':
      return <CalendarClock className="w-5 h-5 text-indigo-500 shrink-0" aria-hidden="true" />;
    case 'actualizacion_salon':
      return <Settings2 className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" />;
  }
}

function obtenerColorFondo(tipo: NotificacionEstudio['tipo']) {
  switch (tipo) {
    case 'recordatorio_pago':
      return 'bg-amber-50 border-amber-200';
    case 'pago_confirmado':
      return 'bg-green-50 border-green-200';
    case 'cambio_precio_plan':
      return 'bg-sky-50 border-sky-200';
    case 'suspension':
      return 'bg-red-50 border-red-200';
    case 'nueva_reserva':
      return 'bg-pink-50 border-pink-200';
    case 'reserva_cancelada':
      return 'bg-rose-50 border-rose-200';
    case 'reserva_reagendada':
      return 'bg-cyan-50 border-cyan-200';
    case 'actualizacion_horario':
      return 'bg-indigo-50 border-indigo-200';
    case 'actualizacion_salon':
      return 'bg-slate-50 border-slate-200';
  }
}

export function PanelNotificaciones({
  notificaciones,
  pais,
  onMarcarLeida,
}: PropsPanelNotificaciones) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const total = notificaciones.length;
  const numeroWhatsApp = pais === 'Colombia' ? WHATSAPP_COLOMBIA : WHATSAPP_MEXICO;
  const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent('Hola, necesito información sobre mi suscripción en Beauty Time Pro.')}`;

  useEffect(() => {
    if (!abierto) return;
    const manejarClickFuera = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarEscape);
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [abierto]);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-label={
          total > 0
            ? `${total} notificación${total !== 1 ? 'es' : ''} sin leer`
            : 'Notificaciones del sistema'
        }
        className="relative p-3 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors border border-amber-200"
      >
        <Bell className="w-5 h-5 text-amber-700" />
        {total > 0 ? (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        ) : null}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-black uppercase text-slate-900">Notificaciones</h3>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notificaciones.length > 0 ? (
              notificaciones.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-5 py-4 flex items-start gap-3 border-l-4 ${obtenerColorFondo(notif.tipo)}`}
                >
                  {obtenerIconoTipo(notif.tipo)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900">{notif.titulo}</p>
                    <p className="text-xs text-slate-600 mt-1">{notif.mensaje}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2">
                      {new Date(notif.creadoEn).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onMarcarLeida(notif.id)}
                    aria-label="Marcar como leída"
                    title="Marcar como leída"
                    className="p-1 hover:bg-white/80 rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-black text-slate-900">Todo al día</p>
                <p className="mt-2 text-xs text-slate-500">
                  No tienes alertas importantes nuevas por ahora. Esta campana mostrará nuevas
                  citas, cambios de horario, ajustes operativos del salón y avisos administrativos
                  relevantes.
                </p>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
            <a
              href={enlaceWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-500 px-4 py-3 text-xs font-black text-white hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
