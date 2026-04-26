import {
  MENSAJE_CONTRASENA_CLIENTE,
  obtenerFortalezaContrasenaCliente,
  obtenerRequisitosContrasenaCliente,
} from '../../lib/registroCliente';

interface PropsMedidorContrasena {
  contrasena: string;
}

export function MedidorContrasena({ contrasena }: PropsMedidorContrasena) {
  const fortaleza = obtenerFortalezaContrasenaCliente(contrasena);
  const requisitos = obtenerRequisitosContrasenaCliente(contrasena);
  const progreso = Math.max(1, fortaleza.nivel);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-600">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-900">Reglas de la contraseña</p>
        <span className={`text-xs font-black uppercase ${fortaleza.texto}`}>
          {fortaleza.etiqueta}
        </span>
      </div>
      <p className="mt-1 leading-6">
        {MENSAJE_CONTRASENA_CLIENTE}. Longitud actual: {contrasena.length}.
      </p>
      <div className="mt-3 grid grid-cols-5 gap-2" aria-hidden="true">
        {Array.from({ length: 5 }, (_, indice) => (
          <span
            key={indice}
            className={`h-2 rounded-full ${indice < progreso ? fortaleza.color : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-1 text-xs font-medium text-slate-600 sm:grid-cols-2">
        <p className={requisitos.longitudMinima ? 'text-emerald-700' : 'text-slate-500'}>
          • Mínimo 8 caracteres
        </p>
        <p className={requisitos.tieneMayuscula ? 'text-emerald-700' : 'text-slate-500'}>
          • Una mayúscula
        </p>
        <p className={requisitos.tieneMinuscula ? 'text-emerald-700' : 'text-slate-500'}>
          • Una minúscula
        </p>
        <p className={requisitos.tieneNumero ? 'text-emerald-700' : 'text-slate-500'}>
          • Un número
        </p>
        <p
          className={
            requisitos.tieneEspecial
              ? 'text-emerald-700 sm:col-span-2'
              : 'text-slate-500 sm:col-span-2'
          }
        >
          • Un carácter especial
        </p>
      </div>
    </div>
  );
}
