interface PropsModalTerminos {
  abierto: boolean;
  alAceptar: () => void;
  alCerrar: () => void;
}

const SECCIONES = [
  {
    titulo: 'Objeto del servicio',
    contenido:
      'Beauty Time Pro es una plataforma digital que conecta salones de belleza con sus clientes para la gestión y reserva de citas. El servicio se ofrece bajo modalidad SaaS.',
  },
  {
    titulo: 'Registro y cuenta de usuario',
    contenido:
      'El usuario garantiza que los datos proporcionados son verídicos. El acceso es personal e intransferible. El usuario es responsable de mantener la confidencialidad de su contraseña. Solo se aceptan correos de proveedores reconocidos.',
  },
  {
    titulo: 'Uso del servicio',
    contenido:
      'Queda prohibido usar la plataforma para actividades ilegales, suplantar identidades, enviar spam o intentar acceder a cuentas ajenas. Beauty Time Pro se reserva el derecho de suspender cuentas que violen estas condiciones.',
  },
  {
    titulo: 'Privacidad y datos personales',
    contenido:
      'Los datos personales, como nombre, teléfono y fecha de nacimiento, se recopilan exclusivamente para facilitar la reserva de citas y el programa de fidelidad. No se venden ni comparten con terceros. El usuario puede solicitar la eliminación de sus datos escribiendo a soporte. Aplica la legislación de protección de datos de México (LFPDPPP) y Colombia (Ley 1581 de 2012).',
  },
  {
    titulo: 'Reservas y cancelaciones',
    contenido:
      'Las reservas están sujetas a disponibilidad del salón. El usuario puede cancelar hasta con 2 horas de anticipación desde el enlace recibido en el email de confirmación. El incumplimiento repetido puede resultar en restricciones de uso.',
  },
  {
    titulo: 'Limitación de responsabilidad',
    contenido:
      'Beauty Time Pro actúa como intermediario tecnológico. No se hace responsable por la calidad del servicio prestado por los salones, cancelaciones de último momento o disputas entre el salón y el cliente.',
  },
];

export function ModalTerminos({ abierto, alAceptar, alCerrar }: PropsModalTerminos) {
  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-terminos"
      className="fixed inset-0 z-220 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex max-h-[80vh] flex-col h-full">
          <div className="flex items-start justify-between gap-4 border-b p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-pink-600">
                Condiciones de uso
              </p>
              <h2 id="titulo-terminos" className="mt-1 text-xl font-bold text-slate-900">
                Términos y condiciones
              </h2>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
              aria-label="Cerrar términos y condiciones"
            >
              Cerrar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {SECCIONES.map((seccion, indice) => (
              <section
                key={seccion.titulo}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-600 text-sm font-black text-white">
                    {indice + 1}
                  </span>
                  <h3 className="text-lg font-black text-slate-900">{seccion.titulo}</h3>
                </div>
                <p className="text-sm leading-6 text-slate-600">{seccion.contenido}</p>
              </section>
            ))}
          </div>
          <div className="shrink-0 border-t bg-white p-4">
            <button
              type="button"
              onClick={alAceptar}
              className="w-full rounded-lg bg-pink-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-pink-700"
            >
              He leído y acepto los términos y condiciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
