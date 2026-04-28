import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DIAS_SEMANA } from '../../../lib/constantes';
import { obtenerOpcionesMetodosPagoReserva } from '../../../lib/metodosPagoReserva';
import { crearReserva, obtenerDisponibilidadEstudio } from '../../../servicios/servicioReservas';
import { obtenerProductos, type Producto } from '../../../servicios/servicioProductos';
import { esEmailSalonValido } from '../../../utils/formularioSalon';
import { URL_BASE, obtenerCabecerasAutenticadas } from '../../../lib/clienteHTTP';
import { obtenerFechaLocalISO, formatearDinero } from '../../../utils/formato';
import type { Estudio, Moneda, Servicio } from '../../../tipos';

const esquemaFormulario = z.object({
  nombreCliente: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .regex(/^[\p{L}\p{M}\s'’-]+$/u, 'El nombre solo acepta letras, espacios, apóstrofes y guiones'),
  telefonoCliente: z.string().regex(/^[0-9]{10}$/, '10 dígitos sin espacios'),
  fechaNacimiento: z.string().min(1, 'Selecciona una fecha'),
  email: z
    .string()
    .email('Correo inválido')
    .refine((valor) => esEmailSalonValido(valor), {
      message: 'Solo se aceptan correos personales @gmail, @hotmail, @outlook o @yahoo',
    })
    .or(z.literal('')),
  metodoPago: z.enum(['cash', 'card', 'bank_transfer', 'digital_transfer']),
  marcaTinte: z.string().optional(),
  observaciones: z
    .string()
    .trim()
    .max(240, 'Máximo 240 caracteres')
    .regex(
      /^[\p{L}\p{M}\p{N}\s.,:;()¿?¡!'"%/#&+\-–—]*$/u,
      'Las notas solo aceptan letras, números y signos comunes',
    )
    .optional(),
});

type DatosFormulario = z.infer<typeof esquemaFormulario>;

interface PropsModalCrearReservaManual {
  abierto: boolean;
  estudio: Estudio;
  fechaVista: Date;
  onCerrar: () => void;
  onReservaCreada: () => void;
}

const PALABRAS_COLOR = [
  'tinte',
  'color',
  'balayage',
  'babylights',
  'canas',
  'ombré',
  'decoloración',
  'rayitos',
  'mechas',
];

function obtenerFechaDesdeIso(fechaIso: string): Date {
  const partes = fechaIso.split('-');
  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  if (!anio || !mes || !dia) {
    return new Date();
  }

  return new Date(anio, mes - 1, dia);
}

function obtenerFechaIsoLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function obtenerInicioMesIso(fechaIso: string): string {
  const fecha = obtenerFechaDesdeIso(fechaIso);
  fecha.setDate(1);
  return obtenerFechaIsoLocal(fecha);
}

function moverMesIso(fechaIso: string, desplazamientoMeses: number): string {
  const fecha = obtenerFechaDesdeIso(fechaIso);
  fecha.setDate(1);
  fecha.setMonth(fecha.getMonth() + desplazamientoMeses);
  return obtenerFechaIsoLocal(fecha);
}

function construirCuadriculaMes(fechaIso: string): Array<string | null> {
  const inicioMes = obtenerFechaDesdeIso(obtenerInicioMesIso(fechaIso));
  const primerDiaSemana = inicioMes.getDay();
  const diasMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, indice) => {
    const dia = indice - primerDiaSemana + 1;
    if (dia <= 0 || dia > diasMes) {
      return null;
    }

    return obtenerFechaIsoLocal(new Date(inicioMes.getFullYear(), inicioMes.getMonth(), dia));
  });
}

export function ModalCrearReservaManual({
  abierto,
  estudio,
  fechaVista,
  onCerrar,
  onReservaCreada,
}: PropsModalCrearReservaManual) {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [personalSeleccionado, setPersonalSeleccionado] = useState('');
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Servicio[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [productosSeleccionados, setProductosSeleccionados] = useState<Record<string, number>>({});
  const [fechaSeleccionada, setFechaSeleccionada] = useState(obtenerFechaLocalISO(fechaVista));
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaSeleccionadaDate = useMemo(
    () => obtenerFechaDesdeIso(fechaSeleccionada),
    [fechaSeleccionada],
  );
  const inicioMesCalendario = useMemo(
    () => obtenerInicioMesIso(fechaSeleccionada),
    [fechaSeleccionada],
  );
  const fechaMesCalendario = useMemo(
    () => obtenerFechaDesdeIso(inicioMesCalendario),
    [inicioMesCalendario],
  );
  const tituloMesCalendario = fechaMesCalendario.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });
  const cuadriculaMes = useMemo(
    () => construirCuadriculaMes(fechaSeleccionada),
    [fechaSeleccionada],
  );
  const fechasMesConsultables = useMemo(
    () => cuadriculaMes.filter((fecha): fecha is string => Boolean(fecha)),
    [cuadriculaMes],
  );
  const fechaSeleccionadaTexto = fechaSeleccionadaDate.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const miembro = estudio.staff.find((item) => item.id === personalSeleccionado);
  const serviciosDisponibles = personalSeleccionado
    ? estudio.selectedServices.filter((servicio) => miembro?.specialties.includes(servicio.name))
    : [];
  const metodosPagoDisponibles = obtenerOpcionesMetodosPagoReserva(estudio.metodosPagoReserva);
  const totalDuracion = serviciosSeleccionados.reduce(
    (total, servicio) => total + servicio.duration,
    0,
  );
  const totalPrecio = serviciosSeleccionados.reduce((total, servicio) => total + servicio.price, 0);
  const esPlanPro = estudio.plan === 'PRO';
  const nombreDia = DIAS_SEMANA[fechaSeleccionadaDate.getDay()]!;
  const horarioDia = estudio.schedule[nombreDia];
  const esFestivo = estudio.holidays?.includes(fechaSeleccionada) ?? false;
  const duracionConsulta = totalDuracion > 0 ? totalDuracion : 30;
  const puedeConsultarDisponibilidad = Boolean(
    miembro && horarioDia?.isOpen && !esFestivo && serviciosSeleccionados.length > 0,
  );

  useEffect(() => {
    if (!abierto) {
      return;
    }

    setFechaSeleccionada(obtenerFechaLocalISO(fechaVista));
    setHoraSeleccionada('');
  }, [abierto, fechaVista]);

  useEffect(() => {
    if (!abierto || !estudio.id) {
      return;
    }

    const controlador = new AbortController();
    let cancelado = false;

    const procesarEvento = () => {
      void clienteConsulta.invalidateQueries({
        queryKey: ['disponibilidad-estudio', estudio.id, personalSeleccionado],
      });
      void clienteConsulta.invalidateQueries({
        queryKey: ['disponibilidad-estudio-calendario', estudio.id, personalSeleccionado],
      });
    };

    const conectar = async () => {
      while (!cancelado) {
        try {
          const cabeceras = obtenerCabecerasAutenticadas('GET', {
            Accept: 'text/event-stream',
          });

          const respuesta = await fetch(`${URL_BASE}/disponibilidad/stream/${estudio.id}`, {
            method: 'GET',
            headers: cabeceras,
            credentials: 'include',
            signal: controlador.signal,
          });

          if (!respuesta.ok || !respuesta.body) {
            throw new Error('No fue posible abrir el stream de disponibilidad');
          }

          const lector = respuesta.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!cancelado) {
            const lectura = await lector.read();
            if (lectura.done) {
              break;
            }

            buffer += decoder.decode(lectura.value, { stream: true });
            const bloques = buffer.split('\n\n');
            buffer = bloques.pop() ?? '';

            for (const bloque of bloques) {
              const lineas = bloque.split('\n');
              const tipoEvento = lineas
                .find((linea) => linea.startsWith('event:'))
                ?.replace('event:', '')
                .trim();

              if (tipoEvento !== 'disponibilidad') {
                continue;
              }

              procesarEvento();
            }
          }
        } catch {
          if (cancelado || controlador.signal.aborted) {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    };

    void conectar();

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [abierto, clienteConsulta, estudio.id, personalSeleccionado]);

  const consultaDisponibilidad = useQuery({
    queryKey: [
      'disponibilidad-estudio',
      estudio.id,
      personalSeleccionado,
      fechaSeleccionada,
      duracionConsulta,
    ],
    queryFn: () =>
      obtenerDisponibilidadEstudio(
        estudio.id,
        personalSeleccionado,
        fechaSeleccionada,
        duracionConsulta,
      ),
    enabled: puedeConsultarDisponibilidad,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const consultasDisponibilidadMes = useQueries({
    queries: fechasMesConsultables.map((fechaDia) => {
      const fechaDiaDate = obtenerFechaDesdeIso(fechaDia);
      const nombreDiaSemana = DIAS_SEMANA[fechaDiaDate.getDay()]!;
      const horarioDiaSemana = estudio.schedule[nombreDiaSemana];
      const fechaDiaFestiva = estudio.holidays?.includes(fechaDia) ?? false;
      const puedeConsultarDia = Boolean(
        miembro &&
        horarioDiaSemana?.isOpen &&
        !fechaDiaFestiva &&
        serviciosSeleccionados.length > 0,
      );

      return {
        queryKey: [
          'disponibilidad-estudio-calendario',
          estudio.id,
          personalSeleccionado,
          fechaDia,
          duracionConsulta,
        ],
        queryFn: async () => {
          const slots = await obtenerDisponibilidadEstudio(
            estudio.id,
            personalSeleccionado,
            fechaDia,
            duracionConsulta,
          );
          return slots.filter((slot) => slot.status === 'AVAILABLE').length;
        },
        enabled: puedeConsultarDia,
        staleTime: 10_000,
        refetchOnWindowFocus: true,
      };
    }),
  });

  const consultaProductos = useQuery<Producto[]>({
    queryKey: ['productos-reserva-manual', estudio.id],
    queryFn: () => obtenerProductos(estudio.id),
    enabled: abierto && esPlanPro,
    staleTime: 60_000,
  });

  const productosDisponibles = (consultaProductos.data ?? []).filter((producto) => producto.activo);
  const productosSeleccionadosListado = productosDisponibles
    .filter((producto) => (productosSeleccionados[producto.id] ?? 0) > 0)
    .map((producto) => ({
      ...producto,
      cantidad: productosSeleccionados[producto.id] ?? 0,
    }));
  const totalProductos = productosSeleccionadosListado.reduce(
    (total, producto) => total + producto.precio * producto.cantidad,
    0,
  );
  const totalGeneral = totalPrecio + totalProductos;
  const slotsDisponibles = (consultaDisponibilidad.data ?? []).filter(
    (slot) => slot.status === 'AVAILABLE',
  );
  const disponibilidadPorFecha = new Map(
    fechasMesConsultables.map((fechaDia, indice) => {
      const fechaDiaDate = obtenerFechaDesdeIso(fechaDia);
      const nombreDiaSemana = DIAS_SEMANA[fechaDiaDate.getDay()]!;
      const horarioDiaSemana = estudio.schedule[nombreDiaSemana];
      const fechaDiaFestiva = estudio.holidays?.includes(fechaDia) ?? false;
      const consultaDia = consultasDisponibilidadMes[indice];
      const totalSlots = consultaDia?.data ?? 0;
      const cargandoDia = Boolean(consultaDia?.isLoading || consultaDia?.isFetching);
      const errorDia = Boolean(consultaDia?.isError);
      const seleccionado = fechaDia === fechaSeleccionada;
      const esHoy = fechaDia === obtenerFechaLocalISO(new Date());

      let estado: 'cerrado' | 'sin-servicios' | 'sin-disponibilidad' | 'disponible' | 'error';

      if (!horarioDiaSemana?.isOpen || fechaDiaFestiva) {
        estado = 'cerrado';
      } else if (serviciosSeleccionados.length === 0 || !miembro) {
        estado = 'sin-servicios';
      } else if (errorDia) {
        estado = 'error';
      } else if (!cargandoDia && totalSlots <= 0) {
        estado = 'sin-disponibilidad';
      } else {
        estado = 'disponible';
      }

      return [
        fechaDia,
        {
          fechaDia,
          fechaDiaDate,
          totalSlots,
          cargandoDia,
          estado,
          seleccionado,
          esHoy,
        },
      ] as const;
    }),
  );
  const disponibilidadMes = cuadriculaMes.map((fechaDia) => {
    if (!fechaDia) {
      return null;
    }

    return disponibilidadPorFecha.get(fechaDia) ?? null;
  });

  const formulario = useForm<DatosFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: {
      nombreCliente: '',
      telefonoCliente: '',
      fechaNacimiento: '',
      email: '',
      metodoPago: metodosPagoDisponibles[0]?.valor ?? 'cash',
      marcaTinte: '',
      observaciones: '',
    },
  });

  const requiereColor = serviciosSeleccionados.some((servicio) =>
    PALABRAS_COLOR.some((palabra) => servicio.name.toLowerCase().includes(palabra)),
  );

  const mutacionCrear = useMutation({
    mutationFn: async (datos: DatosFormulario) => {
      await crearReserva({
        studioId: estudio.id,
        studioName: estudio.name,
        clientName: datos.nombreCliente,
        clientPhone: datos.telefonoCliente,
        fechaNacimiento: datos.fechaNacimiento,
        email: datos.email,
        services: serviciosSeleccionados,
        totalDuration: totalDuracion,
        totalPrice: totalPrecio,
        status: 'confirmed',
        branch: estudio.name,
        staffId: personalSeleccionado,
        staffName: miembro?.name ?? '',
        colorBrand: requiereColor ? datos.marcaTinte || null : null,
        colorNumber: null,
        observaciones: datos.observaciones || null,
        paymentMethod: datos.metodoPago,
        productosSeleccionados: Object.entries(productosSeleccionados)
          .filter(([, cantidad]) => cantidad > 0)
          .map(([productoId, cantidad]) => ({ productoId, cantidad })),
        date: fechaSeleccionada,
        time: horaSeleccionada,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      mostrarToast({ mensaje: 'Cita creada correctamente', variante: 'exito' });
      formulario.reset({
        nombreCliente: '',
        telefonoCliente: '',
        fechaNacimiento: '',
        email: '',
        metodoPago: metodosPagoDisponibles[0]?.valor ?? 'cash',
        marcaTinte: '',
        observaciones: '',
      });
      setPersonalSeleccionado('');
      setServiciosSeleccionados([]);
      setHoraSeleccionada('');
      setProductosSeleccionados({});
      onReservaCreada();
      onCerrar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo crear la cita',
        variante: 'error',
      });
    },
  });

  function alternarServicio(servicio: Servicio) {
    setServiciosSeleccionados((actuales) => {
      const existe = actuales.some((item) => item.name === servicio.name);
      return existe
        ? actuales.filter((item) => item.name !== servicio.name)
        : [...actuales, servicio];
    });
    setHoraSeleccionada('');
  }

  function seleccionarFechaCalendario(fechaDia: string) {
    setFechaSeleccionada(fechaDia);
    setHoraSeleccionada('');
  }

  function cambiarMes(desplazamiento: number) {
    setFechaSeleccionada((actual) => moverMesIso(actual, desplazamiento));
    setHoraSeleccionada('');
  }

  function cambiarPersonal(personalId: string) {
    setPersonalSeleccionado(personalId);
    setServiciosSeleccionados((actuales) => {
      const miembroSiguiente = estudio.staff.find((item) => item.id === personalId);
      if (!miembroSiguiente) return [];

      return actuales.filter((servicio) => miembroSiguiente.specialties.includes(servicio.name));
    });
    setHoraSeleccionada('');
  }

  function alternarProducto(productoId: string) {
    setProductosSeleccionados((actual) => {
      if (actual[productoId]) {
        const siguiente = { ...actual };
        delete siguiente[productoId];
        return siguiente;
      }

      return {
        ...actual,
        [productoId]: 1,
      };
    });
  }

  function cambiarCantidadProducto(productoId: string, cantidad: number) {
    setProductosSeleccionados((actual) => {
      if (cantidad <= 0) {
        const siguiente = { ...actual };
        delete siguiente[productoId];
        return siguiente;
      }

      return {
        ...actual,
        [productoId]: Math.min(20, Math.max(1, cantidad)),
      };
    });
  }

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-210 bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-crear-cita"
    >
      <div className="mx-auto flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-4xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="titulo-crear-cita" className="text-xl font-black text-slate-900">
              Crear cita manual
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-500">
              <CalendarDays className="h-4 w-4 text-pink-500" aria-hidden="true" />
              {fechaSeleccionadaTexto}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={formulario.handleSubmit((datos) => mutacionCrear.mutate(datos))}
          className="grid gap-6 overflow-y-auto px-6 py-6 md:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="personal-manual"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Especialista
              </label>
              <select
                id="personal-manual"
                value={personalSeleccionado}
                onChange={(evento) => cambiarPersonal(evento.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="">Selecciona un especialista</option>
                {estudio.staff
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Servicios</p>
              {serviciosDisponibles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Selecciona primero un especialista.
                </p>
              ) : (
                <div className="grid gap-2">
                  {serviciosDisponibles.map((servicio, indiceServicio) => {
                    const activo = serviciosSeleccionados.some(
                      (item) => item.name === servicio.name,
                    );
                    return (
                      <button
                        key={`${servicio.name}-${indiceServicio}`}
                        type="button"
                        onClick={() => alternarServicio(servicio)}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${activo ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'}`}
                      >
                        <span className="font-bold">{servicio.name}</span>
                        <span className="text-xs font-black">
                          {formatearDinero(servicio.price, moneda)} · {servicio.duration} min
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Calendario en tiempo real
                    </p>
                    <p className="text-sm font-black capitalize text-slate-800">
                      {tituloMesCalendario}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cambiarMes(-1)}
                      aria-label="Mes anterior"
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarMes(1)}
                      aria-label="Mes siguiente"
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-wide text-slate-400">
                  {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((diaSemana, indice) => (
                    <div key={`${diaSemana}-${indice}`} className="py-1">
                      {diaSemana}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {disponibilidadMes.map((dia, indice) => {
                    if (!dia) {
                      return (
                        <div key={`vacio-${indice}`} className="h-20 rounded-2xl bg-transparent" />
                      );
                    }

                    const numeroDia = dia.fechaDiaDate.toLocaleDateString('es-MX', {
                      day: '2-digit',
                    });
                    const claseEstado =
                      dia.estado === 'cerrado'
                        ? 'border-slate-200 bg-slate-100 text-slate-500'
                        : dia.estado === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : dia.estado === 'sin-disponibilidad'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : dia.estado === 'sin-servicios'
                              ? 'border-slate-200 bg-white text-slate-400'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700';

                    return (
                      <button
                        key={dia.fechaDia}
                        type="button"
                        onClick={() => seleccionarFechaCalendario(dia.fechaDia)}
                        className={`h-20 rounded-2xl border px-2 py-2 text-center transition-colors ${claseEstado} ${
                          dia.seleccionado ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                        }`}
                      >
                        <span className="block pt-2 text-lg font-black leading-none">
                          {numeroDia}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Horario disponible</p>
              {!horarioDia?.isOpen || esFestivo ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  El salón no recibe citas en esta fecha.
                </p>
              ) : serviciosSeleccionados.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Selecciona servicios para ver disponibilidad en tiempo real.
                </p>
              ) : consultaDisponibilidad.isLoading ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Consultando horarios disponibles...
                </p>
              ) : slotsDisponibles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  No hay horarios disponibles para la combinación seleccionada.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slotsDisponibles.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setHoraSeleccionada(slot.time)}
                      className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${horaSeleccionada === slot.time ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {esPlanPro && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                  Productos adicionales (opcional)
                </p>
                {consultaProductos.isLoading ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                    Cargando productos...
                  </p>
                ) : productosDisponibles.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                    No hay productos activos en el catálogo.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {productosDisponibles.map((producto) => {
                      const activo = (productosSeleccionados[producto.id] ?? 0) > 0;
                      return (
                        <div
                          key={producto.id}
                          className={`rounded-2xl border px-4 py-3 ${
                            activo ? 'border-pink-300 bg-pink-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => alternarProducto(producto.id)}
                              className="text-left"
                            >
                              <p className="text-sm font-bold text-slate-800">{producto.nombre}</p>
                              <p className="text-xs font-medium text-slate-500">
                                {producto.categoria || 'General'} ·{' '}
                                {formatearDinero(producto.precio, moneda)}
                              </p>
                            </button>
                            {activo && (
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={productosSeleccionados[producto.id] ?? 1}
                                onChange={(evento) =>
                                  cambiarCantidadProducto(
                                    producto.id,
                                    Number.parseInt(evento.target.value, 10) || 1,
                                  )
                                }
                                className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-700"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-3xl bg-pink-50 p-4 border border-pink-200">
              <p className="text-xs font-bold uppercase tracking-widest text-pink-600">Resumen</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>
                  Especialista: <span className="font-bold">{miembro?.name || 'Pendiente'}</span>
                </p>
                <p>
                  Fecha y hora:{' '}
                  <span className="font-bold">
                    {fechaSeleccionadaDate.toLocaleDateString('es-MX')} ·{' '}
                    {horaSeleccionada || 'Pendiente'}
                  </span>
                </p>
                <p>
                  Cliente:{' '}
                  <span className="font-bold">
                    {formulario.watch('nombreCliente') || 'Pendiente'}
                  </span>
                </p>
                <p>
                  Teléfono:{' '}
                  <span className="font-bold">
                    {formulario.watch('telefonoCliente') || 'Pendiente'}
                  </span>
                </p>
                <p>
                  Email: <span className="font-bold">{formulario.watch('email') || 'N/A'}</span>
                </p>
                <p>
                  Método de pago:{' '}
                  <span className="font-bold">{formulario.watch('metodoPago') || 'Pendiente'}</span>
                </p>
                <p>
                  Servicios:{' '}
                  <span className="font-bold">
                    {serviciosSeleccionados.length > 0
                      ? serviciosSeleccionados.map((servicio) => servicio.name).join(', ')
                      : 'Pendiente'}
                  </span>
                </p>
                {productosSeleccionadosListado.length > 0 && (
                  <p>
                    Productos:{' '}
                    <span className="font-bold">
                      {productosSeleccionadosListado
                        .map((producto) => `${producto.nombre} x${producto.cantidad}`)
                        .join(', ')}
                    </span>
                  </p>
                )}
                <p>
                  Observaciones:{' '}
                  <span className="font-bold">{formulario.watch('observaciones') || 'N/A'}</span>
                </p>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">
                {serviciosSeleccionados.length} servicio(s) · {totalDuracion} min
              </p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                Servicios: {formatearDinero(totalPrecio, moneda)}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                Productos: {formatearDinero(totalProductos, moneda)}
              </p>
              <p className="mt-1 text-2xl font-black text-pink-700">
                Total: {formatearDinero(totalGeneral, moneda)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="nombreCliente"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Nombre del cliente
              </label>
              <input
                id="nombreCliente"
                type="text"
                {...formulario.register('nombreCliente')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.nombreCliente && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.nombreCliente.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="telefonoCliente"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Teléfono
              </label>
              <input
                id="telefonoCliente"
                type="tel"
                {...formulario.register('telefonoCliente')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.telefonoCliente && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.telefonoCliente.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="metodoPago"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Método de pago
              </label>
              <select
                id="metodoPago"
                {...formulario.register('metodoPago')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                {metodosPagoDisponibles.map((metodo) => (
                  <option key={metodo.valor} value={metodo.valor}>
                    {metodo.etiqueta}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                El cobro se realiza al finalizar el servicio, directamente en el salón.
              </p>
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                {...formulario.register('email')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.email && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              Salón: {estudio.name}
            </div>
            {requiereColor && (
              <div>
                <label
                  htmlFor="marcaTinte"
                  className="mb-1 block text-xs font-bold uppercase text-slate-500"
                >
                  Color o tono solicitado (opcional)
                </label>
                <input
                  id="marcaTinte"
                  type="text"
                  placeholder="Ej: rubio ceniza, tinte 7.1"
                  {...formulario.register('marcaTinte')}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="observaciones"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Notes (optional)
              </label>
              <textarea
                id="observaciones"
                rows={3}
                maxLength={240}
                placeholder="Alergias, preferencias, solicitudes especiales..."
                {...formulario.register('observaciones')}
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.observaciones && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.observaciones.message}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  mutacionCrear.isPending ||
                  !personalSeleccionado ||
                  !horaSeleccionada ||
                  serviciosSeleccionados.length === 0
                }
                className="flex-1 rounded-2xl bg-pink-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutacionCrear.isPending ? 'Guardando...' : 'Crear cita'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
