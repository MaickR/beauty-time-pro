import { useEffect, useRef } from 'react';
import { Sparkles, CalendarDays, Users, Settings, CheckCircle2 } from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

interface PropsModalBienvenidaSalon {
  nombreSalon: string;
  estudioId: string;
  onCerrar: () => void;
}

const PASOS = [
  {
    icono: <Settings className="w-5 h-5 text-pink-600" aria-hidden="true" />,
    titulo: 'Configura tu perfil',
    descripcion: 'Agrega logo, descripción, dirección y horario de atención.',
  },
  {
    icono: <Users className="w-5 h-5 text-pink-600" aria-hidden="true" />,
    titulo: 'Añade a tu equipo',
    descripcion: 'Registra tu personal y asígnales los servicios que ofrecen.',
  },
  {
    icono: <CalendarDays className="w-5 h-5 text-pink-600" aria-hidden="true" />,
    titulo: 'Gestiona tu agenda',
    descripcion: 'Revisa citas, bloquea festivos y administra disponibilidad.',
  },
  {
    icono: <Sparkles className="w-5 h-5 text-pink-600" aria-hidden="true" />,
    titulo: 'Recibe clientes',
    descripcion: 'Comparte tu enlace de reservas y empieza a recibir citas.',
  },
];

export function ModalBienvenidaSalon({
  nombreSalon,
  estudioId,
  onCerrar,
}: PropsModalBienvenidaSalon) {
  const { mostrarToast } = usarToast();
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', manejarEscape);
    botonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [estudioId, onCerrar]);

  const handleEmpezar = async () => {
    try {
      await peticion(`/estudios/${estudioId}`, {
        method: 'PUT',
        body: JSON.stringify({ primeraVez: false }),
      });
    } catch {
      // No bloqueamos al usuario si falla — es solo una marca de conveniencia
    }
    mostrarToast({
      mensaje: `¡Bienvenido a ${nombreSalon}! Todo listo para comenzar.`,
      variante: 'exito',
    });
    onCerrar();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-bienvenida"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-fade-in">
        {/* Cabecera */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-pink-100 p-4 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-pink-600" aria-hidden="true" />
          </div>
          <h2 id="titulo-bienvenida" className="text-2xl font-black text-slate-900">
            ¡Bienvenido, <span className="text-pink-600">{nombreSalon}</span>!
          </h2>
          <p className="text-slate-500 font-medium mt-2 text-sm">
            Tu solicitud fue aprobada. Aquí tienes los primeros pasos para comenzar.
          </p>
        </div>

        {/* Pasos */}
        <ol className="space-y-4 mb-8" aria-label="Primeros pasos">
          {PASOS.map((paso, i) => (
            <li key={i} className="flex items-start gap-4">
              <div className="bg-pink-50 p-2 rounded-xl shrink-0">{paso.icono}</div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{paso.titulo}</p>
                <p className="text-slate-500 text-xs mt-0.5">{paso.descripcion}</p>
              </div>
              <CheckCircle2
                className="w-4 h-4 text-slate-200 mt-1 shrink-0 ml-auto"
                aria-hidden="true"
              />
            </li>
          ))}
        </ol>

        {/* Acción */}
        <button
          ref={botonRef}
          onClick={() => void handleEmpezar()}
          className="w-full bg-pink-600 text-white py-4 rounded-2xl font-black text-base hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200"
        >
          ¡Empezar ahora!
        </button>
      </div>
    </div>
  );
}
