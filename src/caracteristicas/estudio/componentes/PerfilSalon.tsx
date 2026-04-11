import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Phone, User, Mail, FileText, GitBranch } from 'lucide-react';
import { obtenerPerfilEstudio } from '../../../servicios/servicioPerfil';

interface PropsPerfilSalon {
  estudioId: string;
}

interface CampoInfo {
  icono: typeof Building2;
  etiqueta: string;
  valor: string | null | undefined;
}

export function PerfilSalon({ estudioId }: PropsPerfilSalon) {
  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-estudio', estudioId],
    queryFn: () => obtenerPerfilEstudio(estudioId),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading || !perfil) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const campos: CampoInfo[] = [
    { icono: Building2, etiqueta: 'Nombre del salón', valor: perfil.nombre },
    { icono: MapPin, etiqueta: 'Dirección', valor: perfil.direccion },
    { icono: Phone, etiqueta: 'Teléfono', valor: perfil.telefono },
    { icono: User, etiqueta: 'Propietario', valor: perfil.propietario },
    { icono: Mail, etiqueta: 'Correo de la cuenta', valor: perfil.emailCuenta },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-5">
        <h3 className="text-lg font-black uppercase tracking-tight">Información del salón</h3>
        <div className="divide-y divide-slate-100">
          {campos.map(({ icono: Icono, etiqueta, valor }) => (
            <div key={etiqueta} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              <div className="bg-slate-100 p-2.5 rounded-xl">
                <Icono className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {etiqueta}
                </p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {valor || <span className="text-slate-300 italic">No registrado</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2.5 rounded-xl">
            <GitBranch className="w-4 h-4 text-slate-500" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight">Branch structure</h3>
        </div>

        {perfil.estudioPrincipal ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Parent salon
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {perfil.estudioPrincipal.nombre}
            </p>
          </div>
        ) : perfil.sedes && perfil.sedes.length > 0 ? (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Public booking</th>
                </tr>
              </thead>
              <tbody>
                {perfil.sedes.map((sede) => (
                  <tr key={sede.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-700">{sede.nombre}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{sede.plan}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {sede.permiteReservasPublicas ? 'Enabled' : 'Disabled'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-400">
              This salon is currently operating as an independent location.
            </p>
          </div>
        )}
      </section>

      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2.5 rounded-xl">
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight">Contrato de servicio</h3>
        </div>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-400">
            Tu contrato de servicio estará disponible aquí próximamente.
          </p>
        </div>
      </section>
    </div>
  );
}
