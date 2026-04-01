import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileText, Store } from 'lucide-react';
import { obtenerResumenVendedor } from '../../servicios/servicioVendedor';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { TabPreregistros } from './componentes/TabPreregistros';
import { TabSalonesVendedor } from './componentes/TabSalonesVendedor';

type TabVendedor = 'resumen' | 'preregistros' | 'salones';

const TABS: { valor: TabVendedor; etiqueta: string; icono: typeof BarChart3 }[] = [
  { valor: 'resumen', etiqueta: 'Dashboard', icono: BarChart3 },
  { valor: 'preregistros', etiqueta: 'Pre-registrations', icono: FileText },
  { valor: 'salones', etiqueta: 'My Salons', icono: Store },
];

export function PaginaVendedor() {
  usarTituloPagina('Vendor Panel — Beauty Time Pro');
  const [tabActivo, setTabActivo] = useState<TabVendedor>('resumen');

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['vendedor', 'resumen'],
    queryFn: obtenerResumenVendedor,
    staleTime: 1000 * 60 * 2,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-black text-slate-900">Vendor Panel</h1>
          <span className="text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full">
            Beauty Time Pro
          </span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex gap-1 overflow-x-auto">
          {TABS.map(({ valor, etiqueta, icono: Icono }) => (
            <button
              key={valor}
              onClick={() => setTabActivo(valor)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tabActivo === valor
                  ? 'border-pink-600 text-pink-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icono className="w-4 h-4" aria-hidden="true" />
              {etiqueta}
            </button>
          ))}
        </div>
      </nav>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {tabActivo === 'resumen' && (
          <SeccionResumen resumen={resumen ?? null} cargando={isLoading} />
        )}
        {tabActivo === 'preregistros' && <TabPreregistros />}
        {tabActivo === 'salones' && <TabSalonesVendedor />}
      </main>
    </div>
  );
}

// ─── Sección Resumen ─────────────────────────────────────────────────────

interface PropsResumen {
  resumen: {
    totalPreregistros: number;
    pendientes: number;
    aprobados: number;
    rechazados: number;
    totalSalones: number;
    salonesActivos: number;
  } | null;
  cargando: boolean;
}

function SeccionResumen({ resumen, cargando }: PropsResumen) {
  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  if (!resumen) {
    return <p className="text-slate-500 text-center py-12">Could not load dashboard data.</p>;
  }

  const tarjetas = [
    {
      etiqueta: 'Total Pre-registrations',
      valor: resumen.totalPreregistros,
      color: 'bg-slate-100 text-slate-700',
    },
    { etiqueta: 'Pending', valor: resumen.pendientes, color: 'bg-amber-50 text-amber-700' },
    { etiqueta: 'Approved', valor: resumen.aprobados, color: 'bg-green-50 text-green-700' },
    { etiqueta: 'Rejected', valor: resumen.rechazados, color: 'bg-red-50 text-red-700' },
    { etiqueta: 'Salons Assigned', valor: resumen.totalSalones, color: 'bg-blue-50 text-blue-700' },
    {
      etiqueta: 'Active Salons',
      valor: resumen.salonesActivos,
      color: 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tarjetas.map((t) => (
          <div key={t.etiqueta} className={`rounded-2xl p-5 ${t.color}`}>
            <p className="text-xs font-bold uppercase opacity-70">{t.etiqueta}</p>
            <p className="text-3xl font-black mt-1">{t.valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
