import { useState } from 'react';
import { XCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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

  const exportarCSV = () => {
    let csv =
      'Fecha,Hora,Estatus,Cliente,Telefono,Especialista,Servicios,Duracion(min),Monto,Marca Tinte,Tono Tinte\n';
    reservasEstudio.forEach((b) => {
      const serviciosStr = b.services.map((s) => s.name).join(' + ');
      csv += `${b.date},${b.time},${b.status ?? 'Pendiente'},"${b.clientName}","${b.clientPhone}",${b.staffName},"${serviciosStr}",${b.totalDuration},${b.totalPrice ?? 0},"${b.colorBrand ?? ''}","${b.colorNumber ?? ''}"\n`;
    });
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `Reservas_${estudio.name.replace(/\s+/g, '_')}.csv`;
    enlace.style.visibility = 'hidden';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
  };

  const imprimirHistorial = () => {
    const ventana = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
    if (!ventana) return;

    const filas =
      reservasPagina.length === 0
        ? '<tr><td colspan="5" style="padding: 32px; text-align: center; color: #64748b; font-weight: 700;">No hay citas registradas.</td></tr>'
        : reservasPagina
            .map((reserva) => {
              const estado =
                reserva.status === 'completed'
                  ? 'Pagado'
                  : reserva.status === 'cancelled'
                    ? 'Cancelado'
                    : 'Pendiente';
              const servicios = reserva.services.map((servicio) => servicio.name).join(', ');
              const tinte =
                (reserva.colorBrand ?? reserva.colorNumber)
                  ? `<div style="margin-top: 8px; font-size: 11px; font-weight: 700; color: #be185d;">Tinte: ${reserva.colorBrand ?? ''} ${reserva.colorNumber ?? ''}</div>`
                  : '';

              return `
            <tr>
              <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">
                ${reserva.date}<br />
                <span style="font-size: 12px; color: #db2777;">${reserva.time} (${reserva.totalDuration}m)</span>
              </td>
              <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; color: #334155; font-weight: 700;">${estado}</td>
              <td style="padding: 14px; border-bottom: 1px solid #e2e8f0;">
                <div style="font-weight: 700; color: #334155;">${reserva.clientName}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${reserva.clientPhone}</div>
              </td>
              <td style="padding: 14px; border-bottom: 1px solid #e2e8f0; color: #334155; font-weight: 700;">${reserva.staffName}</td>
              <td style="padding: 14px; border-bottom: 1px solid #e2e8f0;">
                <div style="color: #334155;">${servicios}</div>
                <div style="margin-top: 6px; color: #16a34a; font-weight: 700;">${formatearDinero(reserva.totalPrice, moneda)}</div>
                ${tinte}
              </td>
            </tr>`;
            })
            .join('');

    ventana.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Historial de reservaciones</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            p { margin: 0 0 20px; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            thead th { text-align: left; padding: 14px; background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; }
            @media print { body { margin: 16px; } }
          </style>
        </head>
        <body>
          <h1>Historial de reservaciones</h1>
          <p>Salón: ${estudio.name} · Página ${paginaActual} de ${totalPaginas}</p>
          <table>
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Estatus</th>
                <th>Cliente / Contacto</th>
                <th>Especialista</th>
                <th>Servicios &amp; Monto</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
    ventana.close();
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
              onClick={exportarCSV}
              className="no-imprimir flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-green-700 transition-all"
            >
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
            <button
              onClick={imprimirHistorial}
              className="no-imprimir flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all"
              aria-label="Imprimir historial"
            >
              Imprimir
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
