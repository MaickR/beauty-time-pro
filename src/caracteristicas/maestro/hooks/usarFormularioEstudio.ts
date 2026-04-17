import { useEffect, useState } from 'react';
import { actualizarEstudio, crearSalonAdmin } from '../../../servicios/servicioEstudios';
import { sincronizarPersonalEstudio } from '../../../servicios/servicioPersonal';
import { confirmarPago as _confirmarPago } from '../../../servicios/servicioPagos';
import { ErrorAPI } from '../../../lib/clienteHTTP';
import {
  convertirMonedaACentavos,
  obtenerFechaLocalISO,
  formatearFechaHumana,
} from '../../../utils/formato';
import { DIAS_SEMANA, CATALOGO_SERVICIOS } from '../../../lib/constantes';
import {
  esEmailSalonValido,
  generarContrasenaSalon,
  limpiarTelefonoEntrada,
} from '../../../utils/formularioSalon';
import type { Estudio, Servicio, Personal, TurnoTrabajo } from '../../../tipos';
import { subirLogo } from '../../../servicios/servicioPerfil';

const CLAVE_BORRADOR_ALTA_SALON = 'maestro_alta_salon_borrador_v1';

export interface ProductoFormularioSalon {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
}

export interface FormularioEstudio extends Omit<Estudio, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
  emailDueno: string;
  contrasenaDueno: string;
  direccion: string;
  productos: ProductoFormularioSalon[];
  reintentosContrasenaDueno: number;
  tipoVinculacion: 'INDEPENDIENTE' | 'SEDE';
}

export interface ConfirmacionAltaSalon {
  nombreSalon: string;
  nombreDueno: string;
  emailDueno: string;
  contrasenaDueno: string;
  claveDueno: string;
  claveClientes: string;
  urlReserva: string;
}

const crearEstadoInicial = (): FormularioEstudio => ({
  slug: '',
  name: '',
  owner: '',
  emailDueno: '',
  contrasenaDueno: generarContrasenaSalon(''),
  phone: '',
  website: '',
  country: 'Mexico',
  plan: 'STANDARD',
  selectedServices: [],
  customServices: [],
  branches: [],
  staff: [],
  productos: [],
  holidays: [],
  schedule: DIAS_SEMANA.reduce<Record<string, TurnoTrabajo>>(
    (acc, dia) => ({ ...acc, [dia]: { isOpen: true, openTime: '09:00', closeTime: '19:00' } }),
    {},
  ),
  assignedKey: '',
  clientKey: '',
  subscriptionStart: obtenerFechaLocalISO(new Date()),
  paidUntil: '',
  direccion: '',
  estudioPrincipalId: null,
  estudioPrincipal: null,
  esSede: false,
  permiteReservasPublicas: true,
  sedes: [],
  reintentosContrasenaDueno: 1,
  tipoVinculacion: 'INDEPENDIENTE',
});

function normalizarTextoOpcional(valor?: string | null) {
  if (valor == null) return '';
  const limpio = valor.trim();
  return limpio === '' ? '' : limpio;
}

function restaurarBorradorAlta(claveBorrador: string): FormularioEstudio | null {
  if (typeof window === 'undefined') return null;

  try {
    const borrador = window.localStorage.getItem(claveBorrador);
    if (!borrador) return null;

    const datos = JSON.parse(borrador) as Partial<FormularioEstudio>;
    return {
      ...crearEstadoInicial(),
      ...datos,
      contrasenaDueno: datos.contrasenaDueno?.trim() || generarContrasenaSalon(datos.name ?? ''),
      phone: limpiarTelefonoEntrada(datos.phone ?? ''),
      reintentosContrasenaDueno: Math.min(5, Math.max(1, datos.reintentosContrasenaDueno ?? 1)),
    };
  } catch {
    return null;
  }
}

function guardarBorradorAlta(claveBorrador: string, formulario: FormularioEstudio) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(claveBorrador, JSON.stringify(formulario));
  } catch {
    // Ignorar almacenamiento no disponible.
  }
}

function limpiarBorradorAlta(claveBorrador: string) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(claveBorrador);
  } catch {
    // Ignorar almacenamiento no disponible.
  }
}

interface ResultadoAltaFormularioEstudio {
  mensajeExito: string;
  confirmacionAlta?: ConfirmacionAltaSalon | null;
  cerrarModal?: boolean;
}

interface OpcionesFormularioEstudio {
  claveBorrador?: string;
  procesarAlta?: (contexto: {
    formulario: FormularioEstudio;
    logoArchivo: File | null;
  }) => Promise<ResultadoAltaFormularioEstudio>;
}

export function usarFormularioEstudio(opciones?: OpcionesFormularioEstudio) {
  const claveBorrador = opciones?.claveBorrador ?? CLAVE_BORRADOR_ALTA_SALON;
  const [modoModal, setModoModal] = useState<'ADD' | 'EDIT' | 'CONFIRMACION' | null>(null);
  const [formulario, setFormulario] = useState<FormularioEstudio>(crearEstadoInicial());
  const [confirmacionAlta, setConfirmacionAlta] = useState<ConfirmacionAltaSalon | null>(null);
  const [logoArchivo, setLogoArchivo] = useState<File | null>(null);
  const [entradaServicioPersonalizado, setEntradaServicioPersonalizado] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (modoModal !== 'ADD') return;
    guardarBorradorAlta(claveBorrador, formulario);
  }, [claveBorrador, formulario, modoModal]);

  const abrirModalAlta = () => {
    setFormulario(restaurarBorradorAlta(claveBorrador) ?? crearEstadoInicial());
    setConfirmacionAlta(null);
    setModoModal('ADD');
  };

  const abrirModalEdicion = (estudio: Estudio) => {
    setConfirmacionAlta(null);
    setFormulario({
      ...crearEstadoInicial(),
      ...estudio,
      tipoVinculacion: estudio.estudioPrincipalId ? 'SEDE' : 'INDEPENDIENTE',
      emailDueno: estudio.emailContacto ?? '',
      contrasenaDueno: '',
      direccion: estudio.direccion ?? '',
      productos: [],
      reintentosContrasenaDueno: 1,
    });
    setModoModal('EDIT');
  };

  const cerrarModal = () => {
    setModoModal(null);
    setConfirmacionAlta(null);
  };

  const descartarBorrador = () => {
    limpiarBorradorAlta(claveBorrador);
    setFormulario(crearEstadoInicial());
    setLogoArchivo(null);
  };

  const regenerarContrasenaDueno = () => {
    setFormulario((prev) => {
      if (prev.reintentosContrasenaDueno >= 5) {
        return prev;
      }

      const reintentosContrasenaDueno = prev.reintentosContrasenaDueno + 1;
      return {
        ...prev,
        contrasenaDueno: generarContrasenaSalon(prev.name, reintentosContrasenaDueno - 1),
        reintentosContrasenaDueno,
      };
    });
  };

  const alternarServicio = (nombre: string) => {
    setFormulario((prev) => {
      const existe = prev.selectedServices.some((servicio) => servicio.name === nombre);

      return {
        ...prev,
        selectedServices: existe
          ? prev.selectedServices.filter((servicio) => servicio.name !== nombre)
          : [...prev.selectedServices, { name: nombre, duration: 30, price: 100 }],
      };
    });
  };

  const actualizarCampoServicio = (nombre: string, campo: 'duration' | 'price', valor: string) => {
    const valorSinCeros = valor.replace(/^0+/, '') || '';
    const numero = Number.parseInt(valorSinCeros, 10);
    const valorNormalizado = Number.isNaN(numero)
      ? campo === 'price'
        ? 100
        : 1
      : campo === 'price'
        ? Math.min(999_999_999, Math.max(100, convertirMonedaACentavos(numero)))
        : Math.min(480, Math.max(1, numero));

    setFormulario((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.map((s) =>
        s.name === nombre ? { ...s, [campo]: valorNormalizado } : s,
      ),
    }));
  };

  const agregarServicioPersonalizado = (categoria: string) => {
    const nombre = entradaServicioPersonalizado[categoria]?.trim();
    if (!nombre) return;
    const esCatalogoConocido = Object.keys(CATALOGO_SERVICIOS).includes(categoria);
    setFormulario((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.some((servicio) => servicio.name === nombre)
        ? prev.selectedServices
        : [...prev.selectedServices, { name: nombre, duration: 30, price: 100 }],
      customServices:
        esCatalogoConocido &&
        !(prev.customServices ?? []).some((servicio) => servicio.name === nombre)
          ? [...(prev.customServices ?? []), { name: nombre, category: categoria }]
          : (prev.customServices ?? []),
    }));
    setEntradaServicioPersonalizado((prev) => ({ ...prev, [categoria]: '' }));
  };

  const agregarPersonal = (nuevoPersonal: Personal) => {
    setFormulario((prev) => ({ ...prev, staff: [...prev.staff, nuevoPersonal] }));
  };

  const enviarFormulario = async (
    e: React.FormEvent,
    alRefrescar: () => Promise<void> | void,
    mostrarExito: (msg: string) => void,
    mostrarError: (msg: string) => void,
  ) => {
    e.preventDefault();
    try {
      const sucursales = formulario.branches.map((sucursal) => sucursal.trim()).filter(Boolean);
      const esSede = formulario.tipoVinculacion === 'SEDE';
      const datosGuardar: FormularioEstudio & { updatedAt: string } = {
        ...formulario,
        name: formulario.name.trim(),
        owner: formulario.owner.trim(),
        emailDueno: formulario.emailDueno.trim().toLowerCase(),
        contrasenaDueno: formulario.contrasenaDueno,
        phone: limpiarTelefonoEntrada(formulario.phone),
        website: normalizarTextoOpcional(formulario.website),
        branches: esSede ? [] : sucursales,
        estudioPrincipalId: esSede ? (formulario.estudioPrincipalId ?? null) : null,
        permiteReservasPublicas: formulario.permiteReservasPublicas ?? true,
        esSede,
        direccion: formulario.direccion.trim(),
        assignedKey: formulario.assignedKey.trim().toUpperCase(),
        clientKey: formulario.clientKey.trim().toUpperCase(),
        updatedAt: new Date().toISOString(),
      };

      if (esSede && !datosGuardar.estudioPrincipalId) {
        mostrarError('Selecciona el salón principal antes de guardar esta sede.');
        return;
      }

      if (modoModal === 'ADD') {
        if (!datosGuardar.emailDueno) {
          mostrarError('Captura el email del dueño antes de registrar el salón.');
          return;
        }

        if (!esEmailSalonValido(datosGuardar.emailDueno)) {
          mostrarError('Solo se aceptan correos personales @gmail, @hotmail, @outlook o @yahoo.');
          return;
        }

        if (datosGuardar.phone.length !== 10) {
          mostrarError('El teléfono del salón debe tener exactamente 10 dígitos.');
          return;
        }

        if (datosGuardar.subscriptionStart < obtenerFechaLocalISO(new Date())) {
          mostrarError('La fecha de inicio de operaciones no puede ser menor al día de hoy.');
          return;
        }

        if (datosGuardar.contrasenaDueno.trim().length < 8) {
          mostrarError('La contraseña automática del dueño debe tener 8 caracteres.');
          return;
        }

        const resultadoAlta = opciones?.procesarAlta
          ? await opciones.procesarAlta({ formulario: datosGuardar, logoArchivo })
          : await (async (): Promise<ResultadoAltaFormularioEstudio> => {
              const resultado = await crearSalonAdmin({
                nombreSalon: datosGuardar.name,
                nombreAdmin: datosGuardar.owner,
                emailDueno: datosGuardar.emailDueno,
                contrasenaDueno: datosGuardar.contrasenaDueno,
                telefono: datosGuardar.phone,
                pais: datosGuardar.country,
                plan: datosGuardar.plan,
                estudioPrincipalId: datosGuardar.estudioPrincipalId,
                permiteReservasPublicas: datosGuardar.permiteReservasPublicas,
                inicioSuscripcion: datosGuardar.subscriptionStart,
                direccion: datosGuardar.direccion,
                sucursales: datosGuardar.branches,
                servicios: datosGuardar.selectedServices,
                productos: datosGuardar.productos.map((producto) => ({
                  nombre: producto.nombre,
                  categoria: producto.categoria,
                  precio: producto.precio,
                })),
                serviciosCustom: datosGuardar.customServices,
                personal: formulario.staff.map((persona) => ({
                  nombre: persona.name,
                  especialidades: persona.specialties,
                  horaInicio: persona.shiftStart ?? undefined,
                  horaFin: persona.shiftEnd ?? undefined,
                  descansoInicio: persona.breakStart ?? undefined,
                  descansoFin: persona.breakEnd ?? undefined,
                })),
              });
              if (logoArchivo) {
                await subirLogo(resultado.estudio.id, logoArchivo);
              }
              return {
                mensajeExito: `Salón "${resultado.estudio.name}" creado correctamente.`,
                confirmacionAlta: {
                  nombreSalon: resultado.estudio.name,
                  nombreDueno: resultado.estudio.owner,
                  emailDueno: resultado.acceso.emailDueno,
                  contrasenaDueno: datosGuardar.contrasenaDueno,
                  claveDueno: resultado.acceso.claveDueno,
                  claveClientes: resultado.acceso.claveClientes,
                  urlReserva: `${window.location.origin}/reservar/${resultado.acceso.claveClientes}`,
                },
              };
            })();

        limpiarBorradorAlta(claveBorrador);
        setLogoArchivo(null);

        if (resultadoAlta.confirmacionAlta) {
          setConfirmacionAlta(resultadoAlta.confirmacionAlta);
          setModoModal('CONFIRMACION');
        } else if (resultadoAlta.cerrarModal ?? true) {
          cerrarModal();
        }

        await alRefrescar();
        mostrarExito(resultadoAlta.mensajeExito);
      } else if (formulario.id) {
        await actualizarEstudio(formulario.id, datosGuardar);
        await sincronizarPersonalEstudio(formulario.id, formulario.staff);
        await alRefrescar();
        mostrarExito(`Se actualizaron los datos de "${datosGuardar.name}".`);
        cerrarModal();
      }
    } catch (err) {
      console.error(err);
      mostrarError(
        err instanceof ErrorAPI
          ? err.message
          : 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
      );
    }
  };

  return {
    modoModal,
    formulario,
    setFormulario,
    entradaServicioPersonalizado,
    setEntradaServicioPersonalizado,
    abrirModalAlta,
    abrirModalEdicion,
    cerrarModal,
    descartarBorrador,
    confirmacionAlta,
    logoArchivo,
    setLogoArchivo,
    regenerarContrasenaDueno,
    alternarServicio,
    actualizarCampoServicio,
    agregarServicioPersonalizado,
    agregarPersonal,
    enviarFormulario,
  };
}

export type HookFormularioEstudio = ReturnType<typeof usarFormularioEstudio>;

export async function confirmarPago(
  estudio: Estudio,
  monto: number,
  moneda: 'MXN' | 'COP',
  onExito: (msg: string) => void,
  onError: (msg: string) => void,
) {
  try {
    const resultado = await _confirmarPago(estudio, monto, moneda);
    const fechaBase = formatearFechaHumana(resultado.fechaBaseRenovacion);
    const fechaNueva = formatearFechaHumana(resultado.nuevaFechaVencimiento);
    const regla =
      resultado.estrategiaRenovacion === 'desde_hoy'
        ? 'El salón estaba vencido, así que el mes nuevo contó desde hoy.'
        : 'El salón seguía activo, así que el mes nuevo se sumó sobre su fecha vigente.';

    onExito(
      `Pago registrado en ${resultado.moneda}. Nueva vigencia: ${fechaNueva}. Base usada: ${fechaBase}. ${regla}`,
    );
  } catch (err) {
    console.error(err);
    onError('Error al registrar pago. Inténtalo de nuevo.');
  }
}

export type { Servicio };
