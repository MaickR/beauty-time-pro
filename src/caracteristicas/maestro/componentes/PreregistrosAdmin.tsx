import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Copy,
  Download,
  Link as IconoEnlace,
  X,
} from 'lucide-react';
import {
  obtenerPreregistrosAdmin,
  aprobarPreregistro,
  rechazarPreregistro,
} from '../../../servicios/servicioAdmin';
import type { PreregistroAdmin } from '../../../servicios/servicioAdmin';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

// ─── Constantes ──────────────────────────────────────────────────────────────

const ESTADOS_BADGE: Record<string, { etiqueta: string; color: string; icono: typeof Clock }> = {
  pendiente: { etiqueta: 'Pendiente', color: 'bg-amber-100 text-amber-700', icono: Clock },
  aprobado: { etiqueta: 'Aprobado', color: 'bg-green-100 text-green-700', icono: CheckCircle },
  rechazado: { etiqueta: 'Rechazado', color: 'bg-red-100 text-red-700', icono: XCircle },
};

const FILTROS_ESTADO = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'aprobado', etiqueta: 'Aprobados' },
  { valor: 'rechazado', etiqueta: 'Rechazados' },
];

interface ConfirmacionAprobacionPreregistro {
  nombreSalon: string;
  nombreDueno: string;
  emailDueno: string;
  contrasenaDueno: string;
  claveClientes: string;
  urlReserva: string;
}

type RespuestaPreregistrosCache = Awaited<ReturnType<typeof obtenerPreregistrosAdmin>>;

// ─── Componente principal ────────────────────────────────────────────────────

export function PreregistrosAdmin() {
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [confirmacionAprobacion, setConfirmacionAprobacion] =
    useState<ConfirmacionAprobacionPreregistro | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'preregistros', filtroEstado, pagina],
    queryFn: () =>
      obtenerPreregistrosAdmin({ estado: filtroEstado || undefined, pagina, limite: 10 }),
    staleTime: 1000 * 60 * 2,
  });

  const mutacionAprobar = useMutation({
    mutationFn: ({ id }: { id: string; preregistro: PreregistroAdmin }) => aprobarPreregistro(id),
    onSuccess: (res, variables) => {
      clienteConsulta.setQueryData<RespuestaPreregistrosCache>(
        ['admin', 'preregistros', filtroEstado, pagina],
        (actual) => {
          if (!actual) return actual;

          const actualizados = actual.datos.map((registro) =>
            registro.id === variables.id
              ? {
                  ...registro,
                  estado: 'aprobado',
                  estudioCreadoId: res.datos.estudioId,
                  actualizadoEn: new Date().toISOString(),
                }
              : registro,
          );

          if (filtroEstado === 'pendiente') {
            return {
              ...actual,
              datos: actualizados.filter((registro) => registro.id !== variables.id),
              total: Math.max(0, actual.total - 1),
            };
          }

          return { ...actual, datos: actualizados };
        },
      );

      clienteConsulta.invalidateQueries({ queryKey: ['admin', 'preregistros'] });
      clienteConsulta.invalidateQueries({ queryKey: ['admin', 'directorio'] });
      clienteConsulta.invalidateQueries({ queryKey: ['admin', 'metricas'] });
      setConfirmacionAprobacion({
        nombreSalon: variables.preregistro.nombreSalon,
        nombreDueno: variables.preregistro.propietario,
        emailDueno: res.datos.acceso.emailDueno,
        contrasenaDueno: res.datos.acceso.contrasena,
        claveClientes: res.datos.acceso.claveClientes,
        urlReserva: `${window.location.origin}/reservar/${res.datos.acceso.claveClientes}`,
      });
      mostrarToast('Pre-registro aprobado. El salón fue creado correctamente.');
    },
    onError: () => mostrarToast('No se pudo aprobar este pre-registro.'),
  });

  const mutacionRechazar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => rechazarPreregistro(id, motivo),
    onSuccess: () => {
      clienteConsulta.invalidateQueries({ queryKey: ['admin', 'preregistros'] });
      setRechazandoId(null);
      setMotivoRechazo('');
      mostrarToast('Pre-registro rechazado.');
    },
    onError: () => mostrarToast('No se pudo rechazar este pre-registro.'),
  });

  const preregistros = data?.datos ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.ceil(total / 10);

  const alternarExpandido = (id: string) => {
    setExpandido((prev) => (prev === id ? null : id));
    setRechazandoId(null);
    setMotivoRechazo('');
  };

  return (
    <section>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Pre-registros</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Revisa y aprueba los pre-registros de salones enviados por vendedores.
          </p>
        </div>

        {/* Filtro de estado */}
        <div className="flex gap-2 flex-wrap">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.valor}
              onClick={() => {
                setFiltroEstado(f.valor);
                setPagina(1);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                filtroEstado === f.valor
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-16">
          <div
            className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full mx-auto"
            role="status"
            aria-label="Cargando"
          />
        </div>
      )}

      {/* Vacío */}
      {!isLoading && preregistros.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-slate-500 font-medium">No se encontraron pre-registros</p>
        </div>
      )}

      {/* Lista */}
      {!isLoading && preregistros.length > 0 && (
        <div className="space-y-3">
          {preregistros.map((pr) => (
            <TarjetaPreregistro
              key={pr.id}
              preregistro={pr}
              expandido={expandido === pr.id}
              onAlternar={() => alternarExpandido(pr.id)}
              rechazandoId={rechazandoId}
              motivoRechazo={motivoRechazo}
              onSetRechazandoId={setRechazandoId}
              onSetMotivoRechazo={setMotivoRechazo}
              onAprobar={() => mutacionAprobar.mutate({ id: pr.id, preregistro: pr })}
              onRechazar={() => mutacionRechazar.mutate({ id: pr.id, motivo: motivoRechazo })}
              aprobando={mutacionAprobar.isPending}
              rechazando={mutacionRechazar.isPending}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 hover:bg-slate-200 transition-colors"
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-sm font-semibold text-slate-600">
            {pagina} / {totalPaginas}
          </span>
          <button
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 hover:bg-slate-200 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {confirmacionAprobacion && (
        <ModalConfirmacionPreregistro
          confirmacion={confirmacionAprobacion}
          onCerrar={() => setConfirmacionAprobacion(null)}
        />
      )}
    </section>
  );
}

// ─── Tarjeta individual ──────────────────────────────────────────────────────

interface PropsTarjeta {
  preregistro: PreregistroAdmin;
  expandido: boolean;
  onAlternar: () => void;
  rechazandoId: string | null;
  motivoRechazo: string;
  onSetRechazandoId: (id: string | null) => void;
  onSetMotivoRechazo: (motivo: string) => void;
  onAprobar: () => void;
  onRechazar: () => void;
  aprobando: boolean;
  rechazando: boolean;
}

function TarjetaPreregistro({
  preregistro: pr,
  expandido,
  onAlternar,
  rechazandoId,
  motivoRechazo,
  onSetRechazandoId,
  onSetMotivoRechazo,
  onAprobar,
  onRechazar,
  aprobando,
  rechazando,
}: PropsTarjeta) {
  const badge = ESTADOS_BADGE[pr.estado] ?? ESTADOS_BADGE.pendiente!;
  const Icono = badge.icono;
  const esPendiente = pr.estado === 'pendiente';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onAlternar}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
        aria-expanded={expandido}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-pink-600" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{pr.nombreSalon}</p>
            <p className="text-xs text-slate-500 truncate">
              {pr.propietario} · {pr.vendedor?.nombre ?? 'Vendedor'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${badge.color}`}
          >
            <Icono className="w-3.5 h-3.5" />
            {badge.etiqueta}
          </span>
          <span className="text-xs text-slate-400">
            {new Date(pr.creadoEn).toLocaleDateString()}
          </span>
          {expandido ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Detalle expandido */}
      {expandido && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
            <p className="text-slate-700">
              <span className="font-black text-slate-900">Nombre del salón:</span> {pr.nombreSalon}
            </p>
            <p className="text-slate-700">
              <span className="font-black text-slate-900">Administrador:</span> {pr.propietario}
            </p>
            <p className="text-slate-700">
              <span className="font-black text-slate-900">Dirección:</span>{' '}
              {pr.direccion?.trim() || 'Sin dirección registrada'}
            </p>
            <p className="text-slate-700">
              <span className="font-black text-slate-900">País:</span> {pr.pais}
            </p>
            <p className="text-slate-700">
              <span className="font-black text-slate-900">Teléfono:</span> {pr.telefonoPropietario}
            </p>
            <p className="text-slate-700 break-all">
              <span className="font-black text-slate-900">Correo:</span> {pr.emailPropietario}
            </p>
            <p className="text-slate-700 md:col-span-2">
              <span className="font-black text-slate-900">Plan:</span> {pr.plan}
            </p>
          </div>

          {pr.categorias && (
            <div className="text-sm text-slate-600">
              <span className="font-semibold">Categorías:</span> {pr.categorias}
            </div>
          )}
          {pr.descripcion && (
            <div className="text-sm text-slate-600">
              <span className="font-semibold">Descripción:</span> {pr.descripcion}
            </div>
          )}
          {pr.notas && (
            <div className="text-sm text-slate-500 italic">
              <span className="font-semibold not-italic">Notas:</span> {pr.notas}
            </div>
          )}
          <div className="text-sm text-slate-500">
            <span className="font-semibold">Vendedor:</span> {pr.vendedor?.nombre ?? '—'} (
            {pr.vendedor?.email})
          </div>

          {pr.estado === 'rechazado' && pr.motivoRechazo && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
              <span className="font-bold">Motivo del rechazo:</span> {pr.motivoRechazo}
            </div>
          )}

          {pr.estado === 'aprobado' && pr.estudioCreadoId && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
              <span className="font-bold">Salón creado:</span> ID {pr.estudioCreadoId}
            </div>
          )}

          {/* Acciones solo para pendientes */}
          {esPendiente && (
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              {rechazandoId === pr.id ? (
                <div className="space-y-3">
                  <label
                    htmlFor={`motivo-${pr.id}`}
                    className="text-sm font-semibold text-slate-700"
                  >
                    Motivo del rechazo (mínimo 10 caracteres)
                  </label>
                  <textarea
                    id={`motivo-${pr.id}`}
                    value={motivoRechazo}
                    onChange={(e) => onSetMotivoRechazo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    rows={3}
                    placeholder="Explica el motivo del rechazo..."
                    aria-describedby={`motivo-desc-${pr.id}`}
                  />
                  <p id={`motivo-desc-${pr.id}`} className="text-xs text-slate-400">
                    {motivoRechazo.length}/500 caracteres
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        onSetRechazandoId(null);
                        onSetMotivoRechazo('');
                      }}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={onRechazar}
                      disabled={motivoRechazo.trim().length < 10 || rechazando}
                      className="px-5 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {rechazando ? 'Rechazando...' : 'Confirmar rechazo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => onSetRechazandoId(pr.id)}
                    className="px-5 py-2.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={onAprobar}
                    disabled={aprobando}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {aprobando ? 'Aprobando...' : 'Aprobar y crear salón'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModalConfirmacionPreregistro({
  confirmacion,
  onCerrar,
}: {
  confirmacion: ConfirmacionAprobacionPreregistro;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(confirmacion.urlReserva)}`;

  const copiarTexto = async (clave: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(clave);
      window.setTimeout(() => setCopiado((actual) => (actual === clave ? null : actual)), 1600);
    } catch {
      // Silenciar fallo de portapapeles
    }
  };

  const descargarQr = () => {
    const enlace = document.createElement('a');
    enlace.href = qrUrl;
    enlace.download = `qr-${confirmacion.nombreSalon.replace(/\s+/g, '-').toLowerCase()}.png`;
    enlace.click();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-confirmacion-preregistro"
      className="fixed inset-0 z-220 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-4xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-slate-50 p-5 sm:p-7">
          <div>
            <h3 id="titulo-confirmacion-preregistro" className="text-xl font-black text-slate-900">
              Registro completado
            </h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Comparte estos datos con el dueño del salón.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">
              Acceso del dueño
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-black text-slate-900">Salón:</span> {confirmacion.nombreSalon}
              </p>
              <p>
                <span className="font-black text-slate-900">Dueño:</span> {confirmacion.nombreDueno}
              </p>
              <p>
                <span className="font-black text-slate-900">Correo:</span> {confirmacion.emailDueno}
              </p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Contraseña inicial
                </span>
                <button
                  type="button"
                  onClick={() => void copiarTexto('contrasena', confirmacion.contrasenaDueno)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-black text-slate-600"
                >
                  <Copy className="h-3.5 w-3.5" /> {copiado === 'contrasena' ? 'Copiada' : 'Copiar'}
                </button>
              </div>
              <code className="block break-all rounded-xl bg-slate-950 px-3 py-2 font-mono text-sm font-black text-emerald-300">
                {confirmacion.contrasenaDueno}
              </code>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">
                QR descargable
              </p>
              <button
                type="button"
                onClick={descargarQr}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white"
              >
                <Download className="h-3.5 w-3.5" /> Descargar
              </button>
            </div>
            <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <img src={qrUrl} alt="QR para reservas públicas" className="h-52 w-52 rounded-2xl" />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-900 bg-slate-950 p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-300">
              Acceso público a reservas
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Clave acceso clientes
                  </span>
                  <button
                    type="button"
                    onClick={() => void copiarTexto('clave', confirmacion.claveClientes)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-[11px] font-black text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> {copiado === 'clave' ? 'Copiada' : 'Copiar'}
                  </button>
                </div>
                <code className="block break-all font-mono text-lg font-black text-pink-300">
                  {confirmacion.claveClientes}
                </code>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    URL para compartir
                  </span>
                  <button
                    type="button"
                    onClick={() => void copiarTexto('url', confirmacion.urlReserva)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-[11px] font-black text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> {copiado === 'url' ? 'Copiada' : 'Copiar'}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-200">
                  <IconoEnlace className="h-4 w-4 shrink-0" />
                  <span className="break-all">{confirmacion.urlReserva}</span>
                </div>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-2xl bg-pink-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-pink-700"
          >
            Cerrar confirmación
          </button>
        </div>
      </div>
    </div>
  );
}
