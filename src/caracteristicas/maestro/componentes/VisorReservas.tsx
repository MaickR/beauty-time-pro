import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  XCircle,
  Download,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  Mail,
  Link as IconoLink,
  RefreshCcw,
  QrCode,
} from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { formatearDinero } from '../../../utils/formato';
import type { Estudio, Reserva, Moneda } from '../../../tipos';

const RESERVAS_POR_PAGINA = 15;

interface PropsVisorReservas {
  estudio: Estudio;
  reservas: Reserva[];
  onCerrar: () => void;
}

type TabDetalle = 'historial' | 'acceso';

interface RespuestaResetContrasena {
  datos: {
    email: string;
    contrasenaTemporal: string;
  };
}

function aplicarEstiloCelda(
  hoja: Record<string, unknown>,
  referencia: string,
  estilo: Record<string, unknown>,
) {
  const celda = hoja[referencia] as Record<string, unknown> | undefined;
  if (!celda) return;
  celda.s = estilo;
}

export function VisorReservas({ estudio, reservas, onCerrar }: PropsVisorReservas) {
  const [paginaActual, setPaginaActual] = useState(1);
  const [tabActiva, setTabActiva] = useState<TabDetalle>('historial');
  const [qrReserva, setQrReserva] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [reseteandoContrasena, setReseteandoContrasena] = useState(false);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);
  const [credencialesTemporales, setCredencialesTemporales] = useState<{
    email: string;
    contrasena: string;
  } | null>(null);
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaArchivo = new Date().toLocaleDateString('sv-SE');
  const nombreSalonArchivo = estudio.name.replace(/\s+/g, '_');
  const enlaceReservas = `${window.location.origin}/reservar/${estudio.clientKey}`;
  const reservasEstudio = reservas
    .filter((b) => b.studioId === estudio.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalPaginas = Math.max(1, Math.ceil(reservasEstudio.length / RESERVAS_POR_PAGINA));
  const inicio = (paginaActual - 1) * RESERVAS_POR_PAGINA;
  const reservasPagina = reservasEstudio.slice(inicio, inicio + RESERVAS_POR_PAGINA);

  useEffect(() => {
    let activo = true;

    void QRCode.toDataURL(enlaceReservas, {
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
  }, [enlaceReservas]);

  const copiarTexto = async (clave: string, valor: string) => {
    await navigator.clipboard.writeText(valor);
    setCopiado(clave);
    window.setTimeout(() => setCopiado((actual) => (actual === clave ? null : actual)), 1800);
  };

  const descargarQr = () => {
    if (!qrReserva) return;
    const fecha = new Date()
      .toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .replace(/ /g, '')
      .toUpperCase();
    const nombreArchivo = `${estudio.name.replace(/\s+/g, '_').toUpperCase()}_${fecha}.png`;
    const enlace = document.createElement('a');
    enlace.href = qrReserva;
    enlace.download = nombreArchivo;
    enlace.click();
  };

  const resetearContrasena = async () => {
    setReseteandoContrasena(true);
    setErrorAcceso(null);
    try {
      const respuesta = await peticion<RespuestaResetContrasena>(
        `/admin/salones/${estudio.id}/reset-contrasena`,
        { method: 'PUT' },
      );
      setCredencialesTemporales({
        email: respuesta.datos.email,
        contrasena: respuesta.datos.contrasenaTemporal,
      });
    } catch (error) {
      setErrorAcceso(error instanceof Error ? error.message : 'No se pudo resetear la contraseña.');
    } finally {
      setReseteandoContrasena(false);
    }
  };

  const exportarExcel = async () => {
    const { utils, writeFile } = await import('xlsx');

    const etiquetaEstado = (status: string | undefined) => {
      if (status === 'completed') return 'Pagado';
      if (status === 'cancelled') return 'Cancelado';
      return 'Pendiente';
    };

    const cabeceras = [
      'Fecha',
      'Hora',
      'Estatus',
      'Cliente',
      'Teléfono',
      'Especialista',
      'Servicios',
      'Duración (min)',
      `Monto (${moneda})`,
      'Marca Tinte',
      'Tono Tinte',
    ];

    const filas = reservasEstudio.map((b) => [
      b.date,
      b.time,
      etiquetaEstado(b.status),
      b.clientName,
      b.clientPhone,
      b.staffName,
      b.services.map((s) => s.name).join(' + '),
      b.totalDuration,
      b.totalPrice ?? 0,
      b.colorBrand ?? '',
      b.colorNumber ?? '',
    ]);

    const totalMonto = reservasEstudio.reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);
    const datos = [
      [`Historial de Reservaciones — ${estudio.name}`],
      [
        `Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      ],
      [],
      cabeceras,
      ...filas,
      [],
      [
        'Total de reservas',
        reservasEstudio.length,
        '',
        '',
        '',
        '',
        '',
        'Ingresos',
        totalMonto,
        '',
        '',
      ],
    ];

    const hoja = utils.aoa_to_sheet(datos);
    hoja['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    ];

    const estiloTitulo = {
      font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'F48FB1' } },
      alignment: { horizontal: 'center' },
    };
    const estiloFecha = {
      font: { color: { rgb: '6B7280' }, italic: true },
      fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
    };
    const estiloEncabezado = {
      font: { bold: true, color: { rgb: '831843' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FCE4EC' } },
      border: {
        top: { style: 'thin', color: { rgb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
        left: { style: 'thin', color: { rgb: 'F3F4F6' } },
        right: { style: 'thin', color: { rgb: 'F3F4F6' } },
      },
    };
    const estiloLateral = {
      border: {
        left: { style: 'thin', color: { rgb: 'F3F4F6' } },
        right: { style: 'thin', color: { rgb: 'F3F4F6' } },
      },
    };
    const estiloTotal = {
      font: { bold: true },
      fill: { patternType: 'solid', fgColor: { rgb: 'FCE7F3' } },
    };

    for (let columna = 0; columna <= 10; columna += 1) {
      aplicarEstiloCelda(
        hoja as Record<string, unknown>,
        utils.encode_cell({ r: 0, c: columna }),
        estiloTitulo,
      );
      aplicarEstiloCelda(
        hoja as Record<string, unknown>,
        utils.encode_cell({ r: 1, c: columna }),
        estiloFecha,
      );
      aplicarEstiloCelda(
        hoja as Record<string, unknown>,
        utils.encode_cell({ r: 3, c: columna }),
        estiloEncabezado,
      );
    }

    filas.forEach((_, indice) => {
      const fondo = indice % 2 === 0 ? 'FFFFFF' : 'FAFAFA';
      for (let columna = 0; columna <= 10; columna += 1) {
        aplicarEstiloCelda(
          hoja as Record<string, unknown>,
          utils.encode_cell({ r: indice + 4, c: columna }),
          {
            ...estiloLateral,
            fill: { patternType: 'solid', fgColor: { rgb: fondo } },
          },
        );
      }
    });

    for (let columna = 0; columna <= 10; columna += 1) {
      aplicarEstiloCelda(
        hoja as Record<string, unknown>,
        utils.encode_cell({ r: datos.length - 1, c: columna }),
        {
          ...estiloLateral,
          ...estiloTotal,
        },
      );
    }

    hoja['!cols'] = cabeceras.map((cabecera, indice) => ({
      wch: Math.max(
        cabecera.length + 4,
        ...filas.map((fila) => String(fila[indice] ?? '').length + 2),
      ),
    }));

    const libro = utils.book_new();
    utils.book_append_sheet(libro, hoja, 'Reservaciones');
    writeFile(libro, `Reservas_${nombreSalonArchivo}_${fechaArchivo}.xlsx`);
  };

  const exportarPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Historial de reservaciones', 14, 16);
    doc.setFontSize(10);
    doc.text(`Salón: ${estudio.name}`, 14, 24);
    const totalMonto = reservasEstudio.reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);
    autoTable(doc, {
      startY: 30,
      head: [
        [
          'Fecha',
          'Hora',
          'Estatus',
          'Cliente',
          'Teléfono',
          'Especialista',
          'Servicios',
          'Duración (min)',
          'Monto',
        ],
      ],
      body: [
        ...reservasEstudio.map((b) => [
          b.date,
          b.time,
          b.status === 'completed'
            ? 'Pagado'
            : b.status === 'cancelled'
              ? 'Cancelado'
              : 'Pendiente',
          b.clientName,
          b.clientPhone,
          b.staffName,
          b.services.map((s) => s.name).join(', '),
          String(b.totalDuration),
          formatearDinero(b.totalPrice, moneda),
        ]),
        ['', '', '', '', '', '', '', 'TOTAL', formatearDinero(totalMonto, moneda)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [194, 24, 91] },
      didParseCell: (data) => {
        if (data.row.index === reservasEstudio.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 250, 252];
        }
      },
    });
    doc.save(`Reservas_${nombreSalonArchivo}_${fechaArchivo}.pdf`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="visor-titulo"
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-60 flex items-center justify-center p-4"
    >
      <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-4xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b bg-slate-50">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2
                id="visor-titulo"
                className="text-2xl font-black italic uppercase tracking-tighter"
              >
                Detalle del salón
              </h2>
              <p className="text-xs font-bold text-slate-500">
                Studio: <span className="text-pink-600">{estudio.name}</span>
              </p>
            </div>
            <div className="hidden md:flex flex-wrap items-center gap-2 md:gap-4">
              {tabActiva === 'historial' && (
                <>
                  <button
                    onClick={() => void exportarExcel()}
                    className="no-imprimir flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-green-700 transition-all"
                  >
                    <Download className="w-4 h-4" /> Exportar Excel
                  </button>
                  <button
                    onClick={() => void exportarPDF()}
                    className="no-imprimir flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all"
                    aria-label="Generar PDF"
                  >
                    <FileDown className="w-4 h-4" /> Generar PDF
                  </button>
                </>
              )}
              <button onClick={onCerrar} className="no-imprimir ml-4" aria-label="Cerrar visor">
                <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTabActiva('historial')}
              className={`rounded-2xl px-4 py-2 text-xs font-black uppercase transition-colors ${tabActiva === 'historial' ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
            >
              Historial
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('acceso')}
              className={`rounded-2xl px-4 py-2 text-xs font-black uppercase transition-colors ${tabActiva === 'acceso' ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
            >
              Acceso
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {tabActiva === 'acceso' ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="space-y-4 rounded-4xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-pink-600">
                  <KeyRound className="h-4 w-4" /> Acceso
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Clave de acceso del salón
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarTexto('clave-salon', estudio.assignedKey)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase text-slate-600"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiado === 'clave-salon' ? 'Copiada' : 'Copiar'}
                    </button>
                  </div>
                  <code className="block break-all font-mono text-sm font-black tracking-[0.2em] text-slate-900">
                    {estudio.assignedKey}
                  </code>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <Mail className="h-3.5 w-3.5" /> Email del dueño
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {estudio.emailContacto ?? 'No disponible'}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      <IconoLink className="h-3.5 w-3.5" /> Link de reservas
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarTexto('link-reservas', enlaceReservas)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase text-slate-600"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiado === 'link-reservas' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="break-all text-sm font-semibold text-slate-700">{enlaceReservas}</p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Credenciales del dueño
                    </span>
                    <button
                      type="button"
                      onClick={() => void resetearContrasena()}
                      disabled={reseteandoContrasena}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase text-white disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      {reseteandoContrasena ? 'Reseteando' : 'Resetear contraseña'}
                    </button>
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p>
                      <span className="font-black text-slate-900">Email:</span>{' '}
                      {estudio.emailContacto ?? 'No disponible'}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">Contraseña:</span> ••••••••
                    </p>
                  </div>
                  {errorAcceso && (
                    <p className="mt-3 text-sm font-medium text-red-600">{errorAcceso}</p>
                  )}
                  {credencialesTemporales && (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <p className="font-black uppercase text-[10px] tracking-[0.2em] text-emerald-700">
                        Contraseña temporal nueva
                      </p>
                      <p className="mt-2 font-semibold">{credencialesTemporales.email}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <code className="font-mono font-black tracking-[0.22em]">
                          {credencialesTemporales.contrasena}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            copiarTexto('contrasena-temporal', credencialesTemporales.contrasena)
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-emerald-300 px-3 py-1 text-[10px] font-black uppercase text-emerald-800"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiado === 'contrasena-temporal' ? 'Copiada' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <aside className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                      <QrCode className="h-4 w-4" /> QR descargable
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Generado dinámicamente desde la URL pública de reservas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={descargarQr}
                    disabled={!qrReserva}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" /> Descargar
                  </button>
                </div>

                <div className="flex min-h-70 items-center justify-center rounded-4xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  {qrReserva ? (
                    <img
                      src={qrReserva}
                      alt="QR de acceso a reservas"
                      className="w-full max-w-60"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">Generando QR...</span>
                  )}
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    <span className="font-black text-slate-900">ClaveClientes:</span>{' '}
                    {estudio.clientKey}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    La reserva pública usa {enlaceReservas} y respeta el entorno actual.
                  </p>
                </div>
              </aside>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2 md:hidden">
                <button
                  onClick={() => void exportarExcel()}
                  className="no-imprimir flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-green-700 transition-all"
                >
                  <Download className="w-4 h-4" /> Exportar Excel
                </button>
                <button
                  onClick={() => void exportarPDF()}
                  className="no-imprimir flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all"
                  aria-label="Generar PDF"
                >
                  <FileDown className="w-4 h-4" /> Generar PDF
                </button>
              </div>

              <div className="space-y-4 md:hidden">
                {reservasPagina.map((b) => (
                  <article
                    key={b.id}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{b.clientName}</p>
                        <p className="mt-1 text-xs font-mono text-slate-500">{b.clientPhone}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                          b.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : b.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {b.status === 'completed'
                          ? 'Pagado'
                          : b.status === 'cancelled'
                            ? 'Cancelado'
                            : 'Pendiente'}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p>
                        <span className="font-black text-slate-900">Fecha:</span> {b.date}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Hora:</span> {b.time}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Duración:</span>{' '}
                        {b.totalDuration} min
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Especialista:</span>{' '}
                        {b.staffName}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Servicios:</span>{' '}
                        {b.services.map((s) => s.name).join(' + ')}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Monto:</span>{' '}
                        {formatearDinero(b.totalPrice, moneda)}
                      </p>
                      {(b.colorBrand ?? b.colorNumber) && (
                        <p>
                          <span className="font-black text-slate-900">Tinte:</span> {b.colorBrand}{' '}
                          {b.colorNumber}
                        </p>
                      )}
                    </div>
                  </article>
                ))}

                {reservasEstudio.length === 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-400 font-bold italic">
                    No hay citas registradas.
                  </div>
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-205 text-left border-collapse">
                  <thead className="bg-slate-100 rounded-xl">
                    <tr>
                      {[
                        'Fecha/Hora',
                        'Estatus',
                        'Cliente / Contacto',
                        'Especialista',
                        'Servicios & Monto',
                      ].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reservasPagina.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-black text-slate-900 text-sm">
                          {b.date}
                          <br />
                          <span className="text-pink-600 text-xs">
                            {b.time} ({b.totalDuration}m)
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                              b.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : b.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {b.status === 'completed'
                              ? 'Pagado'
                              : b.status === 'cancelled'
                                ? 'Cancelado'
                                : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-700 uppercase text-xs">
                            {b.clientName}
                          </p>
                          <p className="font-mono text-xs text-slate-500 mt-1">{b.clientPhone}</p>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700 uppercase text-xs">
                          {b.staffName}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {b.services.map((s, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-200 px-2 py-1 rounded-md text-[9px] font-black uppercase"
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs font-black text-green-600 mt-1">
                            {formatearDinero(b.totalPrice, moneda)}
                          </p>
                          {(b.colorBrand ?? b.colorNumber) && (
                            <p className="text-[8px] font-black text-pink-600 uppercase mt-2 bg-pink-50 p-1 rounded inline-block">
                              Tinte: {b.colorBrand} {b.colorNumber}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reservasEstudio.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center p-10 text-slate-400 font-bold italic"
                        >
                          No hay citas registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div className="p-6 border-t flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-bold text-slate-500">
                    Mostrando {inicio + 1}–
                    {Math.min(inicio + RESERVAS_POR_PAGINA, reservasEstudio.length)} de{' '}
                    <span className="text-slate-900">{reservasEstudio.length}</span> reservaciones
                  </p>
                  <div className="no-imprimir flex items-center gap-2">
                    <button
                      onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                      aria-label="Página anterior"
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-black text-slate-700 px-2">
                      {paginaActual} / {totalPaginas}
                    </span>
                    <button
                      onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                      disabled={paginaActual === totalPaginas}
                      aria-label="Página siguiente"
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
