import { describe, expect, it } from 'vitest';
import {
  normalizarServiciosEntrada,
  recalcularServiciosContraCatalogo,
  serializarReservaApi,
} from './serializacionReservas';

describe('serializacionReservas', () => {
  it('normaliza y conserva el motivo enviado en services[].motivo', () => {
    expect(
      normalizarServiciosEntrada([
        {
          id: 'svc-1',
          name: 'Balayage Premium',
          duration: 120,
          price: 350000,
          category: 'Color',
          motivo: 'Marca o línea preferida: Wella. Tono o referencia deseada: Beige cenizo 7.1',
        },
      ]),
    ).toEqual([
      {
        id: 'svc-1',
        name: 'Balayage Premium',
        duration: 120,
        price: 350000,
        category: 'Color',
        motivo: 'Marca o línea preferida: Wella. Tono o referencia deseada: Beige cenizo 7.1',
      },
    ]);
  });

  it('preserva el motivo del servicio al recalcular contra el catalogo del salon', () => {
    expect(
      recalcularServiciosContraCatalogo(
        [
          {
            id: 'svc-1',
            name: 'Balayage Premium',
            duration: 80,
            price: 1,
            category: 'Color',
            motivo: 'Marca o línea preferida: Wella',
          },
        ],
        [
          {
            id: 'svc-1',
            name: 'Balayage Premium',
            duration: 120,
            price: 350000,
            category: 'Color',
          },
        ],
      ),
    ).toEqual([
      {
        id: 'svc-1',
        name: 'Balayage Premium',
        duration: 120,
        price: 350000,
        category: 'Color',
        order: 0,
        motivo: 'Marca o línea preferida: Wella',
      },
    ]);
  });

  it('expone el motivo persistido dentro de serviciosDetalle al serializar la reserva', () => {
    const reserva = serializarReservaApi({
      id: 'res-1',
      estudioId: 'est-1',
      personalId: 'per-1',
      clienteId: 'cli-1',
      nombreCliente: 'María López',
      telefonoCliente: '5512345678',
      fecha: '2026-04-25',
      horaInicio: '10:39',
      duracion: 120,
      servicios: [],
      precioTotal: 350000,
      estado: 'confirmed',
      sucursal: 'MIKELOV STUDIO',
      marcaTinte: null,
      tonalidad: null,
      observaciones: 'Cliente prefiere contacto por WhatsApp',
      metodoPago: 'cash',
      motivoCancelacion: null,
      productosAdicionales: [],
      clienteAppId: null,
      tokenCancelacion: 'tok-1',
      creadoEn: new Date('2026-04-15T10:00:00.000Z'),
      serviciosDetalle: [
        {
          id: 'svc-1',
          nombre: 'Balayage Premium',
          duracion: 120,
          precio: 350000,
          categoria: 'Color',
          orden: 0,
          estado: 'confirmed',
          motivo: 'Marca o línea preferida: Wella. Tono o referencia deseada: Beige cenizo 7.1',
        },
      ],
    });

    expect(reserva.serviciosDetalle).toEqual([
      {
        id: 'svc-1',
        name: 'Balayage Premium',
        duration: 120,
        price: 350000,
        category: 'Color',
        status: 'confirmed',
        order: 0,
        motivo: 'Marca o línea preferida: Wella. Tono o referencia deseada: Beige cenizo 7.1',
      },
    ]);
    expect(reserva.observaciones).toBe('Cliente prefiere contacto por WhatsApp');
  });

  it('serializa productos adicionales y recalcula el total para agenda admin y empleado', () => {
    const reserva = serializarReservaApi({
      id: 'res-2',
      estudioId: 'est-1',
      personalId: 'per-qa',
      clienteId: 'cli-2',
      nombreCliente: 'Cliente Flujo QA',
      telefonoCliente: '5510002233',
      fecha: '2026-04-17',
      horaInicio: '13:30',
      duracion: 60,
      servicios: [
        {
          id: 'svc-qa',
          name: 'Corte Dama / Niña',
          duration: 60,
          price: 800,
          category: 'Cabello',
        },
      ],
      precioTotal: 1,
      estado: 'confirmed',
      sucursal: 'MIKELOV STUDIO',
      marcaTinte: null,
      tonalidad: null,
      observaciones: null,
      metodoPago: 'cash',
      motivoCancelacion: null,
      productosAdicionales: [
        {
          id: 'prod-aceite',
          nombre: 'Aceite de Cutícula',
          categoria: 'Retail',
          cantidad: 2,
          precioUnitario: 190,
          total: 380,
        },
      ],
      clienteAppId: null,
      tokenCancelacion: 'tok-qa',
      creadoEn: new Date('2026-04-16T10:00:00.000Z'),
      serviciosDetalle: [
        {
          id: 'svc-qa',
          nombre: 'Corte Dama / Niña',
          duracion: 60,
          precio: 800,
          categoria: 'Cabello',
          orden: 0,
          estado: 'confirmed',
          motivo: null,
        },
      ],
    });

    expect(reserva.productosAdicionales).toEqual([
      {
        id: 'prod-aceite',
        nombre: 'Aceite de Cutícula',
        categoria: 'Retail',
        cantidad: 2,
        precioUnitario: 190,
        total: 380,
      },
    ]);
    expect(reserva.precioTotal).toBe(1180);
    expect(reserva.serviciosDetalle).toEqual([
      {
        id: 'svc-qa',
        name: 'Corte Dama / Niña',
        duration: 60,
        price: 800,
        category: 'Cabello',
        status: 'confirmed',
        order: 0,
        motivo: null,
      },
    ]);
  });
});