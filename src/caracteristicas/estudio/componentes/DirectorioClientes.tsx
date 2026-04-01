import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  X,
  Users,
  Phone,
  Mail,
  StickyNote,
  Calendar,
  ChevronRight,
  ChevronDown,
  Save,
} from 'lucide-react';
import { Spinner } from '../../../componentes/ui/Spinner';
import { formatearDinero } from '../../../utils/formato';
import {
  obtenerClientesEstudio,
  obtenerDetalleCliente,
  actualizarNotasCliente,
  type ClienteResumen,
  type ClienteDetalle,
} from '../../../servicios/servicioClientes';

interface PropsDirectorioClientes {
  estudioId: string;
}

function usarDebounce(valor: string, ms: number): string {
  const [valorDebounced, setValorDebounced] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setValorDebounced(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return valorDebounced;
}

function calcularEdadTexto(edad: number): string {
  return `${edad} años`;
}

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

interface PropsPanelCliente {
  clienteId: string;
  onCerrar: () => void;
}

function PanelDetalleCliente({ clienteId, onCerrar }: PropsPanelCliente) {
  const queryClient = useQueryClient();
  const [notas, setNotas] = useState('');
  const [notasGuardadas, setNotasGuardadas] = useState(false);

  const { data: cliente, isLoading } = useQuery<ClienteDetalle>({
    queryKey: ['cliente-detalle', clienteId],
    queryFn: () => obtenerDetalleCliente(clienteId),
  });

  useEffect(() => {
    if (cliente) setNotas(cliente.notas ?? '');
  }, [cliente]);

  const mutacionNotas = useMutation({
    mutationFn: (texto: string) => actualizarNotasCliente(clienteId, texto),
    onSuccess: () => {
      setNotasGuardadas(true);
      setTimeout(() => setNotasGuardadas(false), 2000);
      void queryClient.invalidateQueries({ queryKey: ['cliente-detalle', clienteId] });
      void queryClient.invalidateQueries({ queryKey: ['clientes-estudio'] });
    },
  });

  const guardarNotas = useCallback(() => {
    mutacionNotas.mutate(notas);
  }, [mutacionNotas, notas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Spinner tamaño="lg" />
      </div>
    );
  }

  if (!cliente) return null;

  const esmenor = cliente.edad < 18;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-black">{cliente.nombre}</h3>
            {esmenor && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase rounded-full">
                Menor
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 font-bold">
            {calcularEdadTexto(cliente.edad)} · {cliente.telefono}
          </p>
          {cliente.email && <p className="text-xs text-slate-400 mt-0.5">{cliente.email}</p>}
        </div>
        <button
          onClick={onCerrar}
          aria-label="Cerrar panel de cliente"
          className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="notas-cliente"
            className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"
          >
            <StickyNote className="w-3 h-3" /> Notas del salón
          </label>
          <button
            onClick={guardarNotas}
            disabled={mutacionNotas.isPending}
            className="flex items-center gap-1 text-[10px] font-black text-pink-600 hover:text-pink-500 transition-colors disabled:opacity-50"
            aria-label="Guardar notas del cliente"
          >
            <Save className="w-3 h-3" />
            {notasGuardadas ? 'Guardado ✓' : 'Guardar'}
          </button>
        </div>
        <textarea
          id="notas-cliente"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:border-pink-400 resize-none transition-colors"
          placeholder="Preferencias, alergias, notas de servicio…"
          aria-label="Notas del salón sobre el cliente"
        />
      </div>

      <div>
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Historial de visitas ({cliente.reservas.length})
        </h4>
        {cliente.reservas.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8 font-bold">
            Sin visitas registradas aún
          </p>
        ) : (
          <ul className="space-y-3 overflow-y-auto max-h-80">
            {cliente.reservas.map((r) => (
              <li key={r.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-sm">
                      {formatearFecha(r.fecha)} — {r.horaInicio}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.sucursal}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        r.estado === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : r.estado === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {r.estado === 'completed'
                        ? 'Completada'
                        : r.estado === 'cancelled'
                          ? 'Cancelada'
                          : 'Pendiente'}
                    </span>
                    <p className="text-xs font-black text-slate-700 mt-1">
                      {formatearDinero(r.precioTotal)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function DirectorioClientes({ estudioId }: PropsDirectorioClientes) {
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = usarDebounce(busqueda, 300);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [filaExpandida, setFilaExpandida] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ClienteResumen[]>({
    queryKey: ['clientes-estudio', estudioId, busquedaDebounced],
    queryFn: () => obtenerClientesEstudio(estudioId, busquedaDebounced || undefined),
  });

  const clientes = data ?? [];

  const alternarFila = (id: string) => {
    setFilaExpandida((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex gap-6">
      {/* Lista */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="relative mb-6">
          <label htmlFor="buscar-clientes" className="sr-only">
            Buscar clientes por nombre o teléfono
          </label>
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="buscar-clientes"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-pink-400 transition-colors"
            aria-label="Buscar clientes"
            aria-busy={isLoading}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20" aria-busy="true">
            <Spinner tamaño="lg" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 mx-auto text-slate-200 mb-4" aria-hidden="true" />
            <p className="text-slate-400 font-bold text-sm">
              {busqueda ? 'Sin resultados para esta búsqueda' : 'Aún no hay clientes registrados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th
                    scope="col"
                    className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"
                  >
                    Nombre
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell"
                  >
                    Teléfono
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell"
                  >
                    Edad
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell"
                  >
                    Visitas
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell"
                  >
                    Última visita
                  </th>
                  <th scope="col" className="px-4 py-4">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const expandida = filaExpandida === c.id;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${clienteSeleccionado === c.id ? 'bg-pink-50' : ''}`}
                      onClick={() => {
                        if (window.innerWidth < 768) {
                          alternarFila(c.id);
                        } else {
                          setClienteSeleccionado(c.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (window.innerWidth < 768) {
                            alternarFila(c.id);
                          } else {
                            setClienteSeleccionado(c.id);
                          }
                        }
                      }}
                      aria-label={`Ver detalle de ${c.nombre}`}
                      aria-expanded={expandida}
                    >
                      <td className="px-6 py-4" colSpan={expandida ? 6 : 1}>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800">{c.nombre}</span>
                          {c.edad < 18 && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-black uppercase rounded-full shrink-0">
                              Menor
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 sm:hidden">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" aria-hidden="true" />
                            {c.telefono}
                          </span>
                        </div>

                        {expandida && (
                          <div className="mt-4 md:hidden">
                            <PanelDetalleCliente
                              clienteId={c.id}
                              onCerrar={() => setFilaExpandida(null)}
                            />
                          </div>
                        )}
                      </td>
                      {!expandida && (
                        <>
                          <td className="px-4 py-4 hidden sm:table-cell">
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                              <Phone className="w-3 h-3 text-slate-400" aria-hidden="true" />{' '}
                              {c.telefono}
                            </span>
                            {c.email && (
                              <span className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                                <Mail className="w-3 h-3" aria-hidden="true" /> {c.email}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 hidden md:table-cell text-slate-600 font-medium">
                            {calcularEdadTexto(c.edad)}
                          </td>
                          <td className="px-4 py-4 hidden lg:table-cell text-slate-600 font-bold">
                            {c.totalReservas}
                          </td>
                          <td className="px-4 py-4 hidden lg:table-cell text-slate-400 text-xs font-medium">
                            {c.ultimaVisita ? formatearFecha(c.ultimaVisita) : '—'}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <ChevronDown
                              className="w-4 h-4 text-slate-300 ml-auto md:hidden"
                              aria-hidden="true"
                            />
                            <ChevronRight
                              className="w-4 h-4 text-slate-300 ml-auto hidden md:block"
                              aria-hidden="true"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel lateral */}
      {clienteSeleccionado && (
        <div className="hidden md:block w-96 shrink-0 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <PanelDetalleCliente
            clienteId={clienteSeleccionado}
            onCerrar={() => setClienteSeleccionado(null)}
          />
        </div>
      )}
    </div>
  );
}
