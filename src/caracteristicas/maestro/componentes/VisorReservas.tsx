import { useState } from 'react';
import { XCircle, Download, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatearDinero } from '../../../utils/formato';
import type { Estudio, Reserva, Moneda } from '../../../tipos';

const RESERVAS_POR_PAGINA = 15;

interface PropsVisorReservas {
  estudio: Estudio;
  reservas: Reserva[];
  onCerrar: () => void;
}

export function VisorReservas({ estudio, reservas, onCerrar }: PropsVisorReservas) {
  const [paginaActual, setPaginaActual] = useState(1);
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const reservasEstudio = reservas
    .filter((b) => b.studioId === estudio.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalPaginas = Math.max(1, Math.ceil(reservasEstudio.length / RESERVAS_POR_PAGINA));
  const inicio = (paginaActual - 1) * RESERVAS_POR_PAGINA;
  const reservasPagina = reservasEstudio.slice(inicio, inicio + RESERVAS_POR_PAGINA);

  const exportarExcel = async () => {
    const { utils, writeFile } = await import('xlsx');

    const etiquetaEstado = (status: string | undefined) => {
      if (status === 'completed') return 'Pagado';
      if (status === 'cancelled') return 'Cancelado';
      return 'Pendiente';
    };

    const totalMonto = reservasEstudio.reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);

    // Fila de título del reporte
    const tituloReporte = [
      [`Historial de Reservaciones — ${estudio.name}`],
      [
        `Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      ],
      [],
    ];

    // Cabeceras de columnas
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

    // Filas de datos
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

    // Fila de total
    const filaTotalEtiqueta = ['', '', '', '', '', '', '', 'TOTAL', totalMonto, '', ''];

    const datos = [...tituloReporte, cabeceras, ...filas, [], filaTotalEtiqueta];

    const hoja = utils.aoa_to_sheet(datos);

    // Anchos de columna en caracteres
    hoja['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 8 }, // Hora
      { wch: 12 }, // Estatus
      { wch: 26 }, // Cliente
      { wch: 16 }, // Teléfono
      { wch: 22 }, // Especialista
      { wch: 40 }, // Servicios
      { wch: 14 }, // Duración
      { wch: 16 }, // Monto
      { wch: 16 }, // Marca Tinte
      { wch: 14 }, // Tono Tinte
    ];

    const libro = utils.book_new();
    utils.book_append_sheet(libro, hoja, 'Reservaciones');
    writeFile(
      libro,
      `Reservas_${estudio.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
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
      bodyStyles: {},
      didParseCell: (data) => {
        if (data.row.index === reservasEstudio.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 250, 252];
        }
      },
    });
    doc.save(
      `Reservas_${estudio.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="visor-titulo"
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[60] flex items-center justify-center p-4"
    >
      <div
        data-area-imprimir="historial-reservas"
        className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 id="visor-titulo" className="text-2xl font-black italic uppercase tracking-tighter">
              Historial de Reservaciones
            </h2>
            <p className="text-xs font-bold text-slate-500">
              Studio: <span className="text-pink-600">{estudio.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
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
            <button onClick={onCerrar} className="no-imprimir ml-4" aria-label="Cerrar visor">
              <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <table className="w-full text-left border-collapse">
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
                    <p className="font-bold text-slate-700 uppercase text-xs">{b.clientName}</p>
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
                  <td colSpan={5} className="text-center p-10 text-slate-400 font-bold italic">
                    No hay citas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Controles de paginación */}
        {totalPaginas > 1 && (
          <div className="p-6 border-t flex items-center justify-between">
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
      </div>
    </div>
  );
}
