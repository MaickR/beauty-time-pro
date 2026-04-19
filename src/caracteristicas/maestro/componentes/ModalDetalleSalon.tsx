import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Copy, Check, QrCode, Save, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { ErrorAPI } from '../../../lib/clienteHTTP';
import {
  obtenerDetalleSalonDirectorio,
  actualizarSalonDirectorio,
  obtenerHistorialPagosSalon,
} from '../../../servicios/servicioAdmin';
import { formatearFechaHumana } from '../../../utils/formato';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import {
  esEmailSalonValido,
  limpiarNombrePersonaEntrada,
  limpiarNombreSalonEntrada,
  limpiarTelefonoEntrada,
} from '../../../utils/formularioSalon';

interface PropsModalDetalleSalon {
  salonId: string;
  onCerrar: () => void;
}

type PestanaDetalle = 'informacion' | 'historial' | 'acceso';

const LIMITE_HISTORIAL = 10;

export function ModalDetalleSalon({ salonId, onCerrar }: PropsModalDetalleSalon) {
  const queryClient = useQueryClient();
  const [pestana, setPestana] = useState<PestanaDetalle>('informacion');
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erroresGuardado, setErroresGuardado] = useState<string | null>(null);

  // Datos del salón
  const { data: salon, isLoading: cargandoSalon } = useQuery({
    queryKey: ['admin', 'directorio', salonId],
    queryFn: () => obtenerDetalleSalonDirectorio(salonId),
    staleTime: 15_000,
  });

  // Formulario editable
  const [camposEditados, setCamposEditados] = useState<Record<string, string>>({});

  const obtenerValorCampo = (campo: string, valorOriginal: string | null | undefined) => {
    if (campo in camposEditados) return camposEditados[campo]!;
    return valorOriginal ?? '';
  };

  const editarCampo = (campo: string, valor: string) => {
    setCamposEditados((prev) => ({ ...prev, [campo]: valor }));
    setErroresGuardado(null);
  };

  const hayCambios = Object.keys(camposEditados).length > 0;
  const emailDuenoActual = salon?.usuarios[0]?.email ?? salon?.emailContacto ?? '';

  // Guardar
  const { mutate: guardar, isPending: guardando } = useMutation({
    mutationFn: () => {
      const datos = { ...camposEditados };
      // No enviar contraseña vacía
      if ('contrasenaDueno' in datos && !datos.contrasenaDueno?.trim()) {
        delete datos.contrasenaDueno;
      }
      return actualizarSalonDirectorio(salonId, datos);
    },
    onSuccess: () => {
      setCamposEditados({});
      setErroresGuardado(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'directorio', salonId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'directorio'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'metricas'] });
    },
    onError: (error: Error) => {
      if (error instanceof ErrorAPI) {
        setErroresGuardado(error.message);
        return;
      }

      setErroresGuardado(error.message || 'No se pudieron guardar los cambios. Intenta de nuevo.');
    },
  });

  // Historial de pagos
  const { data: historial, isLoading: cargandoHistorial } = useQuery({
    queryKey: ['admin', 'directorio', salonId, 'historial', paginaHistorial],
    queryFn: () => obtenerHistorialPagosSalon(salonId, paginaHistorial, LIMITE_HISTORIAL),
    enabled: pestana === 'historial',
    staleTime: 15_000,
  });

  // Copiar al portapapeles
  const copiar = async (clave: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Silenciar
    }
  };

  // Generar URL de reservación
  const urlReserva = salon ? `${window.location.origin}/reservar/${salon.claveCliente}` : '';
  const enlaceWhatsApp =
    salon && urlReserva
      ? `https://wa.me/?text=${encodeURIComponent(`Hola, te comparto el acceso de reservas de ${salon.nombre}: ${urlReserva}`)}`
      : '';

  // Descargar QR
  const descargarQR = () => {
    if (!salon) return;
    const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlReserva)}`;
    const enlace = document.createElement('a');
    enlace.href = urlQR;
    enlace.download = `qr-${salon.claveCliente}.png`;
    enlace.click();
  };

  const formatearMoneda = (centavos: number, moneda: string) => {
    const valor = centavos / 100;
    return valor.toLocaleString('es-MX', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const pestanas: { clave: PestanaDetalle; etiqueta: string }[] = [
    { clave: 'informacion', etiqueta: 'Información' },
    { clave: 'historial', etiqueta: 'Historial' },
    { clave: 'acceso', etiqueta: 'Acceso' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-detalle-titulo"
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-4 px-4 py-4 border-b border-slate-200 sm:px-6">
          <h2
            id="modal-detalle-titulo"
            className="text-sm font-black text-slate-900 uppercase leading-tight sm:text-lg"
          >
            {cargandoSalon
              ? 'Cargando información del salón'
              : `Información del salón ${salon?.nombre ?? ''}`}
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
        <div className="grid grid-cols-3 border-b border-slate-200 bg-white">
          {pestanas.map((p) => (
            <button
              key={p.clave}
              onClick={() => setPestana(p.clave)}
              className={`min-w-0 px-2 py-3 text-center text-[10px] font-black uppercase transition-all sm:text-xs ${
                pestana === p.clave
                  ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
          {cargandoSalon ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <EsqueletoTarjeta key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : salon && pestana === 'informacion' ? (
            <div className="space-y-4">
              <CampoEditable
                etiqueta="Nombre del salón"
                campo="nombre"
                valor={obtenerValorCampo('nombre', salon.nombre)}
                onChange={(campo, valor) => editarCampo(campo, limpiarNombreSalonEntrada(valor))}
              />
              <CampoEditable
                etiqueta="Nombre completo del dueño"
                campo="propietario"
                valor={obtenerValorCampo('propietario', salon.propietario)}
                onChange={(campo, valor) => editarCampo(campo, limpiarNombrePersonaEntrada(valor))}
              />
              <CampoEditable
                etiqueta="Teléfono"
                campo="telefono"
                valor={obtenerValorCampo('telefono', salon.telefono)}
                tipo="tel"
                onChange={(campo, valor) => editarCampo(campo, limpiarTelefonoEntrada(valor))}
              />
              <CampoEditable
                etiqueta="Correo del dueño"
                campo="emailDueno"
                valor={obtenerValorCampo('emailDueno', emailDuenoActual)}
                tipo="email"
                onChange={editarCampo}
              />
              <CampoEditable
                etiqueta="Dirección"
                campo="direccion"
                valor={obtenerValorCampo('direccion', salon.direccion)}
                onChange={editarCampo}
              />
              <CampoEditable
                etiqueta="Descripción"
                campo="descripcion"
                valor={obtenerValorCampo('descripcion', salon.descripcion)}
                onChange={editarCampo}
              />

              <CampoEditable
                etiqueta="Contraseña del salón"
                campo="contrasenaDueno"
                valor={obtenerValorCampo('contrasenaDueno', '')}
                tipo="password"
                placeholder="Solo si deseas cambiarla"
                onChange={editarCampo}
              />

              {obtenerValorCampo('emailDueno', emailDuenoActual) &&
              !esEmailSalonValido(obtenerValorCampo('emailDueno', emailDuenoActual)) ? (
                <p className="text-xs font-bold text-red-500">
                  El correo del dueño debe ser personal y estar dentro de los dominios permitidos.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CampoSoloLectura etiqueta="País" valor={salon.pais} />
                <CampoEditableSelect
                  etiqueta="Plan"
                  campo="plan"
                  valor={obtenerValorCampo('plan', salon.plan)}
                  opciones={['STANDARD', 'PRO']}
                  onChange={editarCampo}
                />
                <CampoSoloLectura etiqueta="Estado" valor={salon.estado} />
                <CampoSoloLectura etiqueta="Creado" valor={formatearFechaHumana(salon.creadoEn)} />
                <CampoEditable
                  etiqueta="Inicio de suscripción"
                  campo="inicioSuscripcion"
                  valor={obtenerValorCampo('inicioSuscripcion', salon.inicioSuscripcion)}
                  tipo="date"
                  onChange={editarCampo}
                />
                <CampoEditable
                  etiqueta="Vencimiento"
                  campo="fechaVencimiento"
                  valor={obtenerValorCampo('fechaVencimiento', salon.fechaVencimiento)}
                  tipo="date"
                  onChange={editarCampo}
                />
              </div>

              {salon.usuarios.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs font-black text-slate-400 uppercase mb-1">
                    Cuenta del dueño
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {salon.usuarios[0]!.nombre} — {salon.usuarios[0]!.email}
                  </p>
                </div>
              )}

              {erroresGuardado && (
                <p className="text-xs font-bold text-red-500">{erroresGuardado}</p>
              )}

              {hayCambios && (
                <button
                  onClick={() => guardar()}
                  disabled={guardando}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-pink-600 text-white font-black text-sm hover:bg-pink-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Actualizando...' : 'Actualizar'}
                </button>
              )}
            </div>
          ) : salon && pestana === 'historial' ? (
            <div>
              {cargandoHistorial ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <EsqueletoTarjeta key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : historial && historial.datos.length > 0 ? (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Fecha
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Concepto
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Plan
                        </th>
                        <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.datos.map((p) => (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 px-2 text-slate-600">
                            {formatearFechaHumana(p.fechaPago)}
                          </td>
                          <td className="py-3 px-2 font-bold text-slate-900">{p.concepto}</td>
                          <td className="py-3 px-2 text-slate-600">{p.plan}</td>
                          <td className="py-3 px-2 text-right font-black text-slate-900">
                            {formatearMoneda(p.monto, p.moneda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs font-bold text-slate-500">
                      Página {paginaHistorial} de {historial.totalPaginas}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaginaHistorial((p) => Math.max(1, p - 1))}
                        disabled={paginaHistorial <= 1}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() =>
                          setPaginaHistorial((p) => (p < historial.totalPaginas ? p + 1 : p))
                        }
                        disabled={paginaHistorial >= historial.totalPaginas}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-slate-400 font-bold py-8">Sin historial de pagos</p>
              )}
            </div>
          ) : salon && pestana === 'acceso' ? (
            <div className="space-y-5">
              {/* Clave del salón */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase">Clave del salón</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900">
                    {salon.claveCliente}
                  </code>
                  <button
                    onClick={() => copiar('clave', salon.claveCliente)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-white transition-colors"
                    aria-label="Copiar clave del salón"
                  >
                    {copiado === 'clave' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* QR */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                <p className="text-xs font-black text-slate-400 uppercase">Código QR</p>
                <div className="flex justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlReserva)}`}
                    alt={`Código QR de ${salon.nombre}`}
                    className="w-48 h-48 rounded-xl"
                    loading="lazy"
                  />
                </div>
                <button
                  onClick={descargarQR}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-sm font-bold transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  Descargar QR
                </button>
              </div>

              {/* Link de reserva */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase">Enlace de reserva</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700 truncate">
                    {urlReserva}
                  </code>
                  <button
                    onClick={() => copiar('link', urlReserva)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-white transition-colors"
                    aria-label="Copiar enlace de reserva"
                  >
                    {copiado === 'link' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.open(enlaceWhatsApp, '_blank', 'noopener,noreferrer')}
                disabled={!enlaceWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white text-sm font-black transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" /> Compartir por WhatsApp
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponentes internos ─────────────────────────────────────────────────

function CampoEditable({
  etiqueta,
  campo,
  valor,
  tipo = 'text',
  placeholder,
  onChange,
}: {
  etiqueta: string;
  campo: string;
  valor: string;
  tipo?: 'text' | 'email' | 'password' | 'date' | 'tel';
  placeholder?: string;
  onChange: (campo: string, valor: string) => void;
}) {
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const esPassword = tipo === 'password';

  const copiarValor = async () => {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Silenciar fallo de portapapeles
    }
  };

  return (
    <label className="block">
      <span className="text-xs font-black text-slate-400 uppercase">{etiqueta}</span>
      <div className="relative mt-1">
        <input
          type={esPassword ? (mostrarContrasena ? 'text' : 'password') : tipo}
          value={valor}
          onChange={(e) => onChange(campo, e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500 ${esPassword ? 'pr-21' : ''}`}
        />
        {esPassword && (
          <>
            <button
              type="button"
              onClick={() => void copiarValor()}
              className="absolute right-10 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Copiar contraseña"
            >
              {copiado ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMostrarContrasena((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {mostrarContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </>
        )}
      </div>
    </label>
  );
}

function CampoEditableSelect({
  etiqueta,
  campo,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  campo: string;
  valor: string;
  opciones: string[];
  onChange: (campo: string, valor: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-400 uppercase">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(campo, e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500"
      >
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </label>
  );
}

function CampoSoloLectura({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs font-black text-slate-400 uppercase">{etiqueta}</p>
      <p className="text-sm font-bold text-slate-700 mt-0.5">{valor}</p>
    </div>
  );
}
