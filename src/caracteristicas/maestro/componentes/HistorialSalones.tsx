import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Ban,
  RotateCcw,
  CalendarDays,
  Power,
  PowerOff,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { reactivarSolicitud } from '../../../servicios/servicioAdmin';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

type TabHistorial = 'aprobados' | 'rechazados' | 'suspendidos';

interface UsuarioDueno {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
}

interface EstudioHistorial {
  id: string;
  nombre: string;
  estado: string;
  motivoRechazo?: string | null;
  fechaAprobacion?: string | null;
  fechaSolicitud: string;
  fechaVencimiento: string;
  aprobadoPorNombre?: string | null;
  aprobadoPorEmail?: string | null;
  renovadoPorNombre?: string | null;
  renovadoPorEmail?: string | null;
  usuarios: UsuarioDueno[];
}

interface RespuestaSalones {
  datos: EstudioHistorial[];
}

interface PropsCeldaRenovar {
  estudio: EstudioHistorial;
  onRenovado: () => void;
}

function CeldaRenovar({ estudio, onRenovado }: PropsCeldaRenovar) {
  const { mostrarToast } = usarToast();
  const [renovando, setRenovando] = useState(false);

  const renovar = async () => {
    setRenovando(true);
    try {
      await peticion(`/admin/salones/${estudio.id}`, {
        method: 'PUT',
        body: JSON.stringify({ meses: 1 }),
      });
      mostrarToast({
        mensaje: 'Suscripción extendida 1 mes con la regla automática de vigencia.',
        variante: 'exito',
      });
      onRenovado();
    } catch (err) {
      mostrarToast({
        mensaje: err instanceof Error ? err.message : 'Error al renovar',
        variante: 'error',
      });
    } finally {
      setRenovando(false);
    }
  };

  return (
    <button
      onClick={renovar}
      disabled={renovando}
      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition-colors disabled:opacity-50"
      aria-label={`Renovar suscripción de ${estudio.nombre}`}
    >
      <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> Sumar 1 mes
    </button>
  );
}

interface PropsSuspender {
  estudio: EstudioHistorial;
  onCambio: () => void;
}

function BotonSuspender({ estudio, onCambio }: PropsSuspender) {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const dueno = estudio.usuarios[0];
  const activo = estudio.estado !== 'suspendido' && (dueno?.activo ?? true);

  const { mutate, isPending } = useMutation({
    mutationFn: () => peticion(`/admin/salones/${estudio.id}/suspender`, { method: 'PUT' }),
    onSuccess: () => {
      mostrarToast({
        mensaje: activo ? 'Salón suspendido' : 'Salón reactivado',
        variante: 'exito',
      });
      void clienteConsulta.invalidateQueries({ queryKey: ['historial-salones'] });
      onCambio();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  return (
    <button
      onClick={() => mutate()}
      disabled={isPending}
      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors disabled:opacity-50 ${activo ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
      aria-label={activo ? `Suspender ${estudio.nombre}` : `Reactivar ${estudio.nombre}`}
    >
      {activo ? (
        <PowerOff className="w-3.5 h-3.5" aria-hidden="true" />
      ) : (
        <Power className="w-3.5 h-3.5" aria-hidden="true" />
      )}{' '}
      {activo ? 'Suspender' : 'Reactivar'}
    </button>
  );
}

export function HistorialSalones() {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [tabActivo, setTabActivo] = useState<TabHistorial>('aprobados');
  const fechaArchivo = new Date().toLocaleDateString('sv-SE');

  const consultaEstados: Record<TabHistorial, string> = {
    aprobados: 'aprobado',
    rechazados: 'rechazado',
    suspendidos: 'suspendido',
  };

  const {
    data: salones = [],
    isLoading,
    refetch,
  } = useQuery<EstudioHistorial[]>({
    queryKey: ['historial-salones', tabActivo],
    queryFn: async () => {
      const res = await peticion<RespuestaSalones>(
        `/admin/salones?estado=${consultaEstados[tabActivo]}`,
      );
      return res.datos;
    },
  });

  const mutReactivar = useMutation({
    mutationFn: (id: string) => reactivarSolicitud(id),
    onSuccess: () => {
      mostrarToast({ mensaje: 'Solicitud reactivada como pendiente', variante: 'exito' });
      void clienteConsulta.invalidateQueries({ queryKey: ['solicitudes-pendientes'] });
      void refetch();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  const TABS: { id: TabHistorial; etiqueta: string; icono: React.ReactNode }[] = [
    { id: 'aprobados', etiqueta: 'Aprobados', icono: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'rechazados', etiqueta: 'Rechazados', icono: <XCircle className="w-4 h-4" /> },
    { id: 'suspendidos', etiqueta: 'Suspendidos', icono: <Ban className="w-4 h-4" /> },
  ];

  const exportarPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const fechaGeneracion = new Date().toLocaleDateString('es-MX');
    doc.setFontSize(16);
    doc.text(`Salones — ${tabActivo}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado: ${fechaGeneracion}`, 14, 28);
    const cabeceras = [
      'Salón',
      'Admin',
      'Email',
      'Fecha',
      ...(tabActivo === 'aprobados' ? ['Vencimiento'] : []),
      ...(tabActivo === 'rechazados' ? ['Motivo'] : []),
    ];
    const filas = salones.map((s) => {
      const dueno = s.usuarios[0];
      const fila = [
        s.nombre,
        dueno?.nombre ?? '—',
        dueno?.email ?? '—',
        tabActivo === 'aprobados' && s.fechaAprobacion
          ? new Date(s.fechaAprobacion).toLocaleDateString('es-MX')
          : new Date(s.fechaSolicitud).toLocaleDateString('es-MX'),
      ];
      if (tabActivo === 'aprobados') fila.push(s.fechaVencimiento);
      if (tabActivo === 'rechazados') fila.push(s.motivoRechazo ?? '—');
      return fila;
    });
    autoTable(doc, {
      head: [cabeceras],
      body: filas,
      startY: 34,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [194, 24, 91] },
      didDrawPage: (datos) => {
        doc.setFontSize(9);
        doc.text(`Beauty Time Pro · ${tabActivo}`, 14, doc.internal.pageSize.getHeight() - 10);
        doc.text(
          `Página ${datos.pageNumber}`,
          doc.internal.pageSize.getWidth() - 28,
          doc.internal.pageSize.getHeight() - 10,
        );
      },
    });
    doc.save(`salones-${tabActivo}-${fechaArchivo}.pdf`);
  };

  const exportarExcel = async () => {
    const XLSX = await import('xlsx');
    const datos = salones.map((s) => {
      const dueno = s.usuarios[0];
      const base: Record<string, string> = {
        Salón: s.nombre,
        Admin: dueno?.nombre ?? '—',
        Email: dueno?.email ?? '—',
        Fecha:
          tabActivo === 'aprobados' && s.fechaAprobacion
            ? new Date(s.fechaAprobacion).toLocaleDateString('es-MX')
            : new Date(s.fechaSolicitud).toLocaleDateString('es-MX'),
      };
      if (tabActivo === 'aprobados') base['Vencimiento'] = s.fechaVencimiento;
      if (tabActivo === 'rechazados') base['Motivo'] = s.motivoRechazo ?? '—';
      return base;
    });
    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja['!cols'] = Object.keys(datos[0] ?? { Salón: '', Admin: '', Email: '', Fecha: '' }).map(
      (clave) => ({
        wch: Math.max(
          clave.length + 4,
          ...datos.map((fila) => String(fila[clave] ?? '').length + 2),
        ),
      }),
    );
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, tabActivo);
    XLSX.writeFile(libro, `salones-${tabActivo}-${fechaArchivo}.xlsx`);
  };

  return (
    <section aria-labelledby="titulo-historial">
      <h2 id="titulo-historial" className="text-2xl font-black text-slate-900 mb-5">
        Todos los salones
      </h2>

      {/* Tabs */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="max-w-full overflow-x-auto pb-1">
          <div className="flex min-w-max bg-slate-100 p-1 rounded-2xl gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActivo(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tabActivo === tab.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.icono} {tab.etiqueta}
              </button>
            ))}
          </div>
        </div>
        {salones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void exportarPDF()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors"
              aria-label="Exportar a PDF"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={() => void exportarExcel()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-bold hover:bg-green-100 transition-colors"
              aria-label="Exportar a Excel"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div aria-busy="true" className="flex justify-center py-10">
          <span className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && salones.length === 0 && (
        <div className="text-center py-10 bg-white rounded-3xl border border-slate-100">
          <p className="text-slate-400 font-semibold">No hay salones en esta categoría.</p>
        </div>
      )}

      {!isLoading && salones.length > 0 && (
        <div className="max-w-full overflow-x-auto rounded-3xl border border-slate-100 bg-white">
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="p-4 font-semibold text-slate-500">Salón</th>
                <th className="p-4 font-semibold text-slate-500">Admin (email)</th>
                <th className="p-4 font-semibold text-slate-500">
                  {tabActivo === 'aprobados'
                    ? 'Aprobado'
                    : tabActivo === 'rechazados'
                      ? 'Rechazado'
                      : 'Fecha solicitud'}
                </th>
                {tabActivo === 'aprobados' && (
                  <th className="p-4 font-semibold text-slate-500">Suscripción</th>
                )}
                {tabActivo === 'aprobados' && (
                  <th className="p-4 font-semibold text-slate-500">Aprobado por</th>
                )}
                {tabActivo === 'rechazados' && (
                  <th className="p-4 font-semibold text-slate-500">Motivo</th>
                )}
                <th className="p-4 font-semibold text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {salones.map((s) => {
                const dueno = s.usuarios[0];
                return (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-4 font-semibold text-slate-900">{s.nombre}</td>
                    <td className="p-4 text-slate-600">
                      <span className="block font-medium">{dueno?.nombre ?? '—'}</span>
                      <span className="text-xs text-slate-400">{dueno?.email ?? '—'}</span>
                    </td>
                    <td className="p-4 text-slate-500">
                      {tabActivo === 'aprobados'
                        ? s.fechaAprobacion
                          ? new Date(s.fechaAprobacion).toLocaleDateString('es-MX')
                          : '—'
                        : new Date(s.fechaSolicitud).toLocaleDateString('es-MX')}
                    </td>
                    {tabActivo === 'aprobados' && (
                      <td className="p-4">
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-lg ${new Date(s.fechaVencimiento) < new Date() ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                        >
                          {s.fechaVencimiento}
                        </span>
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(s.fechaVencimiento) < new Date()
                            ? 'Si cobras hoy, el nuevo mes se contará desde hoy.'
                            : 'Si cobras hoy, el nuevo mes se sumará al vencimiento actual.'}
                        </p>
                      </td>
                    )}
                    {tabActivo === 'aprobados' && (
                      <td className="p-4 text-slate-600">
                        <span className="block font-medium">{s.aprobadoPorNombre ?? '—'}</span>
                        <span className="text-xs text-slate-400">
                          {s.aprobadoPorEmail ?? 'Sin registro'}
                        </span>
                        {s.renovadoPorNombre && (
                          <span className="mt-2 block text-xs text-slate-400">
                            Última renovación: {s.renovadoPorNombre}
                          </span>
                        )}
                      </td>
                    )}
                    {tabActivo === 'rechazados' && (
                      <td className="p-4 text-slate-500 text-xs max-w-48 truncate">
                        {s.motivoRechazo ?? '—'}
                      </td>
                    )}
                    <td className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {tabActivo === 'aprobados' && (
                          <>
                            <CeldaRenovar estudio={s} onRenovado={() => void refetch()} />
                            <BotonSuspender estudio={s} onCambio={() => void refetch()} />
                          </>
                        )}
                        {tabActivo === 'rechazados' && (
                          <button
                            onClick={() => mutReactivar.mutate(s.id)}
                            disabled={mutReactivar.isPending}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors disabled:opacity-50"
                            aria-label={`Reactivar solicitud de ${s.nombre}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reactivar
                            solicitud
                          </button>
                        )}
                        {tabActivo === 'suspendidos' && (
                          <BotonSuspender estudio={s} onCambio={() => void refetch()} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
