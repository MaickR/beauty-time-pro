import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Download,
  AlertTriangle,
  Ban,
  CheckCircle,
  Pencil,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import {
  obtenerSalonesActivos,
  obtenerSalonesSuspendidos,
  obtenerSalonesBloqueados,
  obtenerTodosLosSalonesActivos,
  obtenerTodosLosSalonesSuspendidos,
  obtenerTodosLosSalonesBloqueados,
  suspenderSalon,
  bloquearSalon,
  activarSalon,
  editarSuscripcionSalon,
} from '../../../servicios/servicioAdmin';
import type {
  SalonActivo,
  SalonSuspendido,
  SalonBloqueado,
} from '../../../servicios/servicioAdmin';
import { construirNombreArchivoExportacion } from '../../../utils/archivos';
import { formatearFechaHumana } from '../../../utils/formato';
import { generarContrasenaSegura } from '../../../utils/seguridad';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

interface PropsModalControlSalones {
  onCerrar: () => void;
}

type TabControl = 'activos' | 'suspendidos' | 'bloqueados';

async function cargarModuloExcel() {
  return import('xlsx');
}

const MOTIVOS_BLOQUEO = [
  'Se cierra el salón',
  'Incumple normas',
  'Ya no desea usar la app',
] as const;

export function ModalControlSalones({ onCerrar }: PropsModalControlSalones) {
  const [tab, setTab] = useState<TabControl>('activos');
  const [paginaActivos, setPaginaActivos] = useState(1);
  const [paginaSuspendidos, setPaginaSuspendidos] = useState(1);
  const [paginaBloqueados, setPaginaBloqueados] = useState(1);
  const [modalBloqueo, setModalBloqueo] = useState<string | null>(null);
  const [motivoBloqueo, setMotivoBloqueo] = useState(MOTIVOS_BLOQUEO[0]);
  const [modalEditar, setModalEditar] = useState<SalonActivo | null>(null);
  const [formEditar, setFormEditar] = useState({
    inicioSuscripcion: '',
    fechaVencimiento: '',
    plan: '',
    contrasena: '',
  });
  const [clavesVisibles, setClavesVisibles] = useState<Set<string>>(new Set());
  const [exportacionActiva, setExportacionActiva] = useState<TabControl | null>(null);

  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();

  const invalidar = () => {
    void clienteConsulta.invalidateQueries({ queryKey: ['admin', 'control-salones'] });
    void clienteConsulta.invalidateQueries({ queryKey: ['admin', 'metricas'] });
  };

  const activos = useQuery({
    queryKey: ['admin', 'control-salones', 'activos', paginaActivos],
    queryFn: () => obtenerSalonesActivos(paginaActivos),
    enabled: tab === 'activos',
  });

  const suspendidos = useQuery({
    queryKey: ['admin', 'control-salones', 'suspendidos', paginaSuspendidos],
    queryFn: () => obtenerSalonesSuspendidos(paginaSuspendidos),
    enabled: tab === 'suspendidos',
  });

  const bloqueados = useQuery({
    queryKey: ['admin', 'control-salones', 'bloqueados', paginaBloqueados],
    queryFn: () => obtenerSalonesBloqueados(paginaBloqueados),
    enabled: tab === 'bloqueados',
  });

  const mutSuspender = useMutation({
    mutationFn: suspenderSalon,
    onSuccess: () => {
      invalidar();
      mostrarToast('Salón suspendido');
    },
  });

  const mutBloquear = useMutation({
    mutationFn: (params: { id: string; motivo: string }) => bloquearSalon(params.id, params.motivo),
    onSuccess: () => {
      invalidar();
      setModalBloqueo(null);
      mostrarToast('Salón bloqueado');
    },
  });

  const mutActivar = useMutation({
    mutationFn: activarSalon,
    onSuccess: () => {
      invalidar();
      mostrarToast('Salón activado');
    },
  });

  const mutEditar = useMutation({
    mutationFn: (params: { id: string; datos: Record<string, string> }) =>
      editarSuscripcionSalon(params.id, params.datos),
    onSuccess: (_, variables) => {
      clienteConsulta.setQueriesData<{
        datos: SalonActivo[];
        total: number;
        pagina: number;
        totalPaginas: number;
      }>({ queryKey: ['admin', 'control-salones', 'activos'] }, (actual) => {
        if (!actual) {
          return actual;
        }

        return {
          ...actual,
          datos: actual.datos.map((salon) => {
            if (salon.id !== variables.id) {
              return salon;
            }

            return {
              ...salon,
              periodo: {
                inicio: variables.datos.inicioSuscripcion ?? salon.periodo.inicio,
                fin: variables.datos.fechaVencimiento ?? salon.periodo.fin,
              },
              plan: variables.datos.plan ?? salon.plan,
            };
          }),
        };
      });
      invalidar();
      setModalEditar(null);
      mostrarToast('Suscripción actualizada');
    },
  });

  const abrirEditar = (salon: SalonActivo) => {
    setModalEditar(salon);
    setFormEditar({
      inicioSuscripcion: salon.periodo.inicio,
      fechaVencimiento: salon.periodo.fin,
      plan: salon.plan,
      contrasena: '',
    });
  };

  const guardarEditar = () => {
    if (!modalEditar) return;
    if (formEditar.contrasena && formEditar.contrasena.length < 8) {
      mostrarToast({
        mensaje: 'La nueva contraseña debe tener al menos 8 caracteres',
        variante: 'error',
      });
      return;
    }

    const datos: Record<string, string> = {};
    if (formEditar.inicioSuscripcion) datos.inicioSuscripcion = formEditar.inicioSuscripcion;
    if (formEditar.fechaVencimiento) datos.fechaVencimiento = formEditar.fechaVencimiento;
    if (formEditar.plan) datos.plan = formEditar.plan;
    if (formEditar.contrasena && formEditar.contrasena.length >= 8)
      datos.contrasena = formEditar.contrasena;
    mutEditar.mutate({ id: modalEditar.id, datos });
  };

  const exportarExcel = async (
    nombreArchivo: string,
    tituloHoja: string,
    filas: Record<string, string>[],
  ) => {
    const XLSX = await cargarModuloExcel();
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, tituloHoja);
    XLSX.writeFile(libro, construirNombreArchivoExportacion(nombreArchivo));
  };

  const exportarSalones = async (tabObjetivo: TabControl) => {
    setExportacionActiva(tabObjetivo);

    try {
      if (tabObjetivo === 'activos') {
        const salones = await obtenerTodosLosSalonesActivos();
        await exportarExcel(
          'salones activos',
          'Salones Activos',
          salones.map((salon) => ({
            Salón: salon.nombre,
            Dueño: salon.dueno,
            Correo: salon.correo ?? '',
            Inicio: formatearFechaHumana(salon.periodo.inicio),
            Fin: formatearFechaHumana(salon.periodo.fin),
            Plan: salon.plan,
          })),
        );
      }

      if (tabObjetivo === 'suspendidos') {
        const salones = await obtenerTodosLosSalonesSuspendidos();
        await exportarExcel(
          'salones suspendidos',
          'Salones Suspendidos',
          salones.map((salon) => ({
            Salón: salon.nombre,
            Correo: salon.correo ?? '',
            'Fecha suspensión': salon.fechaSuspension ?? '',
            Plan: salon.plan,
          })),
        );
      }

      if (tabObjetivo === 'bloqueados') {
        const salones = await obtenerTodosLosSalonesBloqueados();
        await exportarExcel(
          'salones bloqueados',
          'Salones Bloqueados',
          salones.map((salon) => ({
            Salón: salon.nombre,
            Correo: salon.correo ?? '',
            'Fecha bloqueo': salon.fechaBloqueo ?? '',
            Motivo: salon.motivoBloqueo ?? '',
          })),
        );
      }
    } catch (error) {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo exportar la lista completa',
        variante: 'error',
      });
    } finally {
      setExportacionActiva(null);
    }
  };

  const alternarClaveVisible = (id: string) => {
    setClavesVisibles((prev) => {
      const copia = new Set(prev);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  };

  const renderPaginacion = (
    pagina: number,
    totalPaginas: number,
    total: number,
    setter: (p: number) => void,
  ) => (
    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
      <p className="text-xs font-bold text-slate-500">
        {total} en total — Página {pagina} de {totalPaginas || 1}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setter(Math.max(1, pagina - 1))}
          disabled={pagina <= 1}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          onClick={() => setter(pagina < totalPaginas ? pagina + 1 : pagina)}
          disabled={pagina >= totalPaginas}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-control-salones-titulo"
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="modal-control-salones-titulo"
            className="text-lg font-black text-slate-900 uppercase"
          >
            Control de salones
          </h2>
          <button
            onClick={onCerrar}
            className="p-2 rounded-full hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-slate-200 px-6">
          {(
            [
              ['activos', 'Activos'],
              ['suspendidos', 'Suspendidos'],
              ['bloqueados', 'Bloqueados'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-xs font-black uppercase border-b-2 transition-all ${tab === key ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* Tab Activos */}
          {tab === 'activos' && (
            <>
              {activos.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <EsqueletoTarjeta key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Salón
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Dueño
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Correo
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Periodo
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Plan
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Clave del dueño
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activos.data?.datos.map((s: SalonActivo) => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 px-2 font-bold text-slate-900">{s.nombre}</td>
                          <td className="py-3 px-2 text-slate-600">{s.dueno}</td>
                          <td className="py-3 px-2 text-slate-600 text-xs">{s.correo}</td>
                          <td className="py-3 px-2 text-slate-600 text-xs">
                            {formatearFechaHumana(s.periodo.inicio)} —{' '}
                            {formatearFechaHumana(s.periodo.fin)}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${s.plan === 'PRO' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                              {s.plan}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono text-slate-600">
                                {clavesVisibles.has(s.id) ? s.claveDueno : '••••••••'}
                              </span>
                              <button
                                onClick={() => alternarClaveVisible(s.id)}
                                className="p-1 rounded hover:bg-slate-100"
                                aria-label={
                                  clavesVisibles.has(s.id) ? 'Ocultar clave' : 'Mostrar clave'
                                }
                              >
                                {clavesVisibles.has(s.id) ? (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => mutSuspender.mutate(s.id)}
                                title="Suspender"
                                aria-label="Suspender salón"
                                className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setModalBloqueo(s.id)}
                                title="Bloquear"
                                aria-label="Bloquear salón"
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => abrirEditar(s)}
                                title="Editar"
                                aria-label="Editar suscripción"
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => void exportarSalones('activos')}
                      disabled={exportacionActiva === 'activos'}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {exportacionActiva === 'activos' ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                  </div>
                </div>
              )}
              {activos.data &&
                renderPaginacion(
                  paginaActivos,
                  activos.data.totalPaginas,
                  activos.data.total,
                  setPaginaActivos,
                )}
            </>
          )}

          {/* Tab Suspendidos */}
          {tab === 'suspendidos' && (
            <>
              {suspendidos.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <EsqueletoTarjeta key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Salón
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Correo
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Fecha suspensión
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Plan
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Clave del dueño
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {suspendidos.data?.datos.map((s: SalonSuspendido) => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 px-2 font-bold text-slate-900">{s.nombre}</td>
                          <td className="py-3 px-2 text-slate-600 text-xs">{s.correo}</td>
                          <td className="py-3 px-2 text-slate-600 text-xs">
                            {s.fechaSuspension ? formatearFechaHumana(s.fechaSuspension) : '—'}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${s.plan === 'PRO' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                              {s.plan}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono text-slate-600">
                                {clavesVisibles.has(s.id) ? s.claveDueno : '••••••••'}
                              </span>
                              <button
                                onClick={() => alternarClaveVisible(s.id)}
                                className="p-1 rounded hover:bg-slate-100"
                                aria-label={
                                  clavesVisibles.has(s.id) ? 'Ocultar clave' : 'Mostrar clave'
                                }
                              >
                                {clavesVisibles.has(s.id) ? (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <button
                              onClick={() => mutActivar.mutate(s.id)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-700"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Activar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!suspendidos.data?.datos || suspendidos.data.datos.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                            No hay salones suspendidos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => void exportarSalones('suspendidos')}
                      disabled={exportacionActiva === 'suspendidos'}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {exportacionActiva === 'suspendidos' ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                  </div>
                </div>
              )}
              {suspendidos.data &&
                renderPaginacion(
                  paginaSuspendidos,
                  suspendidos.data.totalPaginas,
                  suspendidos.data.total,
                  setPaginaSuspendidos,
                )}
            </>
          )}

          {/* Tab Bloqueados */}
          {tab === 'bloqueados' && (
            <>
              {bloqueados.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <EsqueletoTarjeta key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Salón
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Correo
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Fecha bloqueo
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Motivo
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Clave del dueño
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bloqueados.data?.datos.map((s: SalonBloqueado) => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 px-2 font-bold text-slate-900">{s.nombre}</td>
                          <td className="py-3 px-2 text-slate-600 text-xs">{s.correo}</td>
                          <td className="py-3 px-2 text-slate-600 text-xs">
                            {s.fechaBloqueo ? formatearFechaHumana(s.fechaBloqueo) : '—'}
                          </td>
                          <td className="py-3 px-2 text-slate-600 text-xs">
                            {s.motivoBloqueo ?? '—'}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono text-slate-600">
                                {clavesVisibles.has(s.id) ? s.claveDueno : '••••••••'}
                              </span>
                              <button
                                onClick={() => alternarClaveVisible(s.id)}
                                className="p-1 rounded hover:bg-slate-100"
                                aria-label={
                                  clavesVisibles.has(s.id) ? 'Ocultar clave' : 'Mostrar clave'
                                }
                              >
                                {clavesVisibles.has(s.id) ? (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <button
                              onClick={() => mutActivar.mutate(s.id)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-700"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Activar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!bloqueados.data?.datos || bloqueados.data.datos.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                            No hay salones bloqueados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => void exportarSalones('bloqueados')}
                      disabled={exportacionActiva === 'bloqueados'}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {exportacionActiva === 'bloqueados' ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                  </div>
                </div>
              )}
              {bloqueados.data &&
                renderPaginacion(
                  paginaBloqueados,
                  bloqueados.data.totalPaginas,
                  bloqueados.data.total,
                  setPaginaBloqueados,
                )}
            </>
          )}
        </div>
      </div>

      {/* Mini-modal de bloqueo */}
      {modalBloqueo && (
        <div
          className="fixed inset-0 z-210 flex items-center justify-center bg-black/50 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setModalBloqueo(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-base font-black text-slate-900 mb-4">Bloquear salón</h3>
            <label className="block text-xs font-bold text-slate-500 mb-1">Motivo</label>
            <select
              value={motivoBloqueo}
              onChange={(e) => setMotivoBloqueo(e.target.value as typeof motivoBloqueo)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500 mb-4"
            >
              {MOTIVOS_BLOQUEO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalBloqueo(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutBloquear.mutate({ id: modalBloqueo, motivo: motivoBloqueo })}
                disabled={mutBloquear.isPending}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {mutBloquear.isPending ? 'Bloqueando...' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-modal de edición */}
      {modalEditar && (
        <div
          className="fixed inset-0 z-210 flex items-center justify-center bg-black/50 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setModalEditar(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-base font-black text-slate-900 mb-4">
              Editar suscripción — {modalEditar.nombre}
            </h3>
            <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              La tabla muestra la clave interna del dueño. Si cambias la contraseña, se guarda en el
              backend, pero no se vuelve a exponer en pantalla.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  value={formEditar.inicioSuscripcion}
                  onChange={(e) =>
                    setFormEditar((f) => ({ ...f, inicioSuscripcion: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Fecha de vencimiento
                </label>
                <input
                  type="date"
                  value={formEditar.fechaVencimiento}
                  onChange={(e) =>
                    setFormEditar((f) => ({ ...f, fechaVencimiento: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Plan</label>
                <select
                  value={formEditar.plan}
                  onChange={(e) => setFormEditar((f) => ({ ...f, plan: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="STANDARD">Estándar</option>
                  <option value="PRO">Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Nueva contraseña del dueño (opcional, mín 8)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formEditar.contrasena}
                    onChange={(e) => setFormEditar((f) => ({ ...f, contrasena: e.target.value }))}
                    placeholder="Dejar vacío para mantener actual"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormEditar((f) => ({ ...f, contrasena: generarContrasenaSegura(16) }))
                    }
                    title="Generar contraseña segura"
                    aria-label="Generar contraseña segura"
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setModalEditar(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEditar}
                disabled={mutEditar.isPending}
                className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 disabled:opacity-50"
              >
                {mutEditar.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
