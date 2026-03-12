import { useState } from 'react';
import { guardarEstudio, actualizarEstudio } from '../../../servicios/servicioEstudios';
import { sincronizarPersonalEstudio } from '../../../servicios/servicioPersonal';
import { confirmarPago as _confirmarPago } from '../../../servicios/servicioPagos';
import { ErrorAPI } from '../../../lib/clienteHTTP';
import { obtenerFechaLocalISO, formatearFechaHumana } from '../../../utils/formato';
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

function normalizarTextoOpcional(valor?: string | null) {
  if (valor == null) return '';
  const limpio = valor.trim();
  return limpio === '' ? '' : limpio;
}

export function usarFormularioEstudio() {
  const [modoModal, setModoModal] = useState<'ADD' | 'EDIT' | null>(null);
  const [formulario, setFormulario] = useState<FormularioEstudio>(crearEstadoInicial());
  const [entradaServicioPersonalizado, setEntradaServicioPersonalizado] = useState<
    Record<string, string>
  >({});

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
    setFormulario((prev) => {
      const existe = prev.selectedServices.some((servicio) => servicio.name === nombre);

      return {
        ...prev,
        selectedServices: existe
          ? prev.selectedServices.filter((servicio) => servicio.name !== nombre)
          : [...prev.selectedServices, { name: nombre, duration: 30, price: 0 }],
      };
    });
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
    const esCatalogoConocido = Object.keys(CATALOGO_SERVICIOS).includes(categoria);
    setFormulario((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.some((servicio) => servicio.name === nombre)
        ? prev.selectedServices
        : [...prev.selectedServices, { name: nombre, duration: 30, price: 0 }],
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
    onExito: () => void,
    mostrarError: (msg: string) => void,
  ) => {
    e.preventDefault();
    if (modoModal === 'ADD' && (!formulario.assignedKey || !formulario.clientKey)) {
      mostrarError('Faltan claves de acceso. Asigna Clave Dueño y Clave Clientes.');
      return;
    }
    try {
      const sucursales = formulario.branches.map((sucursal) => sucursal.trim()).filter(Boolean);
      const datosGuardar: FormularioEstudio & { updatedAt: string } = {
        ...formulario,
        name: formulario.name.trim(),
        owner: formulario.owner.trim(),
        phone: formulario.phone.trim(),
        website: normalizarTextoOpcional(formulario.website),
        branches: sucursales,
        assignedKey: formulario.assignedKey.trim().toUpperCase(),
        clientKey: formulario.clientKey.trim().toUpperCase(),
        updatedAt: new Date().toISOString(),
      };

      if (modoModal === 'ADD') {
        const fechaInicio = new Date(formulario.subscriptionStart);
        fechaInicio.setMonth(fechaInicio.getMonth() + 1);
        datosGuardar.paidUntil = obtenerFechaLocalISO(fechaInicio);
        const estudioId = `studio_${Date.now()}`;
        const { id: _idOmitido, ...datosCrear } = datosGuardar;
        const estudioCreado = await guardarEstudio(estudioId, {
          ...datosCrear,
          createdAt: new Date().toISOString(),
        });
        if (formulario.staff.length > 0) {
          await sincronizarPersonalEstudio(estudioCreado.id, formulario.staff);
        }
      } else if (formulario.id) {
        await actualizarEstudio(formulario.id, datosGuardar);
        await sincronizarPersonalEstudio(formulario.id, formulario.staff);
      }
      onExito();
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
