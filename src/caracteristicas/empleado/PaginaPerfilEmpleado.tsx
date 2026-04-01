import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Scissors, UserRound } from 'lucide-react';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import { obtenerMiPerfilEmpleado } from '../../servicios/servicioEmpleados';

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
  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil-empleado'],
    queryFn: obtenerMiPerfilEmpleado,
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

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
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

        {perfil && (
          <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-600">
                <Phone className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Salon Contact</h2>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-black text-slate-900">Salon:</span> {perfil.estudio.nombre}
              </p>
              <p className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <a
                  href={`tel:${perfil.estudio.telefono}`}
                  className="text-pink-600 transition hover:text-pink-700"
                >
                  {perfil.estudio.telefono}
                </a>
              </p>
              {perfil.estudio.direccion && (
                <p className="text-slate-500">{perfil.estudio.direccion}</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
