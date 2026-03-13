import { useState } from 'react';
import { X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crearAccesoEmpleado } from '../../../servicios/servicioEmpleados';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

interface PropsModalCrearAccesoEmpleado {
  estudioId: string;
  personalId: string;
  nombreEmpleado: string;
  abierto: boolean;
  alCerrar: () => void;
}

function generarContrasenaSegura(): string {
  const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const numeros = '0123456789';
  const simbolos = '!@#$%&*';
  const todos = mayusculas + minusculas + numeros + simbolos;

  let contrasena =
    mayusculas[Math.floor(Math.random() * mayusculas.length)] +
    numeros[Math.floor(Math.random() * numeros.length)] +
    simbolos[Math.floor(Math.random() * simbolos.length)];

  for (let i = 3; i < 12; i++) {
    contrasena += todos[Math.floor(Math.random() * todos.length)];
  }

  return contrasena
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export function ModalCrearAccesoEmpleado({
  estudioId,
  personalId,
  nombreEmpleado,
  abierto,
  alCerrar,
}: PropsModalCrearAccesoEmpleado) {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [forzarCambioContrasena, setForzarCambioContrasena] = useState(true);
  const { mostrarToast } = usarToast();
  const queryClient = useQueryClient();

  const { mutate: guardar, isPending } = useMutation({
    mutationFn: () =>
      crearAccesoEmpleado(estudioId, personalId, {
        email,
        contrasena,
        forzarCambioContrasena,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['acceso-empleado', personalId] });
      mostrarToast(`Se envió un email a ${email} con las instrucciones de acceso`);
      setEmail('');
      setContrasena('');
      setForzarCambioContrasena(true);
      alCerrar();
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message ?? 'No se pudo crear el acceso', variante: 'error' });
    },
  });

  const manejarGenerarContrasena = () => {
    setContrasena(generarContrasenaSegura());
    setMostrarContrasena(true);
  };

  const manejarEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !contrasena) return;
    guardar();
  };

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-acceso"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') alCerrar();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="titulo-modal-acceso" className="font-black text-slate-900 text-lg">
            Dar acceso a {nombreEmpleado}
          </h2>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={alCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={manejarEnviar} className="space-y-4">
          <div>
            <label
              htmlFor="email-acceso"
              className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5"
            >
              Email del empleado
            </label>
            <input
              id="email-acceso"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              placeholder="empleado@ejemplo.com"
              aria-describedby="email-acceso-desc"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <p id="email-acceso-desc" className="text-xs text-slate-400 mt-1">
              El empleado usará este email para iniciar sesión
            </p>
          </div>

          <div>
            <label
              htmlFor="contrasena-acceso"
              className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5"
            >
              Contraseña temporal
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="contrasena-acceso"
                  type={mostrarContrasena ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <button
                  type="button"
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setMostrarContrasena((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {mostrarContrasena ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={manejarGenerarContrasena}
                aria-label="Generar contraseña segura automáticamente"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Generar
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Debe tener mayúscula, número y símbolo. Mín. 8 caracteres.
            </p>
            <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Esta es una contraseña temporal. El empleado deberá cambiarla en su primer acceso
              al sistema.
            </p>
          </div>

          <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
            <input
              id="forzar-cambio-contrasena"
              type="checkbox"
              checked={forzarCambioContrasena}
              onChange={(e) => setForzarCambioContrasena(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-pink-600"
            />
            <label
              htmlFor="forzar-cambio-contrasena"
              className="text-xs text-slate-700 font-medium"
            >
              Solicitar cambio de contraseña en el primer inicio de sesión
            </label>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3">
            <input
              id="enviar-email"
              type="checkbox"
              defaultChecked
              className="rounded border-slate-300 text-pink-600"
            />
            <label htmlFor="enviar-email" className="text-xs text-blue-700 font-medium">
              Enviar credenciales por email al empleado
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={alCerrar}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !email || !contrasena}
              aria-busy={isPending}
              className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-bold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Guardando…' : 'Dar acceso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
