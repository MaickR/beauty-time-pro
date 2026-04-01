import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { obtenerMisSalones } from '../../../servicios/servicioVendedor';

const ESTADOS_SALON: Record<string, { etiqueta: string; color: string }> = {
  aprobado: { etiqueta: 'Active', color: 'bg-green-100 text-green-700' },
  pendiente: { etiqueta: 'Pending', color: 'bg-amber-100 text-amber-700' },
  suspendido: { etiqueta: 'Suspended', color: 'bg-red-100 text-red-700' },
  bloqueado: { etiqueta: 'Blocked', color: 'bg-slate-200 text-slate-600' },
  rechazado: { etiqueta: 'Rejected', color: 'bg-red-100 text-red-700' },
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
        <p className="text-slate-500 font-medium">No salons assigned yet</p>
        <p className="text-slate-400 text-sm mt-1">
          When your pre-registrations are approved, salons will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-4">My Salons</h2>

      {/* Tabla desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">Salon</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Owner</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Plan</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Country</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-center">Bookings</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Expires</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-center">Status</th>
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
                      className={`px-2 py-0.5 rounded text-xs font-bold ${s.plan === 'PRO' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}
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
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${estado.color}`}
                    >
                      {estado.etiqueta}
                    </span>
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
                    {s.pais} &middot; {s.plan} &middot; Expires: {s.fechaVencimiento}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>{s.totalReservas}</strong> bookings
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${estado.color}`}
                >
                  {estado.etiqueta}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
