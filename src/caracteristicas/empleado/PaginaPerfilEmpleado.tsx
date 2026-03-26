import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, Scissors, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import {
  obtenerMiPerfilEmpleado,
  cambiarContrasenaEmpleado,
} from '../../servicios/servicioEmpleados';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';

const DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function obtenerDiasTrabajoNormalizados(
  diasTrabajo: unknown,
  diasAtencion: string | null | undefined,
): number[] {
  if (Array.isArray(diasTrabajo)) {
    const dias = diasTrabajo
      .map((dia) => {
        if (typeof dia === 'number' && dia >= 0 && dia <= 6) return dia;
        if (typeof dia === 'string') {
          const convertido = Number(dia);
          return Number.isInteger(convertido) && convertido >= 0 && convertido <= 6
            ? convertido
            : null;
        }
        return null;
      })
      .filter((dia): dia is number => dia !== null);

    if (dias.length > 0) {
      return dias;
    }
  }

  if (!diasAtencion) {
    return [];
  }

  const mapaDias = new Map<string, number>([
    ['domingo', 0],
    ['lunes', 1],
    ['martes', 2],
    ['miercoles', 3],
    ['miércoles', 3],
    ['jueves', 4],
    ['viernes', 5],
    ['sabado', 6],
    ['sábado', 6],
  ]);

  return diasAtencion
    .split(',')
    .map((dia) => mapaDias.get(normalizarTexto(dia)))
    .filter((dia): dia is number => dia !== undefined);
}

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
  .refine((datos) => datos.contrasenaNueva === datos.confirmarContrasena, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarContrasena'],
  });

type CamposCambioContrasena = z.infer<typeof esquemaCambioContrasena>;

interface PropsInputContrasena {
  id: keyof CamposCambioContrasena;
  etiqueta: string;
  error?: string;
  registro: ReturnType<ReturnType<typeof useForm<CamposCambioContrasena>>['register']>;
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

function InputContrasena({ etiqueta, error, registro }: PropsInputContrasena) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{etiqueta}</span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          className={`w-full rounded-2xl border px-4 py-3 pr-11 text-sm outline-none transition focus:ring-2 focus:ring-pink-100 ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white focus:border-pink-400'}`}
          {...registro}
        />
        <button
          type="button"
          onClick={() => setVisible((actual) => !actual)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </label>
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
    staleTime: 5 * 60_000,
  });

  const formulario = useForm<CamposCambioContrasena>({
    resolver: zodResolver(esquemaCambioContrasena),
    defaultValues: {
      contrasenaActual: '',
      contrasenaNueva: '',
      confirmarContrasena: '',
    },
  });

  const mutacionContrasena = useMutation({
    mutationFn: (datos: CamposCambioContrasena) =>
      cambiarContrasenaEmpleado(datos.contrasenaActual, datos.contrasenaNueva),
    onSuccess: () => {
      completarCambioContrasenaEmpleado();
      setExito(true);
      formulario.reset();
      setTimeout(() => {
        setExito(false);
        if (forzarCambio) {
          navegar('/empleado/agenda', { replace: true });
        }
      }, 1800);
    },
  });

  const perfil = consultaPerfil.data;
  const fortaleza = evaluarFortaleza(formulario.watch('contrasenaNueva'));
  const diasTrabajo = obtenerDiasTrabajoNormalizados(
    perfil?.diasTrabajo,
    perfil?.estudio.diasAtencion,
  );
  const inicial = perfil?.nombre.slice(0, 1).toUpperCase() ?? 'E';
  const horarioInicio = perfil?.horaInicio ?? perfil?.estudio.horarioApertura ?? '—';
  const horarioFin = perfil?.horaFin ?? perfil?.estudio.horarioCierre ?? '—';

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        {forzarCambio && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-black uppercase tracking-wide text-amber-700">Cambio obligatorio</p>
            <p className="mt-1">
              Este es tu primer ingreso con una contraseña temporal. Debes cambiarla antes de
              continuar.
            </p>
          </section>
        )}

        {perfil && (
          <header className="rounded-4xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-pink-100 text-3xl font-black text-pink-700">
              {perfil.avatarUrl ? (
                <img
                  src={perfil.avatarUrl}
                  alt={`Foto de ${perfil.nombre}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                inicial
              )}
            </div>
            <h1 className="mt-4 text-2xl font-black text-slate-900">{perfil.nombre}</h1>
            <p className="mt-1 text-sm font-bold uppercase tracking-[0.24em] text-slate-400">
              Especialista
            </p>
          </header>
        )}

        {consultaPerfil.isLoading && (
          <div className="h-40 animate-pulse rounded-4xl bg-white shadow-sm" aria-busy="true" />
        )}

        {perfil && (
          <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-pink-100 p-3 text-pink-600">
                <UserRound className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Datos personales</h2>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <p>
                <span className="font-black text-slate-900">Nombre:</span> {perfil.nombre}
              </p>
              <p className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{perfil.email}</span>
              </p>
              <div>
                <p className="mb-2 font-black text-slate-900">Especialidades</p>
                <div className="flex flex-wrap gap-2">
                  {perfil.especialidades.map((especialidad) => (
                    <span
                      key={especialidad}
                      className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-700"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Scissors className="h-3 w-3" /> {especialidad}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {perfil && (
          <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">Horario semanal</h2>
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="grid grid-cols-[1.1fr_0.9fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                <span>Día</span>
                <span>Horario</span>
              </div>
              {DIAS_NOMBRES.map((dia, indice) => {
                const activo = diasTrabajo.includes(indice);
                return (
                  <div
                    key={dia}
                    className="grid grid-cols-[1.1fr_0.9fr] border-t border-slate-100 px-4 py-3 text-sm"
                  >
                    <span className={`font-bold ${activo ? 'text-slate-900' : 'text-slate-400'}`}>
                      {dia}
                    </span>
                    <span className={activo ? 'text-slate-700' : 'text-slate-400'}>
                      {activo ? `${horarioInicio} - ${horarioFin}` : 'Descanso'}
                    </span>
                  </div>
                );
              })}
            </div>
            {perfil.descansoInicio && perfil.descansoFin && (
              <p className="mt-3 text-xs text-slate-500">
                Descanso diario: {perfil.descansoInicio} - {perfil.descansoFin}
              </p>
            )}
          </section>
        )}

        <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-600">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Cambiar contraseña</h2>
          </div>

          {exito && (
            <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              ¡Contraseña actualizada exitosamente!
            </div>
          )}

          {mutacionContrasena.isError && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {(mutacionContrasena.error as Error).message ||
                'No se pudo cambiar la contraseña. Verifica tu contraseña actual.'}
            </div>
          )}

          <form
            onSubmit={formulario.handleSubmit((datos) => mutacionContrasena.mutate(datos))}
            className="space-y-4"
            noValidate
          >
            <InputContrasena
              id="contrasenaActual"
              etiqueta="Contraseña actual"
              error={formulario.formState.errors.contrasenaActual?.message}
              registro={formulario.register('contrasenaActual')}
            />
            <InputContrasena
              id="contrasenaNueva"
              etiqueta="Nueva contraseña"
              error={formulario.formState.errors.contrasenaNueva?.message}
              registro={formulario.register('contrasenaNueva')}
            />
            <InputContrasena
              id="confirmarContrasena"
              etiqueta="Confirmar nueva contraseña"
              error={formulario.formState.errors.confirmarContrasena?.message}
              registro={formulario.register('confirmarContrasena')}
            />

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500">
                <span>Fortaleza</span>
                <span>{fortaleza.etiqueta}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${fortaleza.ancho} ${fortaleza.color}`} />
              </div>
            </div>

            <button
              type="submit"
              disabled={mutacionContrasena.isPending}
              className="w-full rounded-2xl bg-pink-600 py-3 text-sm font-black text-white transition-colors hover:bg-pink-700 disabled:opacity-50"
            >
              {mutacionContrasena.isPending ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
