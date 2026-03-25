import { useState } from 'react';
import { actualizarEstudio, crearSalonAdmin } from '../../../servicios/servicioEstudios';
import { sincronizarPersonalEstudio } from '../../../servicios/servicioPersonal';
import { confirmarPago as _confirmarPago } from '../../../servicios/servicioPagos';
import { ErrorAPI } from '../../../lib/clienteHTTP';
import { obtenerFechaLocalISO, formatearFechaHumana } from '../../../utils/formato';
import { DIAS_SEMANA, CATALOGO_SERVICIOS } from '../../../lib/constantes';
import type { Estudio, Servicio, Personal, TurnoTrabajo } from '../../../tipos';

export interface FormularioEstudio extends Omit<Estudio, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
  emailDueno: string;
  contrasenaDueno: string;
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

function generarContrasenaTemporal() {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiales = '!@#$%&*';
  const mezcla = `${mayusculas}${minusculas}${numeros}${especiales}`;

  // Garantizar al menos un carácter de cada categoría requerida
  const chars = [
    mayusculas[Math.floor(Math.random() * mayusculas.length)],
    minusculas[Math.floor(Math.random() * minusculas.length)],
    numeros[Math.floor(Math.random() * numeros.length)],
    especiales[Math.floor(Math.random() * especiales.length)],
  ];

  for (let indice = 0; indice < 8; indice += 1) {
    chars.push(mezcla[Math.floor(Math.random() * mezcla.length)]);
  }

  // Mezclar para que el orden no sea predecible
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

const crearEstadoInicial = (): FormularioEstudio => ({
  name: '',
  owner: '',
  emailDueno: '',
  contrasenaDueno: generarContrasenaTemporal(),
  phone: '',
  website: '',
  country: 'Mexico',
  plan: 'STANDARD',
  selectedServices: [],
  customServices: [],
  branches: [''],
  staff: [],
  holidays: [],
  schedule: DIAS_SEMANA.reduce<Record<string, TurnoTrabajo>>(
    (acc, dia) => ({ ...acc, [dia]: { isOpen: true, openTime: '09:00', closeTime: '19:00' } }),
    {},
  ),
  assignedKey: '',
  clientKey: '',
  subscriptionStart: obtenerFechaLocalISO(new Date()),
  paidUntil: '',
});

function normalizarTextoOpcional(valor?: string | null) {
  if (valor == null) return '';
  const limpio = valor.trim();
  return limpio === '' ? '' : limpio;
}

export function usarFormularioEstudio() {
  const [modoModal, setModoModal] = useState<'ADD' | 'EDIT' | 'CONFIRMACION' | null>(null);
  const [formulario, setFormulario] = useState<FormularioEstudio>(crearEstadoInicial());
  const [confirmacionAlta, setConfirmacionAlta] = useState<ConfirmacionAltaSalon | null>(null);
  const [entradaServicioPersonalizado, setEntradaServicioPersonalizado] = useState<
    Record<string, string>
  >({});

  const abrirModalAlta = () => {
    setFormulario(crearEstadoInicial());
    setConfirmacionAlta(null);
    setModoModal('ADD');
  };

  const abrirModalEdicion = (estudio: Estudio) => {
    setConfirmacionAlta(null);
    setFormulario({ ...estudio, emailDueno: estudio.emailContacto ?? '', contrasenaDueno: '' });
    setModoModal('EDIT');
  };

  const cerrarModal = () => {
    setModoModal(null);
    setConfirmacionAlta(null);
  };

  const regenerarContrasenaDueno = () => {
    setFormulario((prev) => ({ ...prev, contrasenaDueno: generarContrasenaTemporal() }));
  };

  const alternarServicio = (nombre: string) => {
    setFormulario((prev) => {
      const existe = prev.selectedServices.some((servicio) => servicio.name === nombre);

      return {
        ...prev,
        selectedServices: existe
          ? prev.selectedServices.filter((servicio) => servicio.name !== nombre)
          : [...prev.selectedServices, { name: nombre, duration: 30, price: 1 }],
      };
    });
  };

  const actualizarCampoServicio = (nombre: string, campo: 'duration' | 'price', valor: string) => {
    const valorSinCeros = valor.replace(/^0+/, '') || '';
    const numero = Number.parseInt(valorSinCeros, 10);
    const valorNormalizado = Number.isNaN(numero)
      ? 1
      : campo === 'price'
        ? Math.min(9_999_999, Math.max(1, numero))
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
        : [...prev.selectedServices, { name: nombre, duration: 30, price: 1 }],
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
      const datosGuardar: FormularioEstudio & { updatedAt: string } = {
        ...formulario,
        name: formulario.name.trim(),
        owner: formulario.owner.trim(),
        emailDueno: formulario.emailDueno.trim().toLowerCase(),
        contrasenaDueno: formulario.contrasenaDueno,
        phone: formulario.phone.trim(),
        website: normalizarTextoOpcional(formulario.website),
        branches: sucursales,
        assignedKey: formulario.assignedKey.trim().toUpperCase(),
        clientKey: formulario.clientKey.trim().toUpperCase(),
        updatedAt: new Date().toISOString(),
      };

      if (modoModal === 'ADD') {
        if (!datosGuardar.emailDueno) {
          mostrarError('Captura el email del dueño antes de registrar el salón.');
          return;
        }

        if (datosGuardar.contrasenaDueno.trim().length < 8) {
          mostrarError('La contraseña inicial del dueño debe tener al menos 8 caracteres.');
          return;
        }

        const resultado = await crearSalonAdmin({
          nombreSalon: datosGuardar.name,
          nombreAdmin: datosGuardar.owner,
          emailDueno: datosGuardar.emailDueno,
          contrasenaDueno: datosGuardar.contrasenaDueno,
          telefono: datosGuardar.phone,
          pais: datosGuardar.country,
          plan: datosGuardar.plan,
          inicioSuscripcion: datosGuardar.subscriptionStart,
          servicios: datosGuardar.selectedServices,
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
        setConfirmacionAlta({
          nombreSalon: resultado.estudio.name,
          nombreDueno: resultado.estudio.owner,
          emailDueno: resultado.acceso.emailDueno,
          contrasenaDueno: datosGuardar.contrasenaDueno,
          claveDueno: resultado.acceso.claveDueno,
          claveClientes: resultado.acceso.claveClientes,
          urlReserva: `${window.location.origin}/reservar/${resultado.acceso.claveClientes}`,
        });
        setModoModal('CONFIRMACION');
        await alRefrescar();
        mostrarExito(`Salón "${resultado.estudio.name}" creado correctamente.`);
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
    confirmacionAlta,
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
