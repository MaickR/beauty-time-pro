import { useState } from 'react';
import { guardarEstudio, actualizarEstudio } from '../../../servicios/servicioEstudios';
import { confirmarPago as _confirmarPago } from '../../../servicios/servicioPagos';
import { obtenerFechaLocalISO } from '../../../utils/formato';
import { DIAS_SEMANA, CATALOGO_SERVICIOS } from '../../../lib/constantes';
import type { Estudio, Servicio, Personal, TurnoTrabajo } from '../../../tipos';

export interface FormularioEstudio extends Omit<Estudio, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

const crearEstadoInicial = (): FormularioEstudio => ({
  name: '',
  owner: '',
  phone: '',
  website: '',
  country: 'Mexico',
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

export function usarFormularioEstudio() {
  const [modoModal, setModoModal] = useState<'ADD' | 'EDIT' | null>(null);
  const [formulario, setFormulario] = useState<FormularioEstudio>(crearEstadoInicial());
  const [entradaServicioPersonalizado, setEntradaServicioPersonalizado] = useState<Record<string, string>>({});

  const abrirModalAlta = () => {
    setFormulario(crearEstadoInicial());
    setModoModal('ADD');
  };

  const abrirModalEdicion = (estudio: Estudio) => {
    setFormulario({ ...estudio });
    setModoModal('EDIT');
  };

  const cerrarModal = () => setModoModal(null);

  const alternarServicio = (nombre: string) => {
    const existe = formulario.selectedServices.find((s) => s.name === nombre);
    if (existe) {
      setFormulario((prev) => ({
        ...prev,
        selectedServices: prev.selectedServices.filter((s) => s.name !== nombre),
      }));
    } else {
      setFormulario((prev) => ({
        ...prev,
        selectedServices: [...prev.selectedServices, { name: nombre, duration: 30, price: 0 }],
      }));
    }
  };

  const actualizarCampoServicio = (nombre: string, campo: 'duration' | 'price', valor: string) => {
    setFormulario((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.map((s) =>
        s.name === nombre ? { ...s, [campo]: parseInt(valor) || 0 } : s,
      ),
    }));
  };

  const agregarServicioPersonalizado = (categoria: string) => {
    const nombre = entradaServicioPersonalizado[categoria]?.trim();
    if (!nombre) return;
    if (formulario.selectedServices.find((s) => s.name === nombre)) return;
    const esCatalogoConocido = Object.keys(CATALOGO_SERVICIOS).includes(categoria);
    setFormulario((prev) => ({
      ...prev,
      selectedServices: [...prev.selectedServices, { name: nombre, duration: 30, price: 0 }],
      customServices: esCatalogoConocido
        ? [...(prev.customServices ?? []), { name: nombre, category: categoria }]
        : prev.customServices ?? [],
    }));
    setEntradaServicioPersonalizado((prev) => ({ ...prev, [categoria]: '' }));
  };

  const agregarPersonal = (nuevoPersonal: Personal) => {
    setFormulario((prev) => ({ ...prev, staff: [...prev.staff, nuevoPersonal] }));
  };

  const enviarFormulario = async (
    e: React.FormEvent,
    onExito: () => void,
    mostrarError: (msg: string) => void,
  ) => {
    e.preventDefault();
    if (!formulario.assignedKey || !formulario.clientKey) {
      mostrarError('Faltan claves de acceso. Asigna Clave Dueño y Clave Clientes.');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datosGuardar: any = { ...formulario, updatedAt: new Date().toISOString() };
      if (modoModal === 'ADD') {
        const fechaInicio = new Date(formulario.subscriptionStart);
        fechaInicio.setMonth(fechaInicio.getMonth() + 1);
        datosGuardar.paidUntil = obtenerFechaLocalISO(fechaInicio);
        const estudioId = `studio_${Date.now()}`;
        await guardarEstudio(estudioId, {
          ...datosGuardar,
          createdAt: new Date().toISOString(),
        });
      } else if (formulario.id) {
        await actualizarEstudio(formulario.id, datosGuardar);
      }
      onExito();
    } catch (err) {
      console.error(err);
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
    await _confirmarPago(estudio, monto, moneda);
    onExito(`Pago de $${monto.toLocaleString()} ${moneda} abonado exitosamente.`);
  } catch (err) {
    console.error(err);
    onError('Error al registrar pago. Inténtalo de nuevo.');
  }
}

export type { Servicio };
