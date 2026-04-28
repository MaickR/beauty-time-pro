import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BellRing,
  Building2,
  CalendarDays,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Scissors,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import { obtenerMiPerfilEmpleado } from '../../servicios/servicioEmpleados';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { formatearFechaHumana } from '../../utils/formato';

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

export function PaginaPerfilEmpleado() {
  const { usuario, iniciando } = usarTiendaAuth();

  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil-empleado'],
    queryFn: obtenerMiPerfilEmpleado,
    enabled: !iniciando && usuario?.rol === 'empleado',
    staleTime: 5 * 60_000,
  });

  const perfil = consultaPerfil.data;
  const diasTrabajo = obtenerDiasTrabajoNormalizados(
    perfil?.diasTrabajo,
    perfil?.estudio.diasAtencion,
  );
  const inicial = perfil?.nombre.slice(0, 1).toUpperCase() ?? 'E';
  const horarioInicio = perfil?.horaInicio ?? perfil?.estudio.horarioApertura ?? '—';
  const horarioFin = perfil?.horaFin ?? perfil?.estudio.horarioCierre ?? '—';
  const totalDiasActivos = diasTrabajo.length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="hidden md:flex">
          <Link
            to="/empleado/agenda"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to agenda
          </Link>
        </div>
        {consultaPerfil.isLoading && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]" aria-busy="true">
            <div className="h-72 animate-pulse rounded-[2.5rem] bg-white shadow-sm" />
            <div className="h-72 animate-pulse rounded-[2.5rem] bg-white shadow-sm" />
          </div>
        )}

        {consultaPerfil.isError && (
          <div className="rounded-[2.5rem] border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-700">
            No se pudo cargar tu perfil. Intenta nuevamente en unos segundos.
          </div>
        )}

        {perfil && (
          <>
            <section className="overflow-hidden rounded-[2.75rem] bg-linear-to-br from-slate-950 via-slate-900 to-pink-700 text-white shadow-xl">
              <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-4xl font-black text-white shadow-lg">
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

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-pink-200">
                      Perfil del empleado
                    </p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                      {perfil.nombre}
                    </h1>
                    <p className="mt-2 text-sm font-bold uppercase tracking-[0.24em] text-slate-200">
                      {perfil.especialidades.length > 0
                        ? `Specialist in ${perfil.especialidades.slice(0, 2).join(' & ')}`
                        : 'Specialist'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {perfil.especialidades.map((especialidad) => (
                        <span
                          key={especialidad}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-white"
                        >
                          <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                          {especialidad}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-4xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-100">
                      Jornada base
                    </p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {horarioInicio} - {horarioFin}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {totalDiasActivos} día(s) activos por semana
                    </p>
                  </div>

                  <div className="rounded-4xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-100">
                      Alta en sistema
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {formatearFechaHumana(perfil.creadoEn)}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      No puedes ver ni operar fechas anteriores a esta fecha.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
              <section className="space-y-6">
                <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-pink-100 p-3 text-pink-600">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Datos personales</h2>
                      <p className="text-sm text-slate-500">
                        Información visible para tu operación diaria dentro del salón.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Nombre completo
                      </p>
                      <p className="mt-2 text-lg font-black text-slate-900">{perfil.nombre}</p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Correo
                      </p>
                      <a
                        href={`mailto:${perfil.email}`}
                        className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-pink-600 transition hover:text-pink-700"
                      >
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        {perfil.email}
                      </a>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Rol operativo
                      </p>
                      <p className="mt-2 text-sm font-black text-slate-900">
                        Empleado especialista del salón
                      </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Descanso diario
                      </p>
                      <p className="mt-2 text-sm font-black text-slate-900">
                        {perfil.descansoInicio && perfil.descansoFin
                          ? `${perfil.descansoInicio} - ${perfil.descansoFin}`
                          : 'No configurado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-600">
                      <CalendarDays className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Horario semanal</h2>
                      <p className="text-sm text-slate-500">
                        Tu disponibilidad operativa actual dentro del salón.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-4xl border border-slate-200">
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
                          <span
                            className={`font-bold ${activo ? 'text-slate-900' : 'text-slate-400'}`}
                          >
                            {dia}
                          </span>
                          <span
                            className={activo ? 'font-medium text-slate-700' : 'text-slate-400'}
                          >
                            {activo ? `${horarioInicio} - ${horarioFin}` : 'Descanso'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="inline-flex items-center gap-2 text-slate-500">
                        <Clock3 className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                          Horario operativo
                        </span>
                      </div>
                      <p className="mt-2 text-base font-black text-slate-900">
                        {horarioInicio} - {horarioFin}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Cobertura semanal
                      </p>
                      <p className="mt-2 text-base font-black text-slate-900">
                        {totalDiasActivos} de 7 días activos
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-sky-100 p-3 text-sky-600">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Contacto del salón</h2>
                      <p className="text-sm text-slate-500">
                        Canales directos para resolver temas operativos y administrativos.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 text-sm text-slate-700">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Salón
                      </p>
                      <p className="mt-2 text-base font-black text-slate-900">
                        {perfil.estudio.nombre}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <a
                        href={`tel:${perfil.estudio.telefono}`}
                        className="inline-flex items-center gap-2 font-black text-pink-600 transition hover:text-pink-700"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {perfil.estudio.telefono}
                      </a>
                    </div>

                    {perfil.estudio.emailContacto && (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <a
                          href={`mailto:${perfil.estudio.emailContacto}`}
                          className="inline-flex items-center gap-2 font-black text-pink-600 transition hover:text-pink-700"
                        >
                          <Mail className="h-4 w-4" aria-hidden="true" />
                          {perfil.estudio.emailContacto}
                        </a>
                      </div>
                    )}

                    {perfil.estudio.direccion && (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                        <p className="inline-flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                          <span>{perfil.estudio.direccion}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
                      <BellRing className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Avisos que recibirás</h2>
                      <p className="text-sm text-slate-500">
                        Estas alertas se reflejan desde la operación del salón.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-slate-700">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      Nueva cita asignada a tu agenda.
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      Cambios de horario, cierres o excepciones de disponibilidad.
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      Actualizaciones operativas relevantes del salón.
                    </div>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Acceso y seguridad</h2>
                      <p className="text-sm text-slate-500">
                        Tu panel es informativo y operativo, no administrativo.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-slate-700">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      Tu acceso, contraseña y permisos son administrados por el salón.
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      Cualquier cambio de datos personales, horario o privilegios debe gestionarlo
                      el administrador.
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      Este panel solo te permite operar tus propias citas dentro del rango permitido
                      por tu alta.
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
