import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  PlusCircle,
  Search,
  UserRoundCheck,
  X,
  XCircle,
} from 'lucide-react';
import { crearPreregistro, obtenerMisPreregistros } from '../../../servicios/servicioVendedor';
import type { DatosPreregistro, PreregistroSalon } from '../../../servicios/servicioVendedor';
import {
  esEmailSalonValido,
  limpiarNombrePersonaEntrada,
  limpiarNombreSalonEntrada,
  limpiarTelefonoEntrada,
} from '../../../utils/formularioSalon';
import { formatearFechaHumana } from '../../../utils/formato';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

const CLAVE_BORRADOR_PREREGISTRO = 'vendedor_preregistro_form_v3';

type EstadoPreregistro = '' | 'pendiente' | 'aprobado' | 'rechazado';

interface FormularioPreregistro {
  nombreSalon: string;
  propietario: string;
  emailPropietario: string;
  telefonoPropietario: string;
  pais: 'Mexico' | 'Colombia';
  plan: 'STANDARD' | 'PRO';
  direccion: string;
  categorias: string;
  notas: string;
}

function crearFormularioInicial(): FormularioPreregistro {
  return {
    nombreSalon: '',
    propietario: '',
    emailPropietario: '',
    telefonoPropietario: '',
    pais: 'Mexico',
    plan: 'STANDARD',
    direccion: '',
    categorias: '',
    notas: '',
  };
}

function leerBorrador(): FormularioPreregistro | null {
  if (typeof window === 'undefined') return null;

  try {
    const contenido = window.localStorage.getItem(CLAVE_BORRADOR_PREREGISTRO);
    if (!contenido) return null;
    const datos = JSON.parse(contenido) as Partial<FormularioPreregistro>;

    return {
      ...crearFormularioInicial(),
      ...datos,
      nombreSalon: datos.nombreSalon ?? '',
      propietario: datos.propietario ?? '',
      emailPropietario: datos.emailPropietario ?? '',
      telefonoPropietario: limpiarTelefonoEntrada(datos.telefonoPropietario ?? ''),
      pais: datos.pais === 'Colombia' ? 'Colombia' : 'Mexico',
      plan: datos.plan === 'PRO' ? 'PRO' : 'STANDARD',
      direccion: datos.direccion ?? '',
      categorias: datos.categorias ?? '',
      notas: datos.notas ?? '',
    };
  } catch {
    return null;
  }
}

function guardarBorrador(formulario: FormularioPreregistro): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CLAVE_BORRADOR_PREREGISTRO, JSON.stringify(formulario));
  } catch {
    // Ignorar almacenamiento no disponible.
  }
}

function limpiarBorrador(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(CLAVE_BORRADOR_PREREGISTRO);
  } catch {
    // Ignorar almacenamiento no disponible.
  }
}

const ESTILOS_ESTADO: Record<
  Exclude<EstadoPreregistro, ''>,
  { clase: string; etiqueta: string }
> = {
  pendiente: { clase: 'badge badge-pending', etiqueta: 'Pendiente' },
  aprobado: { clase: 'badge badge-active', etiqueta: 'Aprobado' },
  rechazado: { clase: 'badge badge-danger', etiqueta: 'Rechazado' },
};

export function TabPreregistros() {
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [estado, setEstado] = useState<EstadoPreregistro>('');
  const [pagina, setPagina] = useState(1);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioPreregistro>(crearFormularioInicial());
  const [errores, setErrores] = useState<Partial<Record<keyof FormularioPreregistro, string>>>({});

  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();

  const mutacionCrear = useMutation({ mutationFn: crearPreregistro });

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setBusquedaAplicada(busquedaTexto.trim());
      setPagina(1);
    }, 280);

    return () => window.clearTimeout(temporizador);
  }, [busquedaTexto]);

  useEffect(() => {
    if (!modalAbierto) return;
    guardarBorrador(formulario);
  }, [formulario, modalAbierto]);

  const { data, isLoading } = useQuery({
    queryKey: ['vendedor', 'preregistros', busquedaAplicada, estado, pagina],
    queryFn: () =>
      obtenerMisPreregistros({
        busqueda: busquedaAplicada,
        estado: estado || undefined,
        pagina,
        limite: 10,
      }),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 30,
  });

  const preregistros = data?.datos ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 10));

  const resumen = useMemo(() => {
    return preregistros.reduce(
      (acumulado, item) => {
        acumulado.total += 1;
        if (item.estado === 'pendiente') acumulado.pendientes += 1;
        if (item.estado === 'aprobado') acumulado.aprobados += 1;
        if (item.estado === 'rechazado') acumulado.rechazados += 1;
        return acumulado;
      },
      { total: 0, pendientes: 0, aprobados: 0, rechazados: 0 },
    );
  }, [preregistros]);

  const abrirModal = () => {
    setFormulario(leerBorrador() ?? crearFormularioInicial());
    setErrores({});
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setErrores({});
  };

  const validarFormulario = (): boolean => {
    const siguientesErrores: Partial<Record<keyof FormularioPreregistro, string>> = {};

    if (!formulario.nombreSalon.trim()) {
      siguientesErrores.nombreSalon = 'Ingresa el nombre del salon.';
    }
    if (!formulario.propietario.trim()) {
      siguientesErrores.propietario = 'Ingresa el nombre del propietario.';
    }
    if (!formulario.emailPropietario.trim()) {
      siguientesErrores.emailPropietario = 'Ingresa el email del propietario.';
    } else if (!esEmailSalonValido(formulario.emailPropietario)) {
      siguientesErrores.emailPropietario =
        'Solo se aceptan correos personales @gmail, @hotmail, @outlook o @yahoo.';
    }
    if (formulario.telefonoPropietario.length !== 10) {
      siguientesErrores.telefonoPropietario = 'El telefono debe tener exactamente 10 digitos.';
    }

    setErrores(siguientesErrores);
    return Object.keys(siguientesErrores).length === 0;
  };

  const enviarPreregistro = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!validarFormulario()) return;

    const payload: DatosPreregistro = {
      nombreSalon: formulario.nombreSalon.trim(),
      propietario: formulario.propietario.trim(),
      emailPropietario: formulario.emailPropietario.trim().toLowerCase(),
      telefonoPropietario: formulario.telefonoPropietario,
      pais: formulario.pais,
      direccion: formulario.direccion.trim() || undefined,
      categorias: formulario.categorias.trim() || undefined,
      plan: formulario.plan,
      notas: formulario.notas.trim() || undefined,
    };

    try {
      const resultado = await mutacionCrear.mutateAsync(payload);
      limpiarBorrador();
      setFormulario(crearFormularioInicial());
      setModalAbierto(false);
      await clienteConsulta.invalidateQueries({ queryKey: ['vendedor'] });
      mostrarToast(`Pre-registro "${resultado.nombreSalon}" enviado correctamente.`);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'No se pudo guardar el pre-registro.';
      mostrarToast(mensaje);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
              Pre-registros
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">
              Captura prospectos y mueve cada salon por el embudo comercial.
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Flujo oficial: pre-registro - revision admin - aprobacion - entrega de credenciales.
            </p>
          </div>
          <button
            type="button"
            onClick={abrirModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-600 px-7 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-pink-700"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Nuevo pre-registro
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busquedaTexto}
              onChange={(evento) => setBusquedaTexto(evento.target.value)}
              className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm text-slate-900"
              placeholder="Buscar por salon, propietario o email"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={estado}
              onChange={(evento) => {
                setEstado(evento.target.value as EstadoPreregistro);
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
              Limpiar
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaResumen etiqueta="Total filtrado" valor={total} tono="claro" />
          <TarjetaResumen etiqueta="Pendientes" valor={resumen.pendientes} tono="pendiente" />
          <TarjetaResumen etiqueta="Aprobados" valor={resumen.aprobados} tono="aprobado" />
          <TarjetaResumen etiqueta="Rechazados" valor={resumen.rechazados} tono="rechazado" />
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <p>{total} pre-registros encontrados.</p>
        <p>
          Pagina {pagina} de {totalPaginas}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
        </div>
      ) : preregistros.length === 0 ? (
        <div className="rounded-4xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" aria-hidden="true" />
          <p className="font-medium text-slate-500">No hay pre-registros para este filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {preregistros.map((item) => (
            <TarjetaPreregistro key={item.id} preregistro={item} />
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

      {modalAbierto && (
        <ModalPreregistroVendedor
          formulario={formulario}
          errores={errores}
          procesando={mutacionCrear.isPending}
          onCerrar={cerrarModal}
          onCambiarFormulario={setFormulario}
          onEnviar={enviarPreregistro}
        />
      )}
    </div>
  );
}

function ModalPreregistroVendedor({
  formulario,
  errores,
  procesando,
  onCerrar,
  onCambiarFormulario,
  onEnviar,
}: {
  formulario: FormularioPreregistro;
  errores: Partial<Record<keyof FormularioPreregistro, string>>;
  procesando: boolean;
  onCerrar: () => void;
  onCambiarFormulario: Dispatch<SetStateAction<FormularioPreregistro>>;
  onEnviar: (evento: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-preregistro-vendedor"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-4xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <h3
              id="titulo-modal-preregistro-vendedor"
              className="text-xl font-black text-slate-900"
            >
              Nuevo pre-registro de salon
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Este formulario no crea usuario ni credenciales. Solo registra el prospecto.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onEnviar} className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              etiqueta="Nombre del salon"
              valor={formulario.nombreSalon}
              error={errores.nombreSalon}
              onChange={(valor) =>
                onCambiarFormulario((prev) => ({
                  ...prev,
                  nombreSalon: limpiarNombreSalonEntrada(valor),
                }))
              }
            />
            <Campo
              etiqueta="Propietario"
              valor={formulario.propietario}
              error={errores.propietario}
              onChange={(valor) =>
                onCambiarFormulario((prev) => ({
                  ...prev,
                  propietario: limpiarNombrePersonaEntrada(valor),
                }))
              }
            />
            <Campo
              etiqueta="Email del propietario"
              tipo="email"
              valor={formulario.emailPropietario}
              error={errores.emailPropietario}
              onChange={(valor) =>
                onCambiarFormulario((prev) => ({
                  ...prev,
                  emailPropietario: valor.trim().toLowerCase(),
                }))
              }
            />
            <Campo
              etiqueta="Telefono"
              valor={formulario.telefonoPropietario}
              error={errores.telefonoPropietario}
              onChange={(valor) =>
                onCambiarFormulario((prev) => ({
                  ...prev,
                  telefonoPropietario: limpiarTelefonoEntrada(valor),
                }))
              }
              maxLength={10}
            />
            <SelectCampo
              etiqueta="Pais"
              valor={formulario.pais}
              onChange={(valor) =>
                onCambiarFormulario((prev) => ({ ...prev, pais: valor as 'Mexico' | 'Colombia' }))
              }
              opciones={[
                { valor: 'Mexico', etiqueta: 'Mexico' },
                { valor: 'Colombia', etiqueta: 'Colombia' },
              ]}
            />
            <SelectCampo
              etiqueta="Plan sugerido"
              valor={formulario.plan}
              onChange={(valor) =>
                onCambiarFormulario((prev) => ({ ...prev, plan: valor as 'STANDARD' | 'PRO' }))
              }
              opciones={[
                { valor: 'STANDARD', etiqueta: 'Standard' },
                { valor: 'PRO', etiqueta: 'Pro' },
              ]}
            />
          </div>

          <Campo
            etiqueta="Direccion (opcional)"
            valor={formulario.direccion}
            onChange={(valor) => onCambiarFormulario((prev) => ({ ...prev, direccion: valor }))}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              etiqueta="Categorias principales (opcional)"
              valor={formulario.categorias}
              onChange={(valor) => onCambiarFormulario((prev) => ({ ...prev, categorias: valor }))}
              placeholder="Cabello, Unas, Barberia"
            />
            <Campo
              etiqueta="Notas comerciales (opcional)"
              valor={formulario.notas}
              onChange={(valor) => onCambiarFormulario((prev) => ({ ...prev, notas: valor }))}
              placeholder="Origen del lead, objeciones, urgencia..."
            />
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Las credenciales se generan unicamente cuando admin/supervisor aprueba el pre-registro.
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={procesando}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {procesando ? 'Enviando...' : 'Enviar pre-registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  error,
  tipo = 'text',
  maxLength,
  placeholder,
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  error?: string;
  tipo?: 'text' | 'email';
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
        {etiqueta}
      </span>
      <input
        type={tipo}
        value={valor}
        maxLength={maxLength}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
      />
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
    </label>
  );
}

function SelectCampo({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  opciones: Array<{ valor: string; etiqueta: string }>;
  onChange: (valor: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
        {etiqueta}
      </span>
      <select
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}

function TarjetaResumen({
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

function TarjetaPreregistro({ preregistro }: { preregistro: PreregistroSalon }) {
  const estilo = ESTILOS_ESTADO[preregistro.estado] ?? ESTILOS_ESTADO.pendiente;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-slate-900">{preregistro.nombreSalon}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <UserRoundCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {preregistro.propietario}
          </p>
          <p className="mt-1 text-sm text-slate-500">{preregistro.emailPropietario}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            {preregistro.pais} · {preregistro.plan} · {formatearFechaHumana(preregistro.creadoEn)}
          </p>
        </div>

        <span className={estilo.clase}>
          {preregistro.estado === 'pendiente' && (
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {preregistro.estado === 'aprobado' && (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {preregistro.estado === 'rechazado' && (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {estilo.etiqueta}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Detalle etiqueta="Telefono" valor={preregistro.telefonoPropietario} />
        <Detalle etiqueta="Direccion" valor={preregistro.direccion || 'Sin direccion'} />
        <Detalle etiqueta="Categorias" valor={preregistro.categorias || 'Sin categorias'} />
      </div>

      {preregistro.descripcion && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {preregistro.descripcion}
        </div>
      )}

      {preregistro.estado === 'aprobado' && preregistro.estudioCreadoId && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Salon creado: {preregistro.estudioCreadoId}
        </div>
      )}

      {preregistro.estado === 'rechazado' && (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <div className="mb-1 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Motivo de rechazo
          </div>
          <p>{preregistro.motivoRechazo || 'Sin motivo registrado.'}</p>
        </div>
      )}
    </article>
  );
}

function Detalle({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {etiqueta}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{valor}</p>
    </div>
  );
}
