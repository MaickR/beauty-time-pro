import { Mail, MessageCircle, Phone, Clock } from 'lucide-react';
import type { Estudio } from '../../../tipos';

const DATOS_CONTACTO = {
  email: 'soporte@beautytimepro.com',
  whatsappMx: '+52 55 1234 5678',
  whatsappCo: '+57 300 123 4567',
  horario: 'México y Colombia: 11:00 a. m. a 4:00 p. m. (hora local)',
};

interface PropsSeccionContacto {
  estudio: Estudio;
}

function obtenerPrimerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? 'Hola';
}

export function SeccionContacto({ estudio }: PropsSeccionContacto) {
  const numeroWhatsapp =
    estudio.country === 'Colombia' ? DATOS_CONTACTO.whatsappCo : DATOS_CONTACTO.whatsappMx;
  const mensajeWhatsapp = encodeURIComponent(
    `Hola, soy ${obtenerPrimerNombre(estudio.owner || estudio.name)} administrador de ${estudio.name} y necesito soporte con mi salón en Beauty Time Pro.`,
  );

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black italic uppercase tracking-tighter">Soporte</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-pink-100 p-3 text-pink-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Email
              </p>
              <a
                href={`mailto:${DATOS_CONTACTO.email}`}
                className="text-sm font-bold text-slate-900 hover:text-pink-600 transition-colors"
              >
                {DATOS_CONTACTO.email}
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Para soporte técnico, cobros, accesos o consultas generales. Respondemos en horario de
            atención.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-green-100 p-3 text-green-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                WhatsApp
              </p>
              <a
                href={`https://wa.me/${numeroWhatsapp.replace(/\D/g, '')}?text=${mensajeWhatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-slate-900 hover:text-green-600 transition-colors"
              >
                {numeroWhatsapp}
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Abre WhatsApp con un mensaje listo y contextualizado con el nombre del salón.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Horario de soporte
              </p>
              <p className="text-sm font-bold text-slate-900">{DATOS_CONTACTO.horario}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Si escribes fuera de horario, responderemos el siguiente día hábil.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Casos prioritarios
              </p>
              <p className="text-sm font-bold text-slate-900">Facturación y acceso</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Si hay bloqueo de acceso o un problema de facturación, escribe por correo indicando el
            nombre del salón para priorizar el caso.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">
          Preguntas frecuentes
        </h3>
        <ul className="space-y-3 text-sm text-slate-600">
          <li>
            <p className="font-bold text-slate-800">¿Cómo cambio el plan de mi salón?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Escríbenos por correo o WhatsApp y te guiaremos con la mejora o ajuste del plan.
            </p>
          </li>
          <li>
            <p className="font-bold text-slate-800">¿Puedo agregar más especialistas?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Sí. Desde la pestaña "Mi equipo" puedes crear, editar, activar o desactivar
              especialistas.
            </p>
          </li>
          <li>
            <p className="font-bold text-slate-800">¿Cómo actualizo la información del salón?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              En "Mi salón" puedes actualizar logo, dirección, descripción, horarios y datos
              públicos.
            </p>
          </li>
          <li>
            <p className="font-bold text-slate-800">¿Qué pasa si mi suscripción vence?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              El sistema restringe la operación del salón hasta que el pago quede regularizado.
            </p>
          </li>
          <li>
            <p className="font-bold text-slate-800">¿Puedo compartir mi link de reservas?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Sí. El link del salón está pensado para compartirlo por WhatsApp, redes o campañas.
            </p>
          </li>
          <li>
            <p className="font-bold text-slate-800">¿Cómo gestiono promociones o fidelidad?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Desde "Beneficios" puedes configurar recompensas y mensajes comerciales según tu plan.
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}
