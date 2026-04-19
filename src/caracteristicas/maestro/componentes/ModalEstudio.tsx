import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import QRCode from 'qrcode';
import {
  XCircle,
  User,
  ListChecks,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Download,
  RefreshCw,
  Package,
  Trash2,
} from 'lucide-react';
import {
  CATALOGO_SERVICIOS,
  DIAS_SEMANA,
  obtenerEtiquetaServicioCatalogo,
} from '../../../lib/constantes';
import { SelectorFecha } from '../../../componentes/ui/SelectorFecha';
import { SelectorHora } from '../../../componentes/ui/SelectorHora';
import type { ConfirmacionAltaSalon, FormularioEstudio } from '../hooks/usarFormularioEstudio';
import { obtenerDefinicionPlan } from '../../../lib/planes';
import { convertirCentavosAMoneda, formatearDinero } from '../../../utils/formato';
import {
  esEmailSalonValido,
  generarContrasenaSalon,
  limpiarNombrePersonaEntrada,
  limpiarNombreSalonEntrada,
  limpiarTelefonoEntrada,
} from '../../../utils/formularioSalon';

interface PropsCatalogo {
  alternarServicio: (nombre: string) => void;
  actualizarCampoServicio: (nombre: string, campo: 'duration' | 'price', valor: string) => void;
  agregarServicioPersonalizado: (categoria: string) => void;
  entradaServicioPersonalizado: Record<string, string>;
  setEntradaServicioPersonalizado: Dispatch<SetStateAction<Record<string, string>>>;
}

interface PropsModalEstudio {
  modo: 'ADD' | 'EDIT' | 'CONFIRMACION';
  formulario: FormularioEstudio;
  setFormulario: Dispatch<SetStateAction<FormularioEstudio>>;
  catalogoProps: PropsCatalogo;
  onEnviar: (e: React.FormEvent<HTMLFormElement>) => void;
  onCerrar: () => void;
  confirmacionAlta: ConfirmacionAltaSalon | null;
  onRegenerarContrasenaDueno: () => void;
  textosModoAgregar?: {
    titulo: string;
    tituloInformativo: string;
    descripcionInformativa: string;
    textoBotonEnviar: string;
  };
}

const TEXTOS_MODO_AGREGAR_POR_DEFECTO = {
  titulo: 'Registro completo',
  tituloInformativo: 'Credenciales automáticas',
  descripcionInformativa:
    'La clave del dueño y la clave de acceso clientes se generan automáticamente al guardar. Al finalizar verás la clave lista para copiar y descargar en QR.',
  textoBotonEnviar: 'Crear salón',
} as const;

export function ModalEstudio({
  modo,
  formulario,
  setFormulario,
  catalogoProps,
  onEnviar,
  onCerrar,
  confirmacionAlta,
  onRegenerarContrasenaDueno,
  textosModoAgregar,
}: PropsModalEstudio) {
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [prefijoTelefono, setPrefijoTelefono] = useState('+52');
  const [preciosEnEdicion, setPreciosEnEdicion] = useState<Record<string, boolean>>({});
  const [qrReserva, setQrReserva] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Record<string, boolean>>(() =>
    Object.keys(CATALOGO_SERVICIOS).reduce<Record<string, boolean>>(
      (acumulado, categoria) => ({
        ...acumulado,
        [categoria]: true,
      }),
      {},
    ),
  );
  const {
    alternarServicio,
    actualizarCampoServicio,
    agregarServicioPersonalizado,
    entradaServicioPersonalizado,
    setEntradaServicioPersonalizado,
  } = catalogoProps;
  const textosAgregar = textosModoAgregar ?? TEXTOS_MODO_AGREGAR_POR_DEFECTO;

  useEffect(() => {
    setPrefijoTelefono(formulario.country === 'Colombia' ? '+57' : '+52');
  }, [formulario.country]);

  useEffect(() => {
    if (modo !== 'CONFIRMACION' || !confirmacionAlta) {
      setQrReserva(null);
      return;
    }

    let activo = true;
    void QRCode.toDataURL(confirmacionAlta.urlReserva, {
      width: 360,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }).then((url) => {
      if (activo) {
        setQrReserva(url);
      }
    });

    return () => {
      activo = false;
    };
  }, [confirmacionAlta, modo]);

  const copiarTexto = async (clave: string, valor: string) => {
    await navigator.clipboard.writeText(valor);
    setCopiado(clave);
    window.setTimeout(() => setCopiado((actual) => (actual === clave ? null : actual)), 1800);
  };

  const descargarQr = () => {
    if (!qrReserva || !confirmacionAlta) return;
    const fecha = new Date()
      .toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .replace(/ /g, '')
      .toUpperCase();
    const nombreArchivo = `${confirmacionAlta.nombreSalon.replace(/\s+/g, '_').toUpperCase()}_${fecha}.png`;
    const enlace = document.createElement('a');
    enlace.href = qrReserva;
    enlace.download = nombreArchivo;
    enlace.click();
  };

  const formatearPrecioVisual = (precio: number, claveServicio: string) => {
    if (preciosEnEdicion[claveServicio]) {
      return String(convertirCentavosAMoneda(precio ?? 0));
    }

    return formatearDinero(precio ?? 0, formulario.country === 'Colombia' ? 'COP' : 'MXN');
  };

  if (modo === 'CONFIRMACION' && confirmacionAlta) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-estudio-titulo"
        className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-xl sm:items-center sm:p-4"
      >
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-4xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[3rem]">
          <div className="flex items-start justify-between gap-4 border-b bg-slate-50 p-4 sm:items-center sm:p-8">
            <div className="min-w-0">
              <h2
                id="modal-estudio-titulo"
                className="text-xl font-black italic uppercase tracking-tighter sm:text-2xl"
              >
                Registro completado
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Comparte estos datos con el dueño y usa la clave de acceso de clientes en el
                material del salón.
              </p>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar modal">
              <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
            </button>
          </div>

          <div className="grid flex-1 gap-5 overflow-y-auto p-4 sm:p-6 md:grid-cols-[0.85fr_1.15fr] md:gap-8 md:p-8">
            <aside className="order-1 rounded-4xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:order-2">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    QR descargable
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    El QR abre la reserva pública del salón.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={descargarQr}
                  disabled={!qrReserva}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> Descargar
                </button>
              </div>

              <div className="flex min-h-56 items-center justify-center rounded-4xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:min-h-70">
                {qrReserva ? (
                  <img
                    src={qrReserva}
                    alt="QR de acceso a reservas"
                    className="w-full max-w-44 sm:max-w-60"
                  />
                ) : (
                  <span className="text-sm font-semibold text-slate-400">Generando QR...</span>
                )}
              </div>

              <button
                type="button"
                onClick={onCerrar}
                className="mt-5 w-full rounded-3xl bg-pink-600 px-4 py-4 text-xs font-black uppercase text-white shadow-xl transition-colors hover:bg-pink-700 sm:mt-6"
              >
                Cerrar confirmación
              </button>
            </aside>

            <div className="order-2 space-y-5 sm:space-y-6 md:order-1">
              <section className="rounded-4xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-pink-600">
                  <Mail className="h-4 w-4" /> Acceso del dueño
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <span className="font-black text-slate-900">Salón:</span>{' '}
                    {confirmacionAlta.nombreSalon}
                  </p>
                  <p>
                    <span className="font-black text-slate-900">Dueño:</span>{' '}
                    {confirmacionAlta.nombreDueno}
                  </p>
                  <p>
                    <span className="font-black text-slate-900">Correo:</span>{' '}
                    {confirmacionAlta.emailDueno}
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Contraseña inicial
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarTexto('contrasena', confirmacionAlta.contrasenaDueno)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase text-slate-600"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiado === 'contrasena' ? 'Copiada' : 'Copiar'}
                    </button>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-4 py-3">
                    <code className="block break-all font-mono text-xs font-black tracking-normal text-emerald-300 sm:text-sm">
                      {confirmacionAlta.contrasenaDueno}
                    </code>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    Esta contraseña queda activa tal como se creó. No se obliga al dueño a cambiarla
                    en su primer acceso.
                  </p>
                </div>
              </section>

              <section className="rounded-4xl border border-slate-900 bg-slate-950 p-5 text-white sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-pink-400">
                  <KeyRound className="h-4 w-4" /> Acceso público a reservas
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
                    <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Clave acceso clientes
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copiarTexto('clave-clientes', confirmacionAlta.claveClientes)
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-[10px] font-black uppercase text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiado === 'clave-clientes' ? 'Copiada' : 'Copiar'}
                      </button>
                    </div>
                    <code className="block break-all font-mono text-base font-black tracking-normal text-pink-300 sm:text-xl">
                      {confirmacionAlta.claveClientes}
                    </code>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
                    <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        URL para compartir
                      </span>
                      <button
                        type="button"
                        onClick={() => copiarTexto('url-reserva', confirmacionAlta.urlReserva)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-[10px] font-black uppercase text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiado === 'url-reserva' ? 'Copiada' : 'Copiar'}
                      </button>
                    </div>
                    <p className="break-all text-sm font-semibold text-slate-200">
                      {confirmacionAlta.urlReserva}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-estudio-titulo"
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-60 flex items-center justify-center p-4"
    >
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
          <h2
            id="modal-estudio-titulo"
            className="text-2xl font-black italic uppercase tracking-tighter"
          >
            {modo === 'EDIT' ? 'Editar salón' : textosAgregar.titulo}
          </h2>
          <button onClick={onCerrar} aria-label="Cerrar modal">
            <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
          </button>
        </div>

        <form onSubmit={onEnviar} className="flex-1 overflow-y-auto px-4 py-8 sm:p-10 space-y-12">
          {/* SECCIÓN 1: IDENTIDAD */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="col-span-full font-black text-xs text-pink-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              <User className="w-4 h-4" /> Identidad del Negocio
            </div>
            <div>
              <label
                htmlFor="nombre-estudio"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
              >
                Nombre del salón
              </label>
              <input
                id="nombre-estudio"
                name="nombreSalon"
                autoComplete="organization"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Nombre"
                value={formulario.name}
                onChange={(e) =>
                  setFormulario((p) => {
                    const name = limpiarNombreSalonEntrada(e.target.value);
                    return {
                      ...p,
                      name,
                      contrasenaDueno:
                        p.reintentosContrasenaDueno === 1
                          ? generarContrasenaSalon(name, p.owner, 0)
                          : p.contrasenaDueno,
                    };
                  })
                }
                required
              />
            </div>
            <div>
              <label
                htmlFor="dueno-estudio"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
              >
                Nombre completo del dueño
              </label>
              <input
                id="dueno-estudio"
                name="nombreDueno"
                autoComplete="name"
                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500 w-full"
                placeholder="Nombre completo"
                value={formulario.owner}
                onChange={(e) =>
                  setFormulario((p) => {
                    const owner = limpiarNombrePersonaEntrada(e.target.value);
                    return {
                      ...p,
                      owner,
                      contrasenaDueno:
                        p.reintentosContrasenaDueno === 1
                          ? generarContrasenaSalon(p.name, owner, 0)
                          : p.contrasenaDueno,
                    };
                  })
                }
                required
              />
            </div>
            <div className="col-span-full sm:col-span-2">
              <label
                htmlFor="direccion-estudio"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
              >
                Dirección
              </label>
              <input
                id="direccion-estudio"
                name="direccionSalon"
                autoComplete="street-address"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Dirección real del salón"
                value={formulario.direccion}
                onChange={(e) => setFormulario((p) => ({ ...p, direccion: e.target.value }))}
                required
              />
            </div>
            {modo === 'ADD' && (
              <>
                <div>
                  <label
                    htmlFor="email-dueno"
                    className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
                  >
                    Email del dueño
                  </label>
                  <input
                    id="email-dueno"
                    name="emailDueno"
                    type="email"
                    autoComplete="email"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="dueno@gmail.com"
                    value={formulario.emailDueno}
                    onChange={(e) =>
                      setFormulario((p) => ({
                        ...p,
                        emailDueno: e.target.value.trim().toLowerCase(),
                      }))
                    }
                    required
                  />
                  {formulario.emailDueno && !esEmailSalonValido(formulario.emailDueno) && (
                    <p className="mt-2 text-xs font-medium text-red-500">
                      Solo se aceptan correos personales @gmail, @hotmail, @outlook o @yahoo.
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="contrasena-dueno"
                    className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
                  >
                    Contraseña
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        id="contrasena-dueno"
                        name="contrasenaDueno"
                        type={mostrarContrasena ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="w-full p-4 pr-12 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500"
                        value={formulario.contrasenaDueno}
                        readOnly
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarContrasena((prev) => !prev)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                        aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {mostrarContrasena ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={onRegenerarContrasenaDueno}
                      disabled={formulario.reintentosContrasenaDueno >= 5}
                      title="Generar otra contraseña"
                      aria-label="Generar otra contraseña"
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Generación automática activa. Variantes usadas:{' '}
                    {formulario.reintentosContrasenaDueno}/5.
                  </p>
                </div>
              </>
            )}
            <div>
              <label
                htmlFor="telefono-estudio"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
              >
                Teléfono del salón
              </label>
              <div className="flex">
                <select
                  value={prefijoTelefono}
                  onChange={(e) => {
                    const prefijo = e.target.value;
                    setPrefijoTelefono(prefijo);
                    setFormulario((p) => ({
                      ...p,
                      country: prefijo === '+57' ? 'Colombia' : 'Mexico',
                    }));
                  }}
                  className="px-3 bg-slate-100 border border-r-0 border-slate-100 rounded-l-2xl text-sm font-bold text-slate-600 outline-none"
                  aria-label="Prefijo telefónico"
                >
                  <option value="+52">+52</option>
                  <option value="+57">+57</option>
                </select>
                <input
                  id="telefono-estudio"
                  name="telefonoSalon"
                  type="tel"
                  autoComplete="tel"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-r-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Ej. 5512345678"
                  value={formulario.phone}
                  onChange={(e) =>
                    setFormulario((p) => ({
                      ...p,
                      phone: limpiarTelefonoEntrada(e.target.value),
                    }))
                  }
                  maxLength={10}
                  required
                />
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Solo 10 dígitos, sin repetir el prefijo.
              </p>
            </div>
            <div>
              <label
                htmlFor="pais-estudio"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
              >
                País del salón
              </label>
              <select
                id="pais-estudio"
                name="paisSalon"
                value={formulario.country}
                onChange={(e) =>
                  setFormulario((p) => ({ ...p, country: e.target.value as 'Mexico' | 'Colombia' }))
                }
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500 appearance-none"
              >
                <option value="Mexico">México ($1,000 MXN)</option>
                <option value="Colombia">Colombia ($200,000 COP)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="plan-estudio"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2 ml-1"
              >
                Plan del salón
              </label>
              <select
                id="plan-estudio"
                name="planEstudio"
                value={formulario.plan}
                onChange={(e) =>
                  setFormulario((p) => {
                    const plan = e.target.value as 'STANDARD' | 'PRO';
                    return {
                      ...p,
                      plan,
                      branches: plan === 'PRO' ? p.branches : [],
                      productos: plan === 'PRO' ? p.productos : [],
                    };
                  })
                }
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500 appearance-none"
              >
                <option value="STANDARD">Estándar</option>
                <option value="PRO">Pro</option>
              </select>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {obtenerDefinicionPlan(formulario.plan).resumen}
              </p>
              <div className="mt-4">
                {(() => {
                  const definicion = obtenerDefinicionPlan(formulario.plan);
                  const esPlanPro = formulario.plan === 'PRO';

                  return (
                    <article
                      className={`w-full rounded-3xl border p-4 transition-colors sm:p-5 ${
                        esPlanPro
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              esPlanPro
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            Plan {definicion.nombre}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-600">{definicion.resumen}</p>
                      </div>

                      <div className="grid w-full gap-3 lg:grid-cols-2">
                        <section className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                          <p className="text-xs font-bold text-emerald-700">Incluye</p>
                          <ul className="mt-2 space-y-1 text-xs font-medium text-slate-700">
                            {definicion.capacidades.map((item) => (
                              <li key={`${formulario.plan}-incluye-${item}`}>• {item}</li>
                            ))}
                          </ul>
                        </section>

                        {definicion.restricciones.length > 0 && (
                          <section className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                            <p className="text-xs font-bold text-amber-700">Restricciones</p>
                            <ul className="mt-2 space-y-1 text-xs font-medium text-slate-700">
                              {definicion.restricciones.map((item) => (
                                <li key={`${formulario.plan}-restriccion-${item}`}>• {item}</li>
                              ))}
                            </ul>
                          </section>
                        )}
                      </div>
                    </article>
                  );
                })()}
              </div>
            </div>
            <div>
              <SelectorFecha
                id="inicio-operaciones"
                etiqueta="Día de Inicio Operaciones (Cobro)"
                valor={formulario.subscriptionStart ?? ''}
                alCambiar={(valor) => setFormulario((p) => ({ ...p, subscriptionStart: valor }))}
                min={new Date().toLocaleDateString('sv-SE')}
                requerido
              />
            </div>
          </section>

          {/* SECCIÓN 2: CATÁLOGO */}
          <section className="space-y-6">
            <div className="font-black text-xs text-pink-600 uppercase tracking-wide flex items-center gap-2">
              <ListChecks className="w-4 h-4" /> Servicios del salón
            </div>
            {Object.entries(CATALOGO_SERVICIOS).map(([cat, items]) => {
              const custom = (formulario.customServices ?? [])
                .filter((c) => c.category === cat)
                .map((c) => c.name);
              const todos = Array.from(new Set([...items, ...custom]));
              const categoriaAbierta = categoriasAbiertas[cat] ?? true;
              const cantidadSeleccionados = todos.filter((servicio) =>
                formulario.selectedServices.some((item) => item.name === servicio),
              ).length;
              return (
                <div
                  key={cat}
                  className="space-y-3 bg-slate-50/50 p-4 sm:p-6 rounded-4xl border border-slate-100"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCategoriasAbiertas((prev) => ({
                        ...prev,
                        [cat]: !categoriaAbierta,
                      }))
                    }
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 text-left"
                    aria-expanded={categoriaAbierta}
                    aria-controls={`categoria-servicios-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <h4 className="truncate text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-md uppercase">
                        {cat}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-600">
                        {cantidadSeleccionados} seleccionados
                      </span>
                    </div>
                    {categoriaAbierta ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                  {categoriaAbierta && (
                    <div
                      id={`categoria-servicios-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {todos.map((s) => {
                          const sel = formulario.selectedServices.find((sv) => sv.name === s);
                          const categoriaNormalizada = cat
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-');
                          const servicioNormalizado = s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                          return (
                            <div
                              key={`${cat}-${s}`}
                              className={`flex flex-col justify-between p-3 rounded-xl border gap-3 transition-all ${sel ? 'bg-pink-50 border-pink-300' : 'bg-white border-slate-100'}`}
                            >
                              <button
                                type="button"
                                onClick={() => alternarServicio(s)}
                                className={`text-left text-[10px] font-bold flex items-center gap-2 ${sel ? 'text-pink-700' : 'text-slate-500'}`}
                              >
                                {sel ? (
                                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                                ) : (
                                  <Circle className="h-4 w-4 text-slate-400" />
                                )}
                                <span>{obtenerEtiquetaServicioCatalogo(s)}</span>
                              </button>
                              {sel && (
                                <div className="flex items-center gap-3">
                                  <div className="flex w-full items-center gap-1 bg-white p-1 rounded-lg border border-pink-100 sm:w-auto">
                                    <Clock className="w-3 h-3 text-pink-400" />
                                    <input
                                      id={`duracion-${categoriaNormalizada}-${servicioNormalizado}`}
                                      name={`duracion-${categoriaNormalizada}-${servicioNormalizado}`}
                                      type="number"
                                      min="1"
                                      max="480"
                                      value={sel.duration}
                                      onChange={(e) =>
                                        actualizarCampoServicio(s, 'duration', e.target.value)
                                      }
                                      onInput={(e) => {
                                        const entrada = e.currentTarget;
                                        entrada.value = entrada.value.replace(/^0+/, '') || '';
                                      }}
                                      className="w-full min-w-0 text-[10px] font-black outline-none text-center text-slate-700 sm:w-16"
                                    />
                                    <span className="text-[8px] font-black text-slate-400">
                                      MIN
                                    </span>
                                  </div>
                                  <div className="flex w-full items-center gap-1 bg-green-50 p-1 rounded-lg border border-green-200 sm:w-auto">
                                    <DollarSign className="w-3 h-3 text-green-600" />
                                    <input
                                      id={`precio-${categoriaNormalizada}-${servicioNormalizado}`}
                                      name={`precio-${categoriaNormalizada}-${servicioNormalizado}`}
                                      type="text"
                                      inputMode="numeric"
                                      value={formatearPrecioVisual(sel.price ?? 0, s)}
                                      onFocus={() =>
                                        setPreciosEnEdicion((prev) => ({ ...prev, [s]: true }))
                                      }
                                      onChange={(e) => {
                                        const valorLimpio = e.target.value.replace(/\D/g, '');
                                        actualizarCampoServicio(s, 'price', valorLimpio);
                                      }}
                                      onInput={(e) => {
                                        const entrada = e.currentTarget;
                                        entrada.value =
                                          entrada.value.replace(/\D/g, '').replace(/^0+/, '') || '';
                                      }}
                                      onBlur={() =>
                                        setPreciosEnEdicion((prev) => ({ ...prev, [s]: false }))
                                      }
                                      className="w-full min-w-0 text-[10px] font-black outline-none text-center text-green-800 bg-transparent sm:w-24"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row md:w-1/2">
                        <input
                          name={`servicio-personalizado-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                          autoComplete="off"
                          value={entradaServicioPersonalizado[cat] ?? ''}
                          onChange={(e) =>
                            setEntradaServicioPersonalizado((p) => ({
                              ...p,
                              [cat]: e.target.value,
                            }))
                          }
                          placeholder={`+ Añadir servicio en ${cat}...`}
                          className="flex-1 text-[10px] font-bold p-3 rounded-xl border border-slate-200 outline-none focus:border-pink-400 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => agregarServicioPersonalizado(cat)}
                          className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-black"
                        >
                          AÑADIR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {formulario.plan === 'PRO' && (
            <section className="space-y-4">
              <div className="font-black text-xs text-pink-600 uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4" /> Productos del salón
              </div>
              <div className="space-y-3 rounded-4xl border border-slate-200 bg-slate-50 p-5">
                {formulario.productos.map((producto) => (
                  <div
                    key={producto.id}
                    className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto] md:items-center"
                  >
                    <input
                      value={producto.nombre}
                      onChange={(e) =>
                        setFormulario((p) => ({
                          ...p,
                          productos: p.productos.map((item) =>
                            item.id === producto.id
                              ? { ...item, nombre: limpiarNombreSalonEntrada(e.target.value) }
                              : item,
                          ),
                        }))
                      }
                      placeholder="Nombre del producto"
                      className="rounded-2xl border border-slate-200 bg-white p-4 font-bold outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(convertirCentavosAMoneda(producto.precio))}
                      onChange={(e) => {
                        const precio = Number.parseInt(e.target.value.replace(/\D/g, ''), 10);
                        setFormulario((p) => ({
                          ...p,
                          productos: p.productos.map((item) =>
                            item.id === producto.id
                              ? {
                                  ...item,
                                  precio: Number.isNaN(precio) ? 100 : Math.max(100, precio * 100),
                                }
                              : item,
                          ),
                        }));
                      }}
                      placeholder="Precio"
                      className="rounded-2xl border border-slate-200 bg-white p-4 font-bold outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormulario((p) => ({
                          ...p,
                          productos: p.productos.filter((item) => item.id !== producto.id),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500"
                      aria-label="Eliminar producto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setFormulario((p) => ({
                      ...p,
                      productos: [
                        ...p.productos,
                        {
                          id: crypto.randomUUID(),
                          nombre: '',
                          categoria: 'General',
                          precio: 100,
                        },
                      ],
                    }))
                  }
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white"
                >
                  Añadir producto
                </button>

                {formulario.productos.filter((producto) => producto.nombre.trim()).length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Producto</th>
                          <th className="px-4 py-3">Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formulario.productos
                          .filter((producto) => producto.nombre.trim())
                          .map((producto) => (
                            <tr key={producto.id} className="border-t border-slate-100">
                              <td className="px-4 py-3 font-semibold text-slate-700">
                                {producto.nombre}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-700">
                                {formatearDinero(
                                  producto.precio,
                                  formulario.country === 'Colombia' ? 'COP' : 'MXN',
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECCIÓN 3: HORARIO OPERATIVO */}
          <section className="space-y-4">
            <div className="font-black text-xs text-pink-600 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4" /> Horario Operativo Local
            </div>
            <div className="space-y-2 rounded-4xl border border-slate-200 bg-white p-3 sm:p-5">
              {DIAS_SEMANA.map((dia) => (
                <div
                  key={dia}
                  className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-[10px] font-black md:grid-cols-[minmax(150px,1fr)_auto] md:items-center"
                >
                  <label
                    htmlFor={`horario-${dia.toLowerCase()}`}
                    className="flex items-center gap-2 uppercase text-slate-700"
                  >
                    <input
                      id={`horario-${dia.toLowerCase()}`}
                      name={`horario-${dia.toLowerCase()}`}
                      type="checkbox"
                      checked={formulario.schedule[dia]?.isOpen ?? true}
                      onChange={(e) =>
                        setFormulario((p) => ({
                          ...p,
                          schedule: {
                            ...p.schedule,
                            [dia]: { ...p.schedule[dia], isOpen: e.target.checked },
                          },
                        }))
                      }
                      className="accent-pink-600"
                    />
                    <span>{dia}</span>
                  </label>
                  <div
                    className={`grid grid-cols-1 gap-2 sm:grid-cols-[minmax(120px,1fr)_auto_minmax(120px,1fr)] ${formulario.schedule[dia]?.isOpen ? '' : 'opacity-50 pointer-events-none'}`}
                  >
                    <SelectorHora
                      etiqueta="Apertura"
                      id={`apertura-${dia.toLowerCase()}`}
                      nombre={`apertura-${dia.toLowerCase()}`}
                      valor={formulario.schedule[dia]?.openTime ?? '09:00'}
                      alCambiar={(valor) =>
                        setFormulario((p) => ({
                          ...p,
                          schedule: {
                            ...p.schedule,
                            [dia]: { ...p.schedule[dia], openTime: valor },
                          },
                        }))
                      }
                      ocultarEtiqueta
                      claseContenedor="w-full"
                      claseSelect="w-full rounded border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <span className="hidden self-center text-center text-xs text-slate-400 sm:inline">
                      a
                    </span>
                    <SelectorHora
                      etiqueta="Cierre"
                      id={`cierre-${dia.toLowerCase()}`}
                      nombre={`cierre-${dia.toLowerCase()}`}
                      valor={formulario.schedule[dia]?.closeTime ?? '22:00'}
                      alCambiar={(valor) =>
                        setFormulario((p) => ({
                          ...p,
                          schedule: {
                            ...p.schedule,
                            [dia]: { ...p.schedule[dia], closeTime: valor },
                          },
                        }))
                      }
                      ocultarEtiqueta
                      claseContenedor="w-full"
                      claseSelect="w-full rounded border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {modo === 'ADD' && (
            <section className="bg-slate-900 p-8 rounded-4xl text-white">
              <div className="font-black text-xs text-pink-400 uppercase tracking-wide mb-3">
                {textosAgregar.tituloInformativo}
              </div>
              <p className="text-sm font-medium text-slate-300">
                {textosAgregar.descripcionInformativa}
              </p>
            </section>
          )}

          <div className="pt-8 flex gap-4">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-4xl uppercase text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-5 bg-pink-600 text-white font-black rounded-4xl uppercase text-xs shadow-2xl hover:bg-pink-700 transition-colors"
            >
              {modo === 'EDIT' ? 'Guardar cambios' : textosAgregar.textoBotonEnviar}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
