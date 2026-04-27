import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { obtenerMisSalones } from '../../../servicios/servicioVendedor';

const ESTADOS_SALON: Record<string, { etiqueta: string; clase: string }> = {
  aprobado: { etiqueta: 'Activo', clase: 'badge badge-active' },
  pendiente: { etiqueta: 'Pendiente', clase: 'badge badge-pending' },
  suspendido: { etiqueta: 'Suspendido', clase: 'badge badge-suspend' },
  bloqueado: { etiqueta: 'Bloqueado', clase: 'badge badge-neutral' },
  rechazado: { etiqueta: 'Rechazado', clase: 'badge badge-danger' },
};

export function TabSalonesVendedor() {
  const { data: salones, isLoading } = useQuery({
    queryKey: ['vendedor', 'salones'],
    queryFn: obtenerMisSalones,
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  if (!salones || salones.length === 0) {
    return (
      <div className="text-center py-16">
        <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
        <p className="text-slate-500 font-medium">Aún no tienes salones asignados</p>
        <p className="text-slate-400 text-sm mt-1">
          Cuando aprueben tus pre-registros, los salones aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Mis salones</h2>

      {/* Tabla desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">Salón</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Propietario</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Plan</th>
              <th className="px-4 py-3 font-semibold text-slate-600">País</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-center">Reservas</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Vence</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {salones.map((s) => {
              const estado = ESTADOS_SALON[s.estado] ?? ESTADOS_SALON.pendiente;
              return (
                <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{s.propietario}</td>
                  <td className="px-4 py-3">
                    <span
                      className={s.plan === 'PRO' ? 'badge badge-premium' : 'badge badge-neutral'}
                    >
                      {s.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.pais}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-900">
                    {s.totalReservas}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.fechaVencimiento}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={estado.clase}>{estado.etiqueta}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjetas móvil */}
      <div className="md:hidden space-y-3">
        {salones.map((s) => {
          const estado = ESTADOS_SALON[s.estado] ?? ESTADOS_SALON.pendiente;
          return (
            <article key={s.id} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{s.nombre}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{s.propietario}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {s.pais} &middot; {s.plan} &middot; Vence: {s.fechaVencimiento}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>{s.totalReservas}</strong> reservas
                  </p>
                </div>
                <span className={`${estado.clase} shrink-0`}>{estado.etiqueta}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
