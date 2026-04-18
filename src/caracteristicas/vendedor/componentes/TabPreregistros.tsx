import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Clock, CheckCircle, XCircle, FileText, Search } from 'lucide-react';
import { obtenerMisPreregistros, crearPreregistro } from '../../../servicios/servicioVendedor';
import type { PreregistroSalon } from '../../../servicios/servicioVendedor';
import { ModalEstudio } from '../../maestro/componentes/ModalEstudio';
import {
  usarFormularioEstudio,
  type FormularioEstudio,
} from '../../maestro/hooks/usarFormularioEstudio';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

const CLAVE_BORRADOR_PREREGISTRO = 'vendedor_preregistro_salon_borrador_v2';

const ESTADOS_BADGE: Record<string, { etiqueta: string; color: string; icono: typeof Clock }> = {
  pendiente: { etiqueta: 'Pendiente', color: 'bg-amber-100 text-amber-700', icono: Clock },
  aprobado: { etiqueta: 'Aprobado', color: 'bg-green-100 text-green-700', icono: CheckCircle },
  rechazado: { etiqueta: 'Rechazado', color: 'bg-red-100 text-red-700', icono: XCircle },
};

function construirCategoriasPreregistro(formulario: FormularioEstudio): string | undefined {
  const categorias = Array.from(
    new Set(
      formulario.customServices
        .map((servicio) => servicio.category?.trim())
        .filter((categoria): categoria is string => Boolean(categoria)),
    ),
  );

  if (categorias.length > 0) {
    return categorias.join(', ').slice(0, 240);
  }

  const servicios = formulario.selectedServices
    .map((servicio) => servicio.name.trim())
    .filter(Boolean);
  return servicios.length > 0 ? servicios.join(', ').slice(0, 240) : undefined;
}

function construirNotasPreregistro(formulario: FormularioEstudio): string | undefined {
  const sitioWeb = formulario.website?.trim() ?? '';
  const lineas = [
    sitioWeb ? `Website: ${sitioWeb}` : null,
    formulario.subscriptionStart ? `Operations start: ${formulario.subscriptionStart}` : null,
    `Registration type: ${formulario.tipoVinculacion === 'SEDE' ? 'Branch' : 'Independent salon'}`,
    formulario.estudioPrincipalId ? `Primary salon ID: ${formulario.estudioPrincipalId}` : null,
    `Public bookings: ${formulario.permiteReservasPublicas ? 'Enabled' : 'Disabled'}`,
    formulario.branches.length > 0 ? `Branches: ${formulario.branches.join(', ')}` : null,
    formulario.selectedServices.length > 0
      ? `Services: ${formulario.selectedServices.map((servicio) => servicio.name).join(', ')}`
      : null,
    formulario.staff.length > 0
      ? `Staff: ${formulario.staff.map((persona) => persona.name).join(', ')}`
      : null,
    formulario.productos.length > 0
      ? `Products: ${formulario.productos.map((producto) => producto.nombre).join(', ')}`
      : null,
  ].filter((linea): linea is string => Boolean(linea));

  return lineas.length > 0 ? lineas.join('\n').slice(0, 500) : undefined;
}

// ─── Componente ──────────────────────────────────────────────────────────
export function TabPreregistros() {
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [estado, setEstado] = useState<'pendiente' | 'aprobado' | 'rechazado' | ''>('');
  const [pagina, setPagina] = useState(1);
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();

  const mutacion = useMutation({
    mutationFn: crearPreregistro,
  });

  const hookFormulario = usarFormularioEstudio({
    claveBorrador: CLAVE_BORRADOR_PREREGISTRO,
    procesarAlta: async ({ formulario }) => {
      const resultado = await mutacion.mutateAsync({
        nombreSalon: formulario.name,
        propietario: formulario.owner,
        emailPropietario: formulario.emailDueno,
        telefonoPropietario: formulario.phone,
        pais: formulario.country,
        direccion: formulario.direccion || undefined,
        categorias: construirCategoriasPreregistro(formulario),
        plan: formulario.plan,
        notas: construirNotasPreregistro(formulario),
      });

      return {
        mensajeExito: `Pre-registro "${resultado.nombreSalon}" enviado correctamente.`,
        cerrarModal: true,
      };
    },
  });

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setBusquedaAplicada(busquedaTexto.trim());
      setPagina(1);
    }, 300);

    return () => window.clearTimeout(temporizador);
  }, [busquedaTexto]);

  const { data, isLoading } = useQuery({
    queryKey: ['vendedor', 'preregistros', busquedaAplicada, estado, pagina],
    queryFn: () =>
      obtenerMisPreregistros({
        busqueda: busquedaAplicada,
        estado: estado || undefined,
        pagina,
        limite: 10,
      }),
    staleTime: 1000 * 60 * 2,
  });

  const preregistros = data?.datos ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 10));
  const pendientesVisibles = preregistros.filter((item) => item.estado === 'pendiente').length;
  const aprobadosVisibles = preregistros.filter((item) => item.estado === 'aprobado').length;
  const rechazadosVisibles = preregistros.filter((item) => item.estado === 'rechazado').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
              Pre-registros
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">
              Captura prospectos de salones y mantén visible su estado.
            </h2>
          </div>
          <button
            onClick={() => {
              hookFormulario.abrirModalAlta();
            }}
            className="no-imprimir bg-pink-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 hover:bg-pink-700 transition-all"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            Registrar nuevo salón
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busquedaTexto}
              onChange={(evento) => setBusquedaTexto(evento.target.value)}
              className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm text-slate-900"
              placeholder="Buscar por salón o propietario"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={estado}
              onChange={(evento) => {
                setEstado(evento.target.value as typeof estado);
                setPagina(1);
              }}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setBusquedaTexto('');
                setBusquedaAplicada('');
                setEstado('');
                setPagina(1);
              }}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaResumenPreregistro etiqueta="Total filtrado" valor={total} tono="claro" />
          <TarjetaResumenPreregistro
            etiqueta="Pendientes visibles"
            valor={pendientesVisibles}
            tono="pendiente"
          />
          <TarjetaResumenPreregistro
            etiqueta="Aprobados visibles"
            valor={aprobadosVisibles}
            tono="aprobado"
          />
          <TarjetaResumenPreregistro
            etiqueta="Rechazados visibles"
            valor={rechazadosVisibles}
            tono="rechazado"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {busquedaTexto !== busquedaAplicada
            ? 'Updating search results...'
            : 'Search is debounced to avoid unnecessary requests while you type.'}
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <p>{total} pre-registros encontrados.</p>
        <p>
          Página {pagina} de {totalPaginas}
        </p>
      </div>

      {hookFormulario.modoModal && (
        <ModalEstudio
          modo={hookFormulario.modoModal}
          formulario={hookFormulario.formulario}
          setFormulario={hookFormulario.setFormulario}
          catalogoProps={{
            alternarServicio: hookFormulario.alternarServicio,
            actualizarCampoServicio: hookFormulario.actualizarCampoServicio,
            agregarServicioPersonalizado: hookFormulario.agregarServicioPersonalizado,
            entradaServicioPersonalizado: hookFormulario.entradaServicioPersonalizado,
            setEntradaServicioPersonalizado: hookFormulario.setEntradaServicioPersonalizado,
          }}
          onAgregarPersonal={hookFormulario.agregarPersonal}
          onEnviar={(evento) =>
            void hookFormulario.enviarFormulario(
              evento,
              async () => {
                await clienteConsulta.invalidateQueries({ queryKey: ['vendedor'] });
              },
              (mensaje) =>
                mostrarToast({
                  mensaje,
                  variante: 'exito',
                  icono: '✓',
                }),
              (mensaje) =>
                mostrarToast({
                  mensaje,
                  variante: 'error',
                  icono: '✗',
                }),
            )
          }
          onCerrar={hookFormulario.cerrarModal}
          confirmacionAlta={hookFormulario.confirmacionAlta}
          onRegenerarContrasenaDueno={hookFormulario.regenerarContrasenaDueno}
        />
      )}

      {/* Lista de preregistros */}
      {!preregistros || preregistros.length === 0 ? (
        <div className="rounded-4xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-slate-500 font-medium">Aún no tienes pre-registros</p>
          <p className="text-slate-400 text-sm mt-1">
            Usa el botón superior para capturar tu siguiente prospecto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {preregistros.map((pr) => (
            <TarjetaPreregistro key={pr.id} preregistro={pr} />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((valor) => Math.max(1, valor - 1))}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

function TarjetaResumenPreregistro({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: number;
  tono: 'claro' | 'pendiente' | 'aprobado' | 'rechazado';
}) {
  const estilos =
    tono === 'pendiente'
      ? 'bg-amber-50 border-amber-100 text-amber-900'
      : tono === 'aprobado'
        ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
        : tono === 'rechazado'
          ? 'bg-rose-50 border-rose-100 text-rose-900'
          : 'bg-white border-slate-200 text-slate-900';

  return (
    <article className={`rounded-3xl border p-4 ${estilos}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70">{etiqueta}</p>
      <p className="mt-2 text-3xl font-black">{valor}</p>
    </article>
  );
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────

function TarjetaPreregistro({ preregistro: pr }: { preregistro: PreregistroSalon }) {
  const badge = ESTADOS_BADGE[pr.estado] ?? ESTADOS_BADGE.pendiente;
  const Icono = badge.icono;

  return (
    <article className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900">{pr.nombreSalon}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {pr.propietario} &middot; {pr.emailPropietario}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {pr.pais} &middot; {pr.plan} &middot; {new Date(pr.creadoEn).toLocaleDateString()}
          </p>
          {pr.estado === 'rechazado' && pr.motivoRechazo && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg">
              <strong>Motivo:</strong> {pr.motivoRechazo}
            </p>
          )}
        </div>
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${badge.color}`}
        >
          <Icono className="w-3.5 h-3.5" aria-hidden="true" />
          {badge.etiqueta}
        </span>
      </div>
    </article>
  );
}
