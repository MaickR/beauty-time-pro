import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Mail, Lock, Shield } from 'lucide-react';
import { usarTiendaAuth } from '../../../tienda/tiendaAuth';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { cambiarContrasenaAPI, solicitarCambioEmailAPI } from '../../../servicios/servicioAuth';
import { FormularioPinCancelacion } from './FormularioPinCancelacion';

const esquemaContrasena = z
  .object({
    contrasenaActual: z.string().min(1, 'Ingresa tu contraseña actual'),
    contrasenaNueva: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Incluye al menos una mayúscula')
      .regex(/[0-9]/, 'Incluye al menos un número'),
    confirmarContrasena: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((datos) => datos.contrasenaNueva === datos.confirmarContrasena, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarContrasena'],
  });

const esquemaEmail = z.object({
  emailNuevo: z.string().email('Ingresa un correo válido'),
});

type CamposContrasena = z.infer<typeof esquemaContrasena>;
type CamposEmail = z.infer<typeof esquemaEmail>;

interface PropsSeguridadDueno {
  estudioId: string;
  pinConfigurado: boolean;
}

function evaluarFortaleza(contrasena: string): { etiqueta: string; ancho: string; color: string } {
  const puntaje = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].reduce(
    (total, regla) => total + (regla.test(contrasena) ? 1 : 0),
    0,
  );

  if (puntaje <= 1) return { etiqueta: 'Baja', ancho: 'w-1/4', color: 'bg-red-500' };
  if (puntaje === 2) return { etiqueta: 'Media', ancho: 'w-2/4', color: 'bg-amber-500' };
  if (puntaje === 3) return { etiqueta: 'Buena', ancho: 'w-3/4', color: 'bg-sky-500' };
  return { etiqueta: 'Alta', ancho: 'w-full', color: 'bg-emerald-500' };
}

export function SeguridadDueno({ estudioId, pinConfigurado }: PropsSeguridadDueno) {
  const { usuario } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const [emailPendiente, setEmailPendiente] = useState<string | null>(null);

  const formularioContrasena = useForm<CamposContrasena>({
    resolver: zodResolver(esquemaContrasena),
    defaultValues: {
      contrasenaActual: '',
      contrasenaNueva: '',
      confirmarContrasena: '',
    },
  });
  const formularioEmail = useForm<CamposEmail>({
    resolver: zodResolver(esquemaEmail),
    defaultValues: {
      emailNuevo: usuario?.email ?? '',
    },
  });

  const mutacionContrasena = useMutation({
    mutationFn: (datos: CamposContrasena) =>
      cambiarContrasenaAPI(datos.contrasenaActual, datos.contrasenaNueva),
    onSuccess: () => {
      formularioContrasena.reset();
      mostrarToast({ mensaje: 'Contraseña actualizada correctamente', variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const mutacionEmail = useMutation({
    mutationFn: (datos: CamposEmail) => solicitarCambioEmailAPI(datos.emailNuevo),
    onSuccess: (respuesta, variables) => {
      setEmailPendiente(variables.emailNuevo.trim().toLowerCase());
      mostrarToast({ mensaje: respuesta.mensaje, variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const fortaleza = evaluarFortaleza(formularioContrasena.watch('contrasenaNueva'));

  return (
    <div className="mx-auto grid max-w-5xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-pink-100 p-3 text-pink-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Cambiar contraseña</h3>
              <p className="text-sm text-slate-500">Actualiza el acceso principal del dueño.</p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={formularioContrasena.handleSubmit((datos) =>
              mutacionContrasena.mutate(datos),
            )}
            noValidate
          >
            {[
              ['contrasenaActual', 'Contraseña actual'],
              ['contrasenaNueva', 'Nueva contraseña'],
              ['confirmarContrasena', 'Confirmar nueva contraseña'],
            ].map(([campo, etiqueta]) => {
              const clave = campo as keyof CamposContrasena;
              return (
                <label key={campo} className="block">
                  <span className="mb-1 block text-sm font-bold text-slate-700">{etiqueta}</span>
                  <input
                    type="password"
                    {...formularioContrasena.register(clave)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                  />
                  {formularioContrasena.formState.errors[clave] && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {formularioContrasena.formState.errors[clave]?.message}
                    </p>
                  )}
                </label>
              );
            })}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500">
                <span>Fortaleza</span>
                <span>{fortaleza.etiqueta}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${fortaleza.ancho} ${fortaleza.color}`} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Usa al menos 8 caracteres, una mayúscula y un número.
              </p>
            </div>

            <button
              type="submit"
              disabled={mutacionContrasena.isPending}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-black disabled:opacity-60"
            >
              {mutacionContrasena.isPending ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </section>

        <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Cambiar email del dueño</h3>
              <p className="text-sm text-slate-500">
                El cambio se confirma desde el enlace enviado al nuevo correo.
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <span className="font-black text-slate-900">Email actual:</span>{' '}
              {usuario?.email ?? 'No disponible'}
            </p>
            {emailPendiente && (
              <p className="mt-2 text-sky-700">
                <span className="font-black">Pendiente de verificar:</span> {emailPendiente}
              </p>
            )}
          </div>

          <form
            className="space-y-4"
            onSubmit={formularioEmail.handleSubmit((datos) => mutacionEmail.mutate(datos))}
            noValidate
          >
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">Nuevo email</span>
              <input
                type="email"
                {...formularioEmail.register('emailNuevo')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              />
              {formularioEmail.formState.errors.emailNuevo && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {formularioEmail.formState.errors.emailNuevo.message}
                </p>
              )}
            </label>

            <button
              type="submit"
              disabled={mutacionEmail.isPending}
              className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {mutacionEmail.isPending
                ? 'Enviando enlace...'
                : 'Enviar verificación al nuevo correo'}
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">PIN de cancelación</h3>
            <p className="text-sm text-slate-500">
              Protege cancelaciones y marcados manuales desde el panel.
            </p>
          </div>
        </div>
        <FormularioPinCancelacion estudioId={estudioId} pinConfigurado={pinConfigurado} />
      </section>
    </div>
  );
}
