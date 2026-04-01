import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
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
  pendiente: { etiqueta: 'Pending', color: 'bg-amber-100 text-amber-700', icono: Clock },
  aprobado: { etiqueta: 'Approved', color: 'bg-green-100 text-green-700', icono: CheckCircle },
  rechazado: { etiqueta: 'Rejected', color: 'bg-red-100 text-red-700', icono: XCircle },
};

const FILTROS_ESTADO = [
  { valor: '', etiqueta: 'All' },
  { valor: 'pendiente', etiqueta: 'Pending' },
  { valor: 'aprobado', etiqueta: 'Approved' },
  { valor: 'rechazado', etiqueta: 'Rejected' },
];

// ─── Componente principal ────────────────────────────────────────────────────

export function PreregistrosAdmin() {
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'preregistros', filtroEstado, pagina],
    queryFn: () =>
      obtenerPreregistrosAdmin({ estado: filtroEstado || undefined, pagina, limite: 10 }),
    staleTime: 1000 * 60 * 2,
  });

  const mutacionAprobar = useMutation({
    mutationFn: (id: string) => aprobarPreregistro(id),
    onSuccess: (res) => {
      clienteConsulta.invalidateQueries({ queryKey: ['admin', 'preregistros'] });
      mostrarToast(
        `Salon created. Email: ${res.datos.acceso.emailDueno} — Password: ${res.datos.acceso.contrasena}`,
      );
    },
    onError: () => mostrarToast('Could not approve this pre-registration.'),
  });

  const mutacionRechazar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => rechazarPreregistro(id, motivo),
    onSuccess: () => {
      clienteConsulta.invalidateQueries({ queryKey: ['admin', 'preregistros'] });
      setRechazandoId(null);
      setMotivoRechazo('');
      mostrarToast('Pre-registration rejected.');
    },
    onError: () => mostrarToast('Could not reject this pre-registration.'),
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
          <h2 className="text-2xl font-black text-slate-900">Vendor Pre-registrations</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Review and approve salon pre-registrations submitted by vendors.
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
            aria-label="Loading"
          />
        </div>
      )}

      {/* Vacío */}
      {!isLoading && preregistros.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-slate-500 font-medium">No pre-registrations found</p>
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
              onAprobar={() => mutacionAprobar.mutate(pr.id)}
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
            Previous
          </button>
          <span className="px-4 py-2 text-sm font-semibold text-slate-600">
            {pagina} / {totalPaginas}
          </span>
          <button
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 hover:bg-slate-200 transition-colors"
          >
            Next
          </button>
        </div>
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
              {pr.propietario} · {pr.vendedor?.nombre ?? 'Vendor'}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{pr.emailPropietario}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{pr.telefonoPropietario}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {pr.pais}
                {pr.direccion ? ` — ${pr.direccion}` : ''}
              </span>
            </div>
            <div className="text-slate-600">
              <span className="font-semibold">Plan:</span> {pr.plan}
            </div>
          </div>

          {pr.categorias && (
            <div className="text-sm text-slate-600">
              <span className="font-semibold">Categories:</span> {pr.categorias}
            </div>
          )}
          {pr.descripcion && (
            <div className="text-sm text-slate-600">
              <span className="font-semibold">Description:</span> {pr.descripcion}
            </div>
          )}
          {pr.notas && (
            <div className="text-sm text-slate-500 italic">
              <span className="font-semibold not-italic">Notes:</span> {pr.notas}
            </div>
          )}
          <div className="text-sm text-slate-500">
            <span className="font-semibold">Vendor:</span> {pr.vendedor?.nombre ?? '—'} (
            {pr.vendedor?.email})
          </div>

          {pr.estado === 'rechazado' && pr.motivoRechazo && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
              <span className="font-bold">Rejection reason:</span> {pr.motivoRechazo}
            </div>
          )}

          {pr.estado === 'aprobado' && pr.estudioCreadoId && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
              <span className="font-bold">Salon created:</span> ID {pr.estudioCreadoId}
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
                    Rejection reason (min 10 characters)
                  </label>
                  <textarea
                    id={`motivo-${pr.id}`}
                    value={motivoRechazo}
                    onChange={(e) => onSetMotivoRechazo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    rows={3}
                    placeholder="Explain the reason for rejection..."
                    aria-describedby={`motivo-desc-${pr.id}`}
                  />
                  <p id={`motivo-desc-${pr.id}`} className="text-xs text-slate-400">
                    {motivoRechazo.length}/500 characters
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        onSetRechazandoId(null);
                        onSetMotivoRechazo('');
                      }}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onRechazar}
                      disabled={motivoRechazo.trim().length < 10 || rechazando}
                      className="px-5 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {rechazando ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => onSetRechazandoId(pr.id)}
                    className="px-5 py-2.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={onAprobar}
                    disabled={aprobando}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {aprobando ? 'Approving...' : 'Approve & Create Salon'}
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
