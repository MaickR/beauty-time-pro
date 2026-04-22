import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Store,
  Users,
  ListChecks,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Spinner } from '../../componentes/ui/Spinner';
import { IconoMarcaAplicacion, MarcaAplicacion } from '../../componentes/ui/MarcaAplicacion';
import { SelectorHora } from '../../componentes/ui/SelectorHora';
import {
  CATALOGO_SERVICIOS,
  DIAS_SEMANA,
  obtenerEtiquetaServicioCatalogo,
} from '../../lib/constantes';
import {
  ErrorServicioRegistro,
  registrarSalon,
  verificarDisponibilidadEmail,
} from '../../servicios/servicioRegistro';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { convertirCentavosAMoneda, convertirMonedaACentavos } from '../../utils/formato';
import type { Pais, Personal, Servicio, ServicioPersonalizado, TurnoTrabajo } from '../../tipos';

const DOMINIOS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'hotmail.com.mx',
  'hotmail.com.co',
  'outlook.com',
  'outlook.es',
  'outlook.com.mx',
  'live.com',
  'live.com.mx',
  'live.com.co',
  'yahoo.com',
  'yahoo.es',
  'yahoo.com.mx',
  'yahoo.com.co',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'pm.me',
];
const DOMINIOS_MSG = 'Solo aceptamos correos de Gmail, Hotmail, Outlook, Yahoo o iCloud';
const COLOR_PRIMARIO_PREDETERMINADO = '#C6968C';

function esDomPermitido(email: string) {
  const dom = email.split('@')[1]?.toLowerCase();
  return dom !== undefined && DOMINIOS.includes(dom);
}

const esquemaPaso1 = z
  .object({
    nombre: z.string().min(2, 'MÃ­nimo 2 caracteres'),
    apellido: z.string().min(2, 'MÃ­nimo 2 caracteres'),
    email: z.string().email('Correo invÃ¡lido').refine(esDomPermitido, DOMINIOS_MSG),
    contrasena: z
      .string()
      .min(8, 'MÃ­nimo 8 caracteres')
      .regex(/[A-Z]/, 'Necesita una mayÃºscula')
      .regex(/[0-9]/, 'Necesita un nÃºmero')
      .regex(/[^A-Za-z0-9]/, 'Necesita un carÃ¡cter especial'),
    confirmarContrasena: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.confirmarContrasena, {
    message: 'Las contraseÃ±as no coinciden',
    path: ['confirmarContrasena'],
  });

const esquemaPaso2 = z.object({
  nombreSalon: z.string().min(2, 'MÃ­nimo 2 caracteres'),
  direccion: z.string().min(5, 'Ingresa una direcciÃ³n vÃ¡lida'),
  telefono: z.string().regex(/^[0-9+\s\-()]{7,15}$/, 'TelÃ©fono invÃ¡lido'),
  pais: z.enum(['Mexico', 'Colombia']),
  numeroEspecialistas: z.string().regex(/^[1-9]\d*$/, 'MÃ­nimo 1 especialista'),
});

type Paso1 = z.infer<typeof esquemaPaso1>;
type Paso2 = z.infer<typeof esquemaPaso2>;
type HorarioLocal = Record<string, TurnoTrabajo>;
type PersonalRegistro = Pick<
  Personal,
  'name' | 'specialties' | 'shiftStart' | 'shiftEnd' | 'breakStart' | 'breakEnd'
>;
type EtapaOperacion = 'basico' | 'horario' | 'servicios' | 'personal';

function crearHorarioInicial(): HorarioLocal {
  return DIAS_SEMANA.reduce<HorarioLocal>((acumulado, dia) => {
    acumulado[dia] = {
      isOpen: dia !== 'Domingo',
      openTime: '09:00',
      closeTime: '19:00',
    };
    return acumulado;
  }, {});
}

function crearEspecialistaVacio(indice: number): PersonalRegistro {
  return {
    name: `Especialista ${indice + 1}`,
    specialties: [],
    shiftStart: '09:00',
    shiftEnd: '19:00',
    breakStart: '14:00',
    breakEnd: '15:00',
  };
}

function sincronizarEspecialistas(
  actuales: PersonalRegistro[],
  cantidad: number,
): PersonalRegistro[] {
  if (cantidad <= 0) return [crearEspecialistaVacio(0)];
  if (actuales.length === cantidad) return actuales;
  if (actuales.length > cantidad) return actuales.slice(0, cantidad);

  const nuevos = [...actuales];
  while (nuevos.length < cantidad) {
    nuevos.push(crearEspecialistaVacio(nuevos.length));
  }
  return nuevos;
}

function calcularRequisitosContrasena(contrasena: string) {
  return {
    longitudMinima: contrasena.length >= 8,
    tieneMayuscula: /[A-Z]/.test(contrasena),
    tieneNumero: /[0-9]/.test(contrasena),
    tieneEspecial: /[^A-Za-z0-9]/.test(contrasena),
  };
}

function calcularFortaleza(contrasena: string) {
  const requisitos = calcularRequisitosContrasena(contrasena);
  const nivel = [
    requisitos.longitudMinima,
    requisitos.tieneMayuscula,
    requisitos.tieneNumero,
    requisitos.tieneEspecial,
  ].filter(Boolean).length;

  const colores = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  const etiquetas = ['DÃ©bil', 'Regular', 'Buena', 'Fuerte'];
  return {
    nivel,
    etiqueta: etiquetas[nivel - 1] ?? 'DÃ©bil',
    color: colores[nivel - 1] ?? 'bg-red-400',
  };
}

function normalizarDiaAtencion(dia: string): string {
  return dia
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatearPrecioInput(valor: string, paisActual: Pais): string {
  const limpio = valor.replace(/[^\d]/g, '');
  if (!limpio) return '';
  if (limpio.length > 8) return formatearPrecioInput(limpio.slice(0, 8), paisActual);
  const numero = Number(limpio);
  return numero.toLocaleString(paisActual === 'Colombia' ? 'es-CO' : 'es-MX');
}

function formatearPrecioCentavosInput(valor: number, paisActual: Pais): string {
  if (valor <= 0) return '';
  return convertirCentavosAMoneda(valor).toLocaleString(
    paisActual === 'Colombia' ? 'es-CO' : 'es-MX',
  );
}

function limpiarPrecio(valor: string): number {
  return Math.max(100, convertirMonedaACentavos(Number(valor.replace(/[^\d]/g, '')) || 0));
}

function obtenerResumenHorario(horario: HorarioLocal) {
  const diasAbiertos = Object.entries(horario).filter(([, valor]) => valor.isOpen);
  const horasApertura = diasAbiertos.map(([, valor]) => valor.openTime).sort();
  const horasCierre = diasAbiertos.map(([, valor]) => valor.closeTime).sort();

  return {
    horarioApertura: horasApertura[0] ?? '09:00',
    horarioCierre: horasCierre[horasCierre.length - 1] ?? '18:00',
    diasAtencion: diasAbiertos.map(([dia]) => normalizarDiaAtencion(dia)).join(','),
  };
}

function convertirPersonalRegistro(personal: PersonalRegistro[]) {
  return personal.map((persona) => ({
    nombre: persona.name.trim(),
    especialidades: persona.specialties,
    horaInicio: persona.shiftStart ?? '09:00',
    horaFin: persona.shiftEnd ?? '19:00',
    descansoInicio: persona.breakStart ?? null,
    descansoFin: persona.breakEnd ?? null,
  }));
}

function validarInformacionBaseSalon(
  nombreSalon: string,
  direccion: string,
  telefono: string,
  numeroEspecialistas: string,
  sucursales: string[],
) {
  if (nombreSalon.trim().length < 2) return 'Escribe un nombre vÃ¡lido para el salÃ³n.';
  if (direccion.trim().length < 5) return 'Ingresa una direcciÃ³n principal vÃ¡lida.';
  if (!/^[0-9+\s\-()]{7,15}$/.test(telefono.trim())) return 'Ingresa un telÃ©fono vÃ¡lido.';
  if (!/^\d+$/.test(numeroEspecialistas.trim()) || Number(numeroEspecialistas) < 1)
    return 'Debes registrar al menos un especialista.';

  const sucursalesValidas = sucursales.map((sucursal) => sucursal.trim()).filter(Boolean);
  if (sucursalesValidas.length === 0) return 'Debes registrar al menos una sucursal.';

  return null;
}

function validarHorarioSalon(horario: HorarioLocal) {
  const diasAbiertos = Object.values(horario).filter((dia) => dia.isOpen);
  if (diasAbiertos.length === 0) return 'Debes abrir al menos un dÃ­a de atenciÃ³n.';

  const horarioInvalido = Object.entries(horario).find(
    ([, turno]) => turno.isOpen && turno.closeTime <= turno.openTime,
  );
  if (horarioInvalido) return `El horario de ${horarioInvalido[0]} es invÃ¡lido.`;

  return null;
}

function validarServiciosSalon(servicios: Servicio[]) {
  if (servicios.length === 0) return 'Debes registrar al menos un servicio del salÃ³n.';

  const servicioSinDuracion = servicios.find((servicio) => servicio.duration <= 0);
  if (servicioSinDuracion)
    return `El servicio ${servicioSinDuracion.name} debe tener una duraciÃ³n mayor a 0.`;

  const servicioSinPrecioValido = servicios.find((servicio) => servicio.price < 100);
  if (servicioSinPrecioValido)
    return `El servicio ${servicioSinPrecioValido.name} debe tener un precio mayor a 0.`;

  return null;
}

function validarEquipoSalon(personal: PersonalRegistro[]) {
  const personalSinNombre = personal.find((persona) => persona.name.trim().length < 2);
  if (personalSinNombre) return 'Cada especialista debe tener un nombre completo.';

  const personalSinEspecialidades = personal.find((persona) => persona.specialties.length === 0);
  if (personalSinEspecialidades)
    return 'Cada especialista debe tener al menos un servicio asignado.';

  const personalConTurnoInvalido = personal.find(
    (persona) => (persona.shiftEnd ?? '00:00') <= (persona.shiftStart ?? '00:00'),
  );
  if (personalConTurnoInvalido) return `El turno de ${personalConTurnoInvalido.name} es invÃ¡lido.`;

  const personalConAlmuerzoInvalido = personal.find((persona) => {
    if (!persona.breakStart || !persona.breakEnd) return false;
    return persona.breakEnd <= persona.breakStart;
  });
  if (personalConAlmuerzoInvalido)
    return `El horario de almuerzo de ${personalConAlmuerzoInvalido.name} es invÃ¡lido.`;

  return null;
}

function TarjetaEtapaOperacion({
  activa,
  bloqueada,
  completada,
  descripcion,
  detalle,
  onActivar,
  titulo,
  children,
}: {
  activa: boolean;
  bloqueada?: boolean;
  completada?: boolean;
  descripcion: string;
  detalle?: string;
  onActivar?: () => void;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[28px] border bg-white shadow-sm transition-all ${activa ? 'border-pink-200 ring-1 ring-pink-100' : 'border-slate-200'}`}
    >
      <button
        type="button"
        onClick={onActivar}
        disabled={bloqueada || !onActivar}
        className={`flex w-full items-start justify-between gap-4 px-6 py-5 text-left ${bloqueada ? 'cursor-not-allowed bg-slate-50/80' : 'hover:bg-slate-50/70'}`}
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900">{titulo}</h2>
            {completada && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
            {bloqueada && <Lock className="h-4 w-4 text-slate-400" aria-hidden="true" />}
          </div>
          <p className="mt-1 text-sm text-slate-500">{descripcion}</p>
          {!activa && detalle && (
            <p className="mt-3 text-xs font-semibold text-slate-400">{detalle}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${completada ? 'bg-emerald-50 text-emerald-700' : activa ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}
        >
          {bloqueada ? 'Bloqueado' : activa ? 'En ediciÃ³n' : completada ? 'Listo' : 'Pendiente'}
        </span>
      </button>

      {activa && <div className="border-t border-slate-100 px-6 py-6">{children}</div>}
    </section>
  );
}

export function PaginaRegistroSalon() {
  usarTituloPagina('Registrar salÃ³n â€” Beauty Time Pro');
  const navegar = useNavigate();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [datosPaso1, setDatosPaso1] = useState<Paso1 | null>(null);
  const [etapaOperacionActiva, setEtapaOperacionActiva] = useState<EtapaOperacion>('basico');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [verificandoDisponibilidad, setVerificandoDisponibilidad] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');
  const [sucursales, setSucursales] = useState<string[]>(() => {
    try {
      const guardado = localStorage.getItem('formulario_registro_salon');
      if (guardado) {
        const datos = JSON.parse(guardado) as Record<string, unknown>;
        if (Array.isArray(datos.sucursales) && (datos.sucursales as unknown[]).length > 0) {
          return datos.sucursales as string[];
        }
      }
    } catch {
      /* ignorar datos corruptos */
    }
    return [''];
  });
  const [horarioLocal, setHorarioLocal] = useState<HorarioLocal>(crearHorarioInicial());
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Servicio[]>([]);
  const [serviciosPersonalizados, setServiciosPersonalizados] = useState<ServicioPersonalizado[]>(
    [],
  );
  const [entradaServicioPersonalizado, setEntradaServicioPersonalizado] = useState<
    Record<string, string>
  >({});
  const [personal, setPersonal] = useState<PersonalRegistro[]>([crearEspecialistaVacio(0)]);
  const [preciosFormateados, setPreciosFormateados] = useState<Record<string, string>>({});

  const CLAVE_ALMACEN = 'formulario_registro_salon';

  const formPaso1 = useForm<Paso1>({
    resolver: zodResolver(esquemaPaso1),
    defaultValues: datosPaso1 ?? undefined,
  });

  const formPaso2 = useForm<Paso2>({
    resolver: zodResolver(esquemaPaso2),
    defaultValues: {
      nombreSalon: '',
      direccion: '',
      telefono: '',
      pais: 'Mexico',
      numeroEspecialistas: '1',
    },
  });

  // Restaurar datos de localStorage al montar
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_ALMACEN);
      if (!guardado) return;
      const datos = JSON.parse(guardado) as Record<string, unknown>;
      if (datos.paso1) {
        const p1 = datos.paso1 as Record<string, string>;
        formPaso1.reset({
          nombre: p1.nombre ?? '',
          apellido: p1.apellido ?? '',
          email: p1.email ?? '',
          contrasena: '',
          confirmarContrasena: '',
        });
      }
      if (datos.paso2) {
        const p2 = datos.paso2 as Record<string, string>;
        formPaso2.reset({
          nombreSalon: p2.nombreSalon ?? '',
          direccion: p2.direccion ?? '',
          telefono: p2.telefono ?? '',
          pais: (p2.pais as Pais) ?? 'Mexico',
          numeroEspecialistas: p2.numeroEspecialistas ?? '1',
        });
      }
      if (datos.sucursales && Array.isArray(datos.sucursales))
        setSucursales(datos.sucursales as string[]);
      if (datos.paso && (datos.paso === 1 || datos.paso === 2)) setPaso(datos.paso as 1 | 2);
    } catch {
      /* ignorar datos corruptos */
    }
  }, []);

  // Guardar en localStorage cuando cambian los datos
  useEffect(() => {
    const sub1 = formPaso1.watch((vals) => {
      try {
        const actual = JSON.parse(localStorage.getItem(CLAVE_ALMACEN) ?? '{}');
        actual.paso1 = { nombre: vals.nombre, apellido: vals.apellido, email: vals.email };
        actual.paso = paso;
        localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(actual));
      } catch {
        /* ignorar */
      }
    });
    return () => sub1.unsubscribe();
  }, [formPaso1, paso]);

  useEffect(() => {
    const sub2 = formPaso2.watch((vals) => {
      try {
        const actual = JSON.parse(localStorage.getItem(CLAVE_ALMACEN) ?? '{}');
        actual.paso2 = vals;
        actual.paso = paso;
        localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(actual));
      } catch {
        /* ignorar */
      }
    });
    return () => sub2.unsubscribe();
  }, [formPaso2, paso]);

  useEffect(() => {
    try {
      const actual = JSON.parse(localStorage.getItem(CLAVE_ALMACEN) ?? '{}');
      actual.sucursales = sucursales;
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(actual));
    } catch {
      /* ignorar */
    }
  }, [sucursales]);

  const limpiarFormulario = () => {
    localStorage.removeItem(CLAVE_ALMACEN);
    formPaso1.reset({
      nombre: '',
      apellido: '',
      email: '',
      contrasena: '',
      confirmarContrasena: '',
    });
    formPaso2.reset({
      nombreSalon: '',
      direccion: '',
      telefono: '',
      pais: 'Mexico',
      numeroEspecialistas: '1',
    });
    setSucursales(['']);
    setHorarioLocal(crearHorarioInicial());
    setServiciosSeleccionados([]);
    setServiciosPersonalizados([]);
    setPersonal([crearEspecialistaVacio(0)]);
    setPreciosFormateados({});
    setPaso(1);
    setDatosPaso1(null);
    setEtapaOperacionActiva('basico');
    setErrorServidor('');
  };

  const contrasena = formPaso1.watch('contrasena') ?? '';
  const numeroEspecialistas = formPaso2.watch('numeroEspecialistas') ?? '1';
  const nombreSalon = formPaso2.watch('nombreSalon') ?? '';
  const direccion = formPaso2.watch('direccion') ?? '';
  const telefono = formPaso2.watch('telefono') ?? '';
  const pais = formPaso2.watch('pais') ?? 'Mexico';
  const fortaleza = calcularFortaleza(contrasena);
  const serviciosDisponibles = useMemo(
    () => serviciosSeleccionados.map((servicio) => servicio.name),
    [serviciosSeleccionados],
  );
  const resumenHorario = useMemo(() => obtenerResumenHorario(horarioLocal), [horarioLocal]);
  const errorInformacionBase = useMemo(
    () =>
      validarInformacionBaseSalon(
        nombreSalon,
        direccion,
        telefono,
        numeroEspecialistas,
        sucursales,
      ),
    [direccion, nombreSalon, numeroEspecialistas, telefono, sucursales],
  );
  const errorHorario = useMemo(() => validarHorarioSalon(horarioLocal), [horarioLocal]);
  const errorServicios = useMemo(
    () => validarServiciosSalon(serviciosSeleccionados),
    [serviciosSeleccionados],
  );
  const errorPersonal = useMemo(() => validarEquipoSalon(personal), [personal]);

  const porcentajeProgreso = useMemo(() => {
    let completados = 0;
    const total = 4;
    if (errorInformacionBase === null) completados++;
    if (errorHorario === null) completados++;
    if (errorServicios === null) completados++;
    if (errorPersonal === null) completados++;
    return Math.round((completados / total) * 100);
  }, [errorInformacionBase, errorHorario, errorServicios, errorPersonal]);
  const informacionBaseLista = errorInformacionBase === null;
  const horarioListo = errorHorario === null;
  const serviciosListos = errorServicios === null;
  const personalListo = errorPersonal === null;
  const etapasVisibles: EtapaOperacion[] = [
    'basico',
    ...(informacionBaseLista || etapaOperacionActiva !== 'basico' ? ['horario' as const] : []),
    ...((informacionBaseLista && horarioListo) ||
    ['servicios', 'personal'].includes(etapaOperacionActiva)
      ? ['servicios' as const]
      : []),
    ...((informacionBaseLista && horarioListo && serviciosListos) ||
    ['personal'].includes(etapaOperacionActiva)
      ? ['personal' as const]
      : []),
  ];

  useEffect(() => {
    const cantidad = Math.max(1, Math.min(100, Number(numeroEspecialistas) || 1));
    setPersonal((actual) => sincronizarEspecialistas(actual, cantidad));
  }, [numeroEspecialistas]);

  const avanzarAlPaso2 = async () => {
    setErrorServidor('');
    formPaso1.clearErrors('email');

    const esValido = await formPaso1.trigger([
      'nombre',
      'apellido',
      'email',
      'contrasena',
      'confirmarContrasena',
    ]);
    if (!esValido) return;

    const datos = formPaso1.getValues();
    setVerificandoDisponibilidad(true);

    try {
      await verificarDisponibilidadEmail(datos.email);
      setDatosPaso1(datos);
      setPaso(2);
      setEtapaOperacionActiva('basico');
    } catch (error) {
      if (error instanceof ErrorServicioRegistro && error.codigo === 'EMAIL_DUPLICADO') {
        formPaso1.setError('email', {
          type: 'manual',
          message: 'Este correo ya estÃ¡ registrado. Â¿Quieres iniciar sesiÃ³n?',
        });
      } else {
        setErrorServidor(
          error instanceof Error
            ? error.message
            : 'No fue posible validar el correo. Intenta nuevamente.',
        );
      }
    } finally {
      setVerificandoDisponibilidad(false);
    }
  };

  const actualizarHorarioDia = (dia: string, cambios: Partial<TurnoTrabajo>) => {
    setHorarioLocal((actual) => ({
      ...actual,
      [dia]: { ...actual[dia], ...cambios },
    }));
  };

  const agregarSucursal = () => {
    setSucursales((actual) => (actual.length >= 20 ? actual : [...actual, '']));
  };

  const actualizarSucursal = (indice: number, valor: string) => {
    setSucursales((actual) => actual.map((sucursal, idx) => (idx === indice ? valor : sucursal)));
  };

  const eliminarSucursal = (indice: number) => {
    setSucursales((actual) =>
      actual.length === 1 ? actual : actual.filter((_, idx) => idx !== indice),
    );
  };

  const alternarServicio = (categoria: string, nombreServicio: string) => {
    const existe = serviciosSeleccionados.some((servicio) => servicio.name === nombreServicio);

    if (existe) {
      setServiciosSeleccionados((actual) =>
        actual.filter((servicio) => servicio.name !== nombreServicio),
      );
      setServiciosPersonalizados((actual) =>
        actual.filter((servicio) => servicio.name !== nombreServicio),
      );
      setPersonal((actual) =>
        actual.map((persona) => ({
          ...persona,
          specialties: persona.specialties.filter(
            (especialidad) => especialidad !== nombreServicio,
          ),
        })),
      );
      return;
    }

    setServiciosSeleccionados((actual) => [
      ...actual,
      { name: nombreServicio, duration: 30, price: 100, category: categoria },
    ]);
  };

  const actualizarCampoServicio = (
    nombreServicio: string,
    campo: 'duration' | 'price',
    valor: string,
  ) => {
    setServiciosSeleccionados((actual) =>
      actual.map((servicio) => {
        if (servicio.name !== nombreServicio) return servicio;
        return {
          ...servicio,
          [campo]:
            campo === 'price' ? Math.max(100, Number(valor) || 0) : Math.max(5, Number(valor) || 0),
        };
      }),
    );
  };

  const agregarServicioPersonalizado = (categoria: string) => {
    const nombre = entradaServicioPersonalizado[categoria]?.trim();
    if (!nombre) return;
    if (
      serviciosSeleccionados.some(
        (servicio) => servicio.name.toLowerCase() === nombre.toLowerCase(),
      )
    )
      return;

    setServiciosSeleccionados((actual) => [
      ...actual,
      { name: nombre, duration: 30, price: 100, category: categoria },
    ]);
    setServiciosPersonalizados((actual) => [...actual, { name: nombre, category: categoria }]);
    setEntradaServicioPersonalizado((actual) => ({ ...actual, [categoria]: '' }));
  };

  const actualizarPersonal = (indice: number, cambios: Partial<PersonalRegistro>) => {
    setPersonal((actual) =>
      actual.map((persona, idx) => (idx === indice ? { ...persona, ...cambios } : persona)),
    );
  };

  const alternarEspecialidadPersonal = (indice: number, especialidad: string) => {
    setPersonal((actual) =>
      actual.map((persona, idx) => {
        if (idx !== indice) return persona;
        const existe = persona.specialties.includes(especialidad);
        return {
          ...persona,
          specialties: existe
            ? persona.specialties.filter((item) => item !== especialidad)
            : [...persona.specialties, especialidad],
        };
      }),
    );
  };

  const validarConfiguracionSalon = () => {
    return errorInformacionBase ?? errorHorario ?? errorServicios ?? errorPersonal ?? null;
  };

  const continuarEtapaOperacion = async () => {
    setErrorServidor('');

    if (etapaOperacionActiva === 'basico') {
      const esValido = await formPaso2.trigger([
        'nombreSalon',
        'direccion',
        'telefono',
        'pais',
        'numeroEspecialistas',
      ]);
      if (!esValido) return;
      if (errorInformacionBase) {
        setErrorServidor(errorInformacionBase);
        return;
      }
      setEtapaOperacionActiva('horario');
      return;
    }

    if (etapaOperacionActiva === 'horario') {
      if (errorHorario) {
        setErrorServidor(errorHorario);
        return;
      }
      setEtapaOperacionActiva('servicios');
      return;
    }

    if (etapaOperacionActiva === 'servicios') {
      if (errorServicios) {
        setErrorServidor(errorServicios);
        return;
      }
      setEtapaOperacionActiva('personal');
      return;
    }

    if (etapaOperacionActiva === 'personal') {
      if (errorPersonal) {
        setErrorServidor(errorPersonal);
        return;
      }
    }
  };

  const alEnviarPaso2 = async (datos: Paso2) => {
    if (!datosPaso1) {
      setErrorServidor(
        'La sesiÃ³n del formulario se ha perdido. Por favor completa los datos de la cuenta nuevamente.',
      );
      setPaso(1);
      return;
    }

    const errorConfiguracion = validarConfiguracionSalon();
    if (errorConfiguracion) {
      setErrorServidor(errorConfiguracion);
      return;
    }

    setErrorServidor('');

    try {
      const sucursalesValidas = sucursales.map((sucursal) => sucursal.trim()).filter(Boolean);
      const resumenHorario = obtenerResumenHorario(horarioLocal);

      await registrarSalon({
        ...datosPaso1,
        ...datos,
        pais: datos.pais as Pais,
        sucursales: sucursalesValidas,
        horario: horarioLocal,
        servicios: serviciosSeleccionados,
        serviciosCustom: serviciosPersonalizados,
        personal: convertirPersonalRegistro(personal),
        horarioApertura: resumenHorario.horarioApertura,
        horarioCierre: resumenHorario.horarioCierre,
        diasAtencion: resumenHorario.diasAtencion,
        numeroEspecialistas: personal.length,
        colorPrimario: COLOR_PRIMARIO_PREDETERMINADO,
      });

      localStorage.removeItem(CLAVE_ALMACEN);
      navegar('/espera-aprobacion');
    } catch (error) {
      setErrorServidor(
        error instanceof Error ? error.message : 'OcurriÃ³ un error. Intenta de nuevo.',
      );
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffafc] lg:grid lg:grid-cols-[minmax(320px,420px)_1fr]">
      <div className="hidden lg:block lg:p-6">
        <div className="flex min-h-[calc(100vh-3rem)] flex-col justify-between overflow-hidden rounded-[36px] bg-linear-to-br from-[#143C32] via-[#C6968C] to-[#78736E] p-10 shadow-2xl shadow-pink-900/20">
          <MarcaAplicacion variante="oscura" tamano="lg" />

          <div className="space-y-8 text-white">
            <div>
              <IconoMarcaAplicacion
                tamano="hero"
                alt=""
                className="mb-4 border-white/10 bg-white/10 opacity-85 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
              />
              <h2 className="max-w-sm text-4xl font-black leading-tight">
                Registra tu salÃ³n con una experiencia mÃ¡s clara y guiada
              </h2>
              <p className="mt-4 max-w-sm text-base leading-7 text-white/75">
                Avanza por bloques cortos. Solo pedimos lo indispensable para dejar listo el perfil
                operativo del salÃ³n.
              </p>
            </div>

            <div className="space-y-3 rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">
                Lo que vas a completar
              </p>
              {[
                'Datos del salÃ³n y sucursales',
                'Horario local por dÃ­a',
                'Servicios con duraciÃ³n y precio',
                'Especialistas con turnos y almuerzo',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-white/85">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-white/80" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white/55">Â© {new Date().getFullYear()} Beauty Time Pro</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <MarcaAplicacion className="mb-6 justify-center lg:hidden" />

          <div className="mb-8 w-full max-w-sm mx-auto">
            <div className="flex items-center gap-0 mb-2">
              {[1, 2].map((numero) => (
                <div key={numero} className={`flex items-center ${numero < 2 ? 'flex-1' : ''}`}>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${numero <= paso ? 'bg-pink-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                    >
                      {numero}
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${numero <= paso ? 'text-pink-700' : 'text-slate-400'}`}
                    >
                      {numero === 1 ? 'Cuenta dueÃ±a' : 'OperaciÃ³n del salÃ³n'}
                    </span>
                  </div>
                  {numero < 2 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 rounded ${paso >= 2 ? 'bg-pink-400' : 'bg-slate-200'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {errorServidor && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {errorServidor}
            </div>
          )}

          {paso === 1 && (
            <div className="mx-auto max-w-lg">
              <h1 className="text-3xl font-black text-slate-900 mb-1">
                Datos de la persona dueÃ±a
              </h1>
              <p className="text-slate-500 text-sm mb-7">
                Esta cuenta administrarÃ¡ la solicitud del salÃ³n
              </p>
              <form
                onSubmit={(evento) => {
                  evento.preventDefault();
                  void avanzarAlPaso2();
                }}
                noValidate
                className="space-y-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="flex-1">
                    <label
                      htmlFor="nombre"
                      className="block text-sm font-semibold text-slate-700 mb-1"
                    >
                      Nombre
                    </label>
                    <input
                      id="nombre"
                      type="text"
                      autoComplete="given-name"
                      className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      aria-invalid={!!formPaso1.formState.errors.nombre}
                      {...formPaso1.register('nombre')}
                    />
                    {formPaso1.formState.errors.nombre && (
                      <p role="alert" className="mt-1 text-xs text-red-500">
                        {formPaso1.formState.errors.nombre.message}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor="apellido"
                      className="block text-sm font-semibold text-slate-700 mb-1"
                    >
                      Apellido
                    </label>
                    <input
                      id="apellido"
                      type="text"
                      autoComplete="family-name"
                      className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      aria-invalid={!!formPaso1.formState.errors.apellido}
                      {...formPaso1.register('apellido')}
                    />
                    {formPaso1.formState.errors.apellido && (
                      <p role="alert" className="mt-1 text-xs text-red-500">
                        {formPaso1.formState.errors.apellido.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    Correo electrÃ³nico
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    aria-invalid={!!formPaso1.formState.errors.email}
                    {...formPaso1.register('email')}
                  />
                  {formPaso1.formState.errors.email && (
                    <p role="alert" className="mt-1 text-xs text-red-500">
                      {formPaso1.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="contrasena"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    ContraseÃ±a
                  </label>
                  <div className="relative">
                    <input
                      id="contrasena"
                      type={mostrarPass ? 'text' : 'password'}
                      className="w-full pr-11 px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      aria-invalid={!!formPaso1.formState.errors.contrasena}
                      {...formPaso1.register('contrasena')}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPass((valor) => !valor)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={mostrarPass ? 'Ocultar contraseÃ±a' : 'Mostrar contraseÃ±a'}
                    >
                      {mostrarPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {contrasena.length > 0 &&
                    (() => {
                      const req = calcularRequisitosContrasena(contrasena);
                      const requisitos = [
                        { cumple: req.longitudMinima, texto: 'MÃ­nimo 8 caracteres' },
                        { cumple: req.tieneMayuscula, texto: 'Una letra mayÃºscula' },
                        { cumple: req.tieneNumero, texto: 'Un nÃºmero' },
                        { cumple: req.tieneEspecial, texto: 'Un carÃ¡cter especial (!@#$...)' },
                      ];
                      return (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((nivel) => (
                              <div
                                key={nivel}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${nivel <= fortaleza.nivel ? fortaleza.color : 'bg-slate-200'}`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-slate-500">
                            Fortaleza: <span className="font-semibold">{fortaleza.etiqueta}</span>
                          </p>
                          <ul className="space-y-1">
                            {requisitos.map((r) => (
                              <li
                                key={r.texto}
                                className={`flex items-center gap-1.5 text-xs ${r.cumple ? 'text-green-600' : 'text-slate-400'}`}
                              >
                                <span>{r.cumple ? 'âœ“' : 'â—‹'}</span>
                                <span>{r.texto}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  {formPaso1.formState.errors.contrasena && (
                    <p role="alert" className="mt-1 text-xs text-red-500">
                      {formPaso1.formState.errors.contrasena.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirmarContrasena"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    Confirmar contraseÃ±a
                  </label>
                  <div className="relative">
                    <input
                      id="confirmarContrasena"
                      type={mostrarConfirm ? 'text' : 'password'}
                      className="w-full pr-11 px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      aria-invalid={!!formPaso1.formState.errors.confirmarContrasena}
                      {...formPaso1.register('confirmarContrasena')}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirm((valor) => !valor)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={mostrarConfirm ? 'Ocultar contraseÃ±a' : 'Mostrar contraseÃ±a'}
                    >
                      {mostrarConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {formPaso1.formState.errors.confirmarContrasena && (
                    <p role="alert" className="mt-1 text-xs text-red-500">
                      {formPaso1.formState.errors.confirmarContrasena.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={verificandoDisponibilidad}
                  className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-[#C6968C] to-[#78736E] text-white font-bold py-3.5 rounded-2xl hover:shadow-lg hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 transition-all"
                >
                  {verificandoDisponibilidad ? (
                    <>
                      <Spinner tamaño="sm" /> Verificando correo...
                    </>
                  ) : (
                    <>
                      Siguiente <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {paso === 2 && (
            <>
              <div className="mb-7 rounded-4xl border border-pink-100 bg-white px-6 py-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 mb-1">
                      CuÃ©ntanos sobre tu negocio
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-slate-500">
                      Esta informaciÃ³n es la que verÃ¡n tus clientes al reservar. Entre mÃ¡s
                      completa sea, mÃ¡s confianza genera.
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={formPaso2.handleSubmit(alEnviarPaso2)}
                noValidate
                className="space-y-6"
              >
                <div className="overflow-hidden rounded-full bg-slate-200 h-1.5">
                  <div
                    className="h-full rounded-full bg-pink-500 transition-all duration-500"
                    style={{ width: `${porcentajeProgreso}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center">
                  {porcentajeProgreso}% completado
                </p>

                <div className="space-y-5">
                  <TarjetaEtapaOperacion
                    activa={etapaOperacionActiva === 'basico'}
                    completada={informacionBaseLista}
                    descripcion="Nombre, ubicación, contacto, país, sucursales y tamaño del equipo."
                    detalle={
                      informacionBaseLista
                        ? `${nombreSalon || 'SalÃ³n sin nombre'} â€¢ ${sucursales.map((item) => item.trim()).filter(Boolean).length} sucursal(es)`
                        : 'Completa lo esencial para desbloquear el resto del flujo.'
                    }
                    onActivar={() => setEtapaOperacionActiva('basico')}
                    titulo="1. Base del negocio"
                  >
                    <div className="mb-5 flex items-center gap-2 text-pink-600">
                      <Store className="w-5 h-5" aria-hidden="true" />
                      <h3 className="text-lg font-black text-slate-900">InformaciÃ³n del salÃ³n</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="nombreSalon"
                          className="block text-sm font-semibold text-slate-700 mb-1"
                        >
                          Nombre del salÃ³n
                        </label>
                        <input
                          id="nombreSalon"
                          type="text"
                          className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                          aria-invalid={!!formPaso2.formState.errors.nombreSalon}
                          {...formPaso2.register('nombreSalon')}
                        />
                        {formPaso2.formState.errors.nombreSalon && (
                          <p role="alert" className="mt-1 text-xs text-red-500">
                            {formPaso2.formState.errors.nombreSalon.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="pais"
                          className="block text-sm font-semibold text-slate-700 mb-1"
                        >
                          PaÃ­s
                        </label>
                        <select
                          id="pais"
                          className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                          {...formPaso2.register('pais')}
                        >
                          <option value="Mexico">MÃ©xico</option>
                          <option value="Colombia">Colombia</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor="direccion"
                          className="block text-sm font-semibold text-slate-700 mb-1"
                        >
                          DirecciÃ³n principal
                        </label>
                        <input
                          id="direccion"
                          type="text"
                          className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                          aria-invalid={!!formPaso2.formState.errors.direccion}
                          {...formPaso2.register('direccion')}
                        />
                        {formPaso2.formState.errors.direccion && (
                          <p role="alert" className="mt-1 text-xs text-red-500">
                            {formPaso2.formState.errors.direccion.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="telefono"
                          className="block text-sm font-semibold text-slate-700 mb-1"
                        >
                          TelÃ©fono de contacto
                        </label>
                        <input
                          id="telefono"
                          type="tel"
                          className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                          aria-invalid={!!formPaso2.formState.errors.telefono}
                          {...formPaso2.register('telefono')}
                        />
                        {formPaso2.formState.errors.telefono && (
                          <p role="alert" className="mt-1 text-xs text-red-500">
                            {formPaso2.formState.errors.telefono.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 space-y-3 rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Sucursales</p>
                        <button
                          type="button"
                          onClick={agregarSucursal}
                          className="inline-flex items-center gap-2 rounded-xl bg-pink-50 px-3 py-2 text-xs font-black text-pink-700 hover:bg-pink-100"
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" /> AÃ±adir sucursal
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">
                        Escribe el nombre de cada sucursal. Si solo tienes una ubicaciÃ³n, deja solo
                        este campo.
                      </p>
                      <div className="space-y-2">
                        {sucursales.map((sucursal, indice) => (
                          <div key={`sucursal-${indice}`} className="flex gap-2">
                            <label htmlFor={`sucursal-${indice}`} className="sr-only">
                              Sucursal {indice + 1}
                            </label>
                            <input
                              id={`sucursal-${indice}`}
                              type="text"
                              value={sucursal}
                              onChange={(evento) => actualizarSucursal(indice, evento.target.value)}
                              placeholder={
                                indice === 0
                                  ? 'Nombre de la sucursal principal'
                                  : `Sucursal ${indice + 1}`
                              }
                              className="flex-1 px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => eliminarSucursal(indice)}
                              className="rounded-xl border border-slate-200 px-3 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                              aria-label={`Eliminar sucursal ${indice + 1}`}
                              disabled={sucursales.length === 1}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void continuarEtapaOperacion()}
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-black"
                      >
                        Continuar con horario{' '}
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </TarjetaEtapaOperacion>

                  {etapasVisibles.includes('horario') && (
                    <TarjetaEtapaOperacion
                      activa={etapaOperacionActiva === 'horario'}
                      bloqueada={!informacionBaseLista}
                      completada={horarioListo}
                      descripcion="Define los dÃ­as abiertos y el rango real de atenciÃ³n por jornada."
                      detalle={
                        horarioListo
                          ? `${resumenHorario.horarioApertura} a ${resumenHorario.horarioCierre} â€¢ ${Object.values(horarioLocal).filter((dia) => dia.isOpen).length} dÃ­a(s) abiertos`
                          : 'Se habilita cuando la base del negocio estÃ¡ completa.'
                      }
                      onActivar={
                        informacionBaseLista ? () => setEtapaOperacionActiva('horario') : undefined
                      }
                      titulo="2. Horario del local"
                    >
                      <div className="mb-5 flex items-center gap-2 text-pink-600">
                        <Clock3 className="w-5 h-5" aria-hidden="true" />
                        <h3 className="text-lg font-black text-slate-900">Horario del local</h3>
                      </div>
                      <div className="space-y-2">
                        {DIAS_SEMANA.map((dia) => (
                          <div
                            key={dia}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={horarioLocal[dia]?.isOpen ?? false}
                                onChange={(evento) =>
                                  actualizarHorarioDia(dia, { isOpen: evento.target.checked })
                                }
                                className="h-4 w-4 accent-pink-600"
                                aria-label={`Abrir ${dia}`}
                              />
                              <span className="text-sm font-black text-slate-700">{dia}</span>
                            </div>
                            {horarioLocal[dia]?.isOpen ? (
                              <div className="flex items-center gap-2">
                                <SelectorHora
                                  etiqueta={`Apertura ${dia}`}
                                  valor={horarioLocal[dia]?.openTime ?? '09:00'}
                                  alCambiar={(valor) =>
                                    actualizarHorarioDia(dia, { openTime: valor })
                                  }
                                  ocultarEtiqueta
                                  claseContenedor="w-[112px]"
                                  claseSelect="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                                />
                                <span className="text-xs font-black text-slate-400">a</span>
                                <SelectorHora
                                  etiqueta={`Cierre ${dia}`}
                                  valor={horarioLocal[dia]?.closeTime ?? '19:00'}
                                  alCambiar={(valor) =>
                                    actualizarHorarioDia(dia, { closeTime: valor })
                                  }
                                  ocultarEtiqueta
                                  claseContenedor="w-[112px]"
                                  claseSelect="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                                />
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-400">Cerrado</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setEtapaOperacionActiva('basico')}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Volver
                        </button>
                        <button
                          type="button"
                          onClick={() => void continuarEtapaOperacion()}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-black"
                        >
                          Continuar con servicios{' '}
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </TarjetaEtapaOperacion>
                  )}

                  {etapasVisibles.includes('servicios') && (
                    <TarjetaEtapaOperacion
                      activa={etapaOperacionActiva === 'servicios'}
                      bloqueada={!informacionBaseLista || !horarioListo}
                      completada={serviciosListos}
                      descripcion="Selecciona lo que ofreces y ajusta duraciÃ³n y precio. Los filtros pÃºblicos se derivan automÃ¡ticamente."
                      detalle={
                        serviciosListos
                          ? `${serviciosSeleccionados.length} servicio(s) configurado(s)`
                          : 'Primero define la base y el horario del salÃ³n.'
                      }
                      onActivar={
                        informacionBaseLista && horarioListo
                          ? () => setEtapaOperacionActiva('servicios')
                          : undefined
                      }
                      titulo="3. Servicios"
                    >
                      <div className="mb-5 flex items-center gap-2 text-pink-600">
                        <ListChecks className="w-5 h-5" aria-hidden="true" />
                        <h3 className="text-lg font-black text-slate-900">Servicios del salÃ³n</h3>
                      </div>

                      <div className="space-y-5">
                        {Object.entries(CATALOGO_SERVICIOS).map(([categoria, servicios]) => {
                          const personalizados = serviciosPersonalizados
                            .filter((servicio) => servicio.category === categoria)
                            .map((servicio) => servicio.name);
                          const todos = Array.from(new Set([...servicios, ...personalizados]));
                          return (
                            <div
                              key={categoria}
                              className="rounded-3xl border border-slate-100 bg-slate-50 p-5"
                            >
                              <h3 className="mb-3 inline-flex rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                                {categoria}
                              </h3>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {todos.map((nombreServicio) => {
                                  const servicio = serviciosSeleccionados.find(
                                    (item) => item.name === nombreServicio,
                                  );
                                  return (
                                    <div
                                      key={nombreServicio}
                                      className={`rounded-2xl border p-4 transition-colors ${servicio ? 'border-pink-300 bg-pink-50' : 'border-slate-200 bg-white'}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => alternarServicio(categoria, nombreServicio)}
                                        className={`w-full text-left text-sm font-bold ${servicio ? 'text-pink-700' : 'text-slate-700'}`}
                                      >
                                        {servicio ? 'âœ“ ' : ''}
                                        {obtenerEtiquetaServicioCatalogo(nombreServicio)}
                                      </button>
                                      {servicio && (
                                        <div className="mt-3 grid grid-cols-2 items-end gap-2">
                                          <div>
                                            <label
                                              htmlFor={`dur-${nombreServicio}`}
                                              className="mb-1 block text-[10px] font-black uppercase text-slate-400"
                                            >
                                              DuraciÃ³n (minutos)
                                            </label>
                                            <input
                                              id={`dur-${nombreServicio}`}
                                              type="number"
                                              min={5}
                                              max={480}
                                              step={5}
                                              placeholder="Ej: 60"
                                              value={servicio.duration}
                                              onChange={(evento) => {
                                                const val = Math.min(
                                                  480,
                                                  Math.max(0, Number(evento.target.value) || 0),
                                                );
                                                actualizarCampoServicio(
                                                  nombreServicio,
                                                  'duration',
                                                  String(val),
                                                );
                                              }}
                                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                                            />
                                          </div>
                                          <div>
                                            <label
                                              htmlFor={`precio-${nombreServicio}`}
                                              className="mb-1 block text-[10px] font-black uppercase text-slate-400"
                                            >
                                              Precio ({pais === 'Colombia' ? 'COP' : 'MXN'})
                                            </label>
                                            <input
                                              id={`precio-${nombreServicio}`}
                                              type="text"
                                              inputMode="numeric"
                                              placeholder="Ej: 55,000"
                                              value={
                                                preciosFormateados[nombreServicio] ??
                                                (servicio.price > 0
                                                  ? formatearPrecioCentavosInput(
                                                      servicio.price,
                                                      pais,
                                                    )
                                                  : '')
                                              }
                                              onChange={(evento) => {
                                                const valorFormateado = formatearPrecioInput(
                                                  evento.target.value,
                                                  pais,
                                                );
                                                setPreciosFormateados((act) => ({
                                                  ...act,
                                                  [nombreServicio]: valorFormateado,
                                                }));
                                                actualizarCampoServicio(
                                                  nombreServicio,
                                                  'price',
                                                  String(limpiarPrecio(evento.target.value)),
                                                );
                                              }}
                                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-4 flex flex-col gap-2 md:flex-row">
                                <label
                                  htmlFor={`servicio-personalizado-${categoria}`}
                                  className="sr-only"
                                >
                                  AÃ±adir servicio personalizado en {categoria}
                                </label>
                                <input
                                  id={`servicio-personalizado-${categoria}`}
                                  value={entradaServicioPersonalizado[categoria] ?? ''}
                                  onChange={(evento) =>
                                    setEntradaServicioPersonalizado((actual) => ({
                                      ...actual,
                                      [categoria]: evento.target.value,
                                    }))
                                  }
                                  placeholder={`AÃ±adir servicio personalizado en ${categoria}`}
                                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => agregarServicioPersonalizado(categoria)}
                                  className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white hover:bg-black"
                                >
                                  AÃ±adir servicio
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setEtapaOperacionActiva('horario')}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Volver
                        </button>
                        <button
                          type="button"
                          onClick={() => void continuarEtapaOperacion()}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-black"
                        >
                          Continuar con personal{' '}
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </TarjetaEtapaOperacion>
                  )}

                  {etapasVisibles.includes('personal') && (
                    <TarjetaEtapaOperacion
                      activa={etapaOperacionActiva === 'personal'}
                      bloqueada={!informacionBaseLista || !horarioListo || !serviciosListos}
                      completada={personalListo}
                      descripcion="Carga a cada especialista con sus servicios, turno y horario de almuerzo."
                      detalle={
                        personalListo
                          ? `${personal.length} especialista(s) listo(s) para operar`
                          : 'Primero define los servicios del salÃ³n.'
                      }
                      onActivar={
                        informacionBaseLista && horarioListo && serviciosListos
                          ? () => setEtapaOperacionActiva('personal')
                          : undefined
                      }
                      titulo="4. Equipo de especialistas"
                    >
                      <div className="mb-5 flex items-center gap-2 text-pink-600">
                        <Users className="w-5 h-5" aria-hidden="true" />
                        <h3 className="text-lg font-black text-slate-900">
                          Equipo de especialistas
                        </h3>
                      </div>

                      <div className="mb-5">
                        <div>
                          <label
                            htmlFor="numeroEspecialistas"
                            className="block text-sm font-semibold text-slate-700 mb-1"
                          >
                            NÃºmero de especialistas
                          </label>
                          <input
                            id="numeroEspecialistas"
                            type="number"
                            min="1"
                            max="100"
                            className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            {...formPaso2.register('numeroEspecialistas')}
                          />
                          <p className="mt-1 text-xs text-slate-400">
                            Si tu equipo supera 20 personas, escribe el nÃºmero exacto manualmente.
                          </p>
                          {formPaso2.formState.errors.numeroEspecialistas && (
                            <p role="alert" className="mt-1 text-xs text-red-500">
                              {formPaso2.formState.errors.numeroEspecialistas.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {personal.map((persona, indice) => (
                          <div
                            key={`personal-${indice}`}
                            className="rounded-3xl border border-slate-100 bg-slate-50 p-5"
                          >
                            <div className="mb-4 flex items-center justify-between">
                              <h3 className="text-sm font-black text-slate-900">
                                Especialista {indice + 1}
                              </h3>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Configura nombre, turno y servicios
                              </span>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label
                                  htmlFor={`nombre-especialista-${indice}`}
                                  className="block text-sm font-semibold text-slate-700 mb-1"
                                >
                                  Nombre completo
                                </label>
                                <input
                                  id={`nombre-especialista-${indice}`}
                                  type="text"
                                  value={persona.name}
                                  onChange={(evento) =>
                                    actualizarPersonal(indice, { name: evento.target.value })
                                  }
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                />
                              </div>

                              <SelectorHora
                                etiqueta="Entrada"
                                valor={persona.shiftStart ?? '09:00'}
                                alCambiar={(valor) =>
                                  actualizarPersonal(indice, { shiftStart: valor })
                                }
                              />
                              <SelectorHora
                                etiqueta="Salida"
                                valor={persona.shiftEnd ?? '19:00'}
                                alCambiar={(valor) =>
                                  actualizarPersonal(indice, { shiftEnd: valor })
                                }
                              />
                              <SelectorHora
                                etiqueta="Inicio de almuerzo"
                                valor={persona.breakStart ?? '14:00'}
                                alCambiar={(valor) =>
                                  actualizarPersonal(indice, { breakStart: valor })
                                }
                              />
                              <SelectorHora
                                etiqueta="Fin de almuerzo"
                                valor={persona.breakEnd ?? '15:00'}
                                alCambiar={(valor) =>
                                  actualizarPersonal(indice, { breakEnd: valor })
                                }
                              />
                            </div>

                            <div className="mt-4">
                              <p className="mb-2 text-sm font-semibold text-slate-700">
                                Servicios que realiza
                              </p>
                              {serviciosDisponibles.length === 0 ? (
                                <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400">
                                  Primero selecciona servicios en el catÃ¡logo del salÃ³n.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {serviciosDisponibles.map((servicio) => (
                                    <button
                                      key={`${indice}-${servicio}`}
                                      type="button"
                                      onClick={() => alternarEspecialidadPersonal(indice, servicio)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${persona.specialties.includes(servicio) ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-300 hover:text-pink-600'}`}
                                    >
                                      {persona.specialties.includes(servicio) ? 'âœ“ ' : ''}
                                      {servicio}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {errorServidor && (
                        <div
                          role="alert"
                          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
                          {errorServidor}
                        </div>
                      )}
                      <div className="mt-6 flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setEtapaOperacionActiva('servicios')}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3.5 font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                        >
                          <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Volver
                        </button>
                        <button
                          type="submit"
                          disabled={formPaso2.formState.isSubmitting}
                          className="flex-1 rounded-2xl bg-linear-to-r from-[#C6968C] to-[#78736E] py-3.5 font-bold text-white transition-all hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {formPaso2.formState.isSubmitting ? 'Enviando...' : 'Enviar'}
                        </button>
                      </div>
                    </TarjetaEtapaOperacion>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaso(1)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Volver al paso anterior
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            Â¿Ya tienes cuenta?{' '}
            <Link to="/iniciar-sesion" className="text-pink-700 font-semibold hover:underline">
              Inicia sesiÃ³n
            </Link>
          </p>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={limpiarFormulario}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Limpiar formulario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
