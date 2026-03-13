interface PropsModalPrivacidad {
  abierto: boolean;
  alAceptar: () => void;
  alCerrar: () => void;
}

const SECCIONES_PRIVACIDAD = [
  {
    titulo: '1. Responsable del tratamiento',
    contenido:
      'Beauty Time Pro es responsable del tratamiento de los datos personales recabados a través de la plataforma para operar reservas, autenticación, fidelidad y atención a usuarios en México, Colombia y otros mercados donde el servicio esté disponible.',
  },
  {
    titulo: '2. Datos que recopilamos',
    contenido:
      'Podemos recopilar nombre, apellido, correo electrónico, teléfono, fecha de nacimiento, historial de reservas, datos del salón y preferencias básicas de uso. Nunca solicitamos información bancaria sensible en el frontend.',
  },
  {
    titulo: '3. Finalidades del tratamiento',
    contenido:
      'Usamos tus datos para crear tu cuenta, verificar identidad, gestionar citas, enviar recordatorios, administrar programas de fidelidad, resolver incidencias y cumplir obligaciones legales o contractuales del servicio.',
  },
  {
    titulo: '4. Base legal y consentimiento',
    contenido:
      'El tratamiento se basa en tu consentimiento, en la ejecución de la relación contractual con la plataforma y, cuando aplique, en el cumplimiento de obligaciones legales. Al registrarte, autorizas el tratamiento conforme a esta política.',
  },
  {
    titulo: '5. Menores de edad',
    contenido:
      'La plataforma está dirigida a personas de 13 años o más. Si eres menor de edad, debes contar con acompañamiento y supervisión de un adulto responsable durante tu interacción con el salón y con la plataforma.',
  },
  {
    titulo: '6. Compartición con salones y proveedores',
    contenido:
      'Compartimos únicamente la información necesaria con el salón seleccionado y con proveedores tecnológicos que nos ayudan a operar correo, infraestructura y seguridad. No vendemos datos personales a terceros.',
  },
  {
    titulo: '7. Seguridad y conservación',
    contenido:
      'Aplicamos medidas razonables de seguridad administrativas, técnicas y organizativas para proteger la información. Conservamos los datos solo durante el tiempo necesario para prestar el servicio, atender obligaciones legales y resolver disputas.',
  },
  {
    titulo: '8. Derechos de las personas usuarias',
    contenido:
      'Puedes solicitar acceso, rectificación, actualización, cancelación, oposición o eliminación de tus datos, según la legislación aplicable. Para México se contemplan derechos ARCO y para Colombia los derechos de consulta y reclamo previstos por la Ley 1581 de 2012.',
  },
  {
    titulo: '9. Transferencias y uso internacional',
    contenido:
      'Si operamos o almacenamos datos fuera de tu país, procuraremos aplicar salvaguardas contractuales y técnicas adecuadas para mantener un nivel razonable de protección conforme al contexto internacional del servicio.',
  },
  {
    titulo: '10. Contacto y cambios a esta política',
    contenido:
      'Si tienes dudas o deseas ejercer tus derechos, puedes contactarnos a través de los canales oficiales de soporte. Beauty Time Pro podrá actualizar esta política cuando cambie el servicio o la normativa aplicable, informándolo por medios razonables.',
  },
];

export function ModalPrivacidad({ abierto, alAceptar, alCerrar }: PropsModalPrivacidad) {
  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-privacidad"
      className="fixed inset-0 z-221 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex max-h-[80vh] h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-pink-600">
                Privacidad y datos
              </p>
              <h2 id="titulo-privacidad" className="mt-1 text-xl font-bold text-slate-900">
                Política de privacidad
              </h2>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
              aria-label="Cerrar política de privacidad"
            >
              Cerrar
            </button>
          </div>
          <div className="border-b border-yellow-200 bg-yellow-100 px-6 py-3 text-sm font-bold text-yellow-900">
            ⚠️ Este documento está en revisión legal. Versión preliminar sujeta a cambios — Marzo
            2026
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {SECCIONES_PRIVACIDAD.map((seccion) => (
              <section
                key={seccion.titulo}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
              >
                <h3 className="text-lg font-black text-slate-900">{seccion.titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{seccion.contenido}</p>
              </section>
            ))}
          </div>
          <div className="shrink-0 border-t bg-white p-4">
            <button
              type="button"
              onClick={alAceptar}
              className="w-full rounded-lg bg-pink-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-pink-700"
            >
              He leído y acepto la política de privacidad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
