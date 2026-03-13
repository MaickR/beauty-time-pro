import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, User, Scissors } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import {
  obtenerMiPerfilEmpleado,
  cambiarContrasenaEmpleado,
} from '../../servicios/servicioEmpleados';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';

const DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const esquemaCambioContrasena = z
  .object({
    contrasenaActual: z.string().min(1, 'Ingresa tu contraseña actual'),
    contrasenaNueva: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe tener al menos un número')
      .regex(/[^A-Za-z0-9]/, 'Debe tener al menos un símbolo'),
    confirmarContrasena: z.string().min(1, 'Confirma tu nueva contraseña'),
  })
  .refine((d) => d.contrasenaNueva === d.confirmarContrasena, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarContrasena'],
  });

type CamposCambioContrasena = z.infer<typeof esquemaCambioContrasena>;

interface PropsInputContrasena {
  id: string;
  label: string;
  error?: string;
  describedBy?: string;
  registro: ReturnType<ReturnType<typeof useForm<CamposCambioContrasena>>['register']>;
}

function InputContrasena({ id, label, error, describedBy, registro }: PropsInputContrasena) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`w-full border rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-pink-400 ${
            error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
          }`}
          {...registro}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={describedBy} className="text-xs text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function PaginaPerfilEmpleado() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const { usuario, completarCambioContrasenaEmpleado } = usarTiendaAuth();
  const [exito, setExito] = useState(false);
  const forzarCambio =
    usuario?.forzarCambioContrasena || ubicacion.pathname === '/empleado/cambiar-contrasena';

  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil-empleado'],
    queryFn: obtenerMiPerfilEmpleado,
    staleTime: 1000 * 60 * 5,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CamposCambioContrasena>({
    resolver: zodResolver(esquemaCambioContrasena),
  });

  const mutacionContrasena = useMutation({
    mutationFn: (datos: CamposCambioContrasena) =>
      cambiarContrasenaEmpleado(datos.contrasenaActual, datos.contrasenaNueva),
    onSuccess: () => {
      completarCambioContrasenaEmpleado();
      setExito(true);
      reset();
      setTimeout(() => {
        setExito(false);
        if (forzarCambio) {
          navegar('/empleado/agenda', { replace: true });
        }
      }, 1800);
    },
  });

  const onSubmit = (datos: CamposCambioContrasena) => {
    mutacionContrasena.mutate(datos);
  };

  const perfil = consultaPerfil.data;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-black text-slate-900">Mi perfil</h1>

        {forzarCambio && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-black uppercase tracking-wide text-amber-700">Cambio obligatorio</p>
            <p className="mt-1">
              Este es tu primer ingreso con una contraseña temporal. Debes cambiarla antes de
              continuar.
            </p>
          </section>
        )}

        {/* Datos personales (solo lectura) */}
        {consultaPerfil.isLoading && (
          <div
            className="bg-white rounded-2xl p-6 shadow-sm animate-pulse h-40"
            aria-busy="true"
            aria-label="Cargando perfil"
          />
        )}

        {perfil && (
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                <User className="w-5 h-5 text-pink-600" aria-hidden="true" />
              </div>
              <h2 className="text-base font-black text-slate-800">Datos personales</h2>
            </div>

            {perfil.avatarUrl && (
              <img
                src={perfil.avatarUrl}
                alt={`Foto de ${perfil.nombre}`}
                loading="lazy"
                className="mb-5 h-20 w-20 rounded-full border border-slate-200 object-cover"
              />
            )}

            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre</dt>
                <dd className="text-sm font-semibold text-slate-800 mt-0.5">{perfil.nombre}</dd>
              </div>

              {perfil.especialidades.length > 0 && (
                <div>
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Scissors className="w-3 h-3" aria-hidden="true" />
                    Especialidades
                  </dt>
                  <dd className="flex flex-wrap gap-1.5 mt-1.5">
                    {perfil.especialidades.map((esp) => (
                      <span
                        key={esp}
                        className="text-xs font-semibold bg-pink-50 text-pink-700 px-2.5 py-1 rounded-full"
                      >
                        {esp}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {perfil.horaInicio && perfil.horaFin && (
                <div>
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Horario
                  </dt>
                  <dd className="text-sm text-slate-700 mt-0.5">
                    {perfil.horaInicio} – {perfil.horaFin}
                    {perfil.descansoInicio && perfil.descansoFin && (
                      <span className="text-slate-400 text-xs ml-2">
                        (descanso {perfil.descansoInicio}–{perfil.descansoFin})
                      </span>
                    )}
                  </dd>
                </div>
              )}

              {perfil.diasTrabajo && perfil.diasTrabajo.length > 0 && (
                <div>
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Días de trabajo
                  </dt>
                  <dd className="text-sm text-slate-700 mt-0.5">
                    {perfil.diasTrabajo.map((d) => DIAS_NOMBRES[d]).join(', ')}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-xs font-bold text-slate-500 uppercase tracking-wide">Salón</dt>
                <dd className="text-sm font-semibold text-slate-800 mt-0.5">
                  {perfil.estudio.nombre}
                </dd>
                {perfil.estudio.direccion && (
                  <dd className="text-xs text-slate-500">{perfil.estudio.direccion}</dd>
                )}
              </div>
            </dl>
          </section>
        )}

        {/* Cambio de contraseña */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-pink-600" aria-hidden="true" />
            </div>
            <h2 className="text-base font-black text-slate-800">Cambiar contraseña</h2>
          </div>

          {exito && (
            <div
              role="status"
              className="mb-4 bg-green-50 text-green-700 text-sm font-medium rounded-xl px-4 py-3 border border-green-200"
            >
              ¡Contraseña actualizada exitosamente!
            </div>
          )}

          {mutacionContrasena.isError && (
            <div
              role="alert"
              className="mb-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl px-4 py-3 border border-red-200"
            >
              {(mutacionContrasena.error as Error).message ||
                'No se pudo cambiar la contraseña. Verifica tu contraseña actual.'}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <InputContrasena
              id="contrasenaActual"
              label="Contraseña actual"
              error={errors.contrasenaActual?.message}
              describedBy="error-contrasena-actual"
              registro={register('contrasenaActual')}
            />
            <InputContrasena
              id="contrasenaNueva"
              label="Nueva contraseña"
              error={errors.contrasenaNueva?.message}
              describedBy="error-contrasena-nueva"
              registro={register('contrasenaNueva')}
            />
            <InputContrasena
              id="confirmarContrasena"
              label="Confirmar nueva contraseña"
              error={errors.confirmarContrasena?.message}
              describedBy="error-confirmar-contrasena"
              registro={register('confirmarContrasena')}
            />

            <p className="text-xs text-slate-400">
              La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo.
            </p>

            <button
              type="submit"
              disabled={mutacionContrasena.isPending}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {mutacionContrasena.isPending ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
