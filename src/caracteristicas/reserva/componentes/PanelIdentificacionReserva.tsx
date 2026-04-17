import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Mail, UserPlus } from 'lucide-react';
import { MedidorContrasena } from '../../../componentes/ui/MedidorContrasena';
import { SelectorCumpleanos } from '../../../componentes/ui/SelectorCumpleanos';
import {
  esquemaCorreoCliente,
  esquemaRegistroCliente,
  limpiarCorreoCliente,
  limpiarTelefonoCliente,
  limpiarTextoSoloLetras,
  type CamposCorreoCliente,
  type CamposRegistroCliente,
} from '../../../lib/registroCliente';
import { obtenerPerfilClienteReservaPublica } from '../../../servicios/servicioClienteApp';
import { ErrorServicioRegistro, registrarCliente } from '../../../servicios/servicioRegistro';
import type { Pais, PerfilClienteReservaPublica } from '../../../tipos';

export interface ClienteReservaVinculado {
  email: string;
  nombre: string;
  apellido: string;
  telefono: string;
  fechaNacimiento: string;
  ciudad: string | null;
  pais: Pais;
  origen: 'registrado' | 'nuevo';
  mensajeSecundario?: string;
}

interface PropsPanelIdentificacionReserva {
  salonId: string;
  clienteVinculado: ClienteReservaVinculado | null;
  onVincularCliente: (cliente: ClienteReservaVinculado) => void;
  onLimpiarCliente: () => void;
}

export function PanelIdentificacionReserva({
  salonId,
  clienteVinculado,
  onVincularCliente,
  onLimpiarCliente,
}: PropsPanelIdentificacionReserva) {
  const [modo, setModo] = useState<'registrado' | 'nuevo'>('registrado');
  const [mensajeEstado, setMensajeEstado] = useState('');
  const [cargando, setCargando] = useState(false);

  const formularioCorreo = useForm<CamposCorreoCliente>({
    resolver: zodResolver(esquemaCorreoCliente),
    defaultValues: { email: clienteVinculado?.email ?? '' },
  });

  const formularioRegistro = useForm<CamposRegistroCliente>({
    resolver: zodResolver(esquemaRegistroCliente),
    defaultValues: {
      nombreCompleto: clienteVinculado
        ? `${clienteVinculado.nombre} ${clienteVinculado.apellido}`.trim()
        : '',
      email: clienteVinculado?.email ?? '',
      telefono: clienteVinculado?.telefono ?? '',
      ciudad: clienteVinculado?.ciudad ?? '',
      pais: clienteVinculado?.pais ?? 'Mexico',
      fechaNacimiento: clienteVinculado?.fechaNacimiento ?? '',
      contrasena: '',
      confirmarContrasena: '',
      aceptaTerminos: false,
    },
  });

  const nombreClienteVinculado = useMemo(() => {
    if (!clienteVinculado) return '';
    return `${clienteVinculado.nombre} ${clienteVinculado.apellido}`.trim();
  }, [clienteVinculado]);

  const contrasena = formularioRegistro.watch('contrasena') ?? '';

  const aplicarPerfil = (
    perfil: PerfilClienteReservaPublica,
    origen: ClienteReservaVinculado['origen'],
    mensajeSecundario?: string,
  ) => {
    onVincularCliente({
      email: perfil.email,
      nombre: perfil.nombre,
      apellido: perfil.apellido,
      telefono: perfil.telefono ?? '',
      fechaNacimiento: perfil.fechaNacimiento ?? '',
      ciudad: perfil.ciudad ?? null,
      pais: perfil.pais,
      origen,
      mensajeSecundario,
    });
  };

  const manejarBusqueda = formularioCorreo.handleSubmit(async (datos) => {
    setCargando(true);
    setMensajeEstado('');
    try {
      const correo = limpiarCorreoCliente(datos.email);
      const perfil = await obtenerPerfilClienteReservaPublica(salonId, correo);
      if (!perfil.encontrado) {
        setMensajeEstado(
          'No encontramos una cuenta con ese correo. Puedes crearla aquí y continuar con la reserva.',
        );
        setModo('nuevo');
        formularioRegistro.setValue('email', correo, { shouldDirty: true });
        return;
      }

      aplicarPerfil(perfil, 'registrado');
      setMensajeEstado(
        'Encontramos tu cuenta. Tus datos ya quedaron listos para completar la reserva.',
      );
    } catch {
      setMensajeEstado('No pudimos validar ese correo ahora mismo. Intenta de nuevo en unos segundos.');
    } finally {
      setCargando(false);
    }
  });

  const manejarRegistro = formularioRegistro.handleSubmit(async (datos) => {
    setCargando(true);
    setMensajeEstado('');
    try {
      await registrarCliente({
        nombreCompleto: datos.nombreCompleto,
        email: limpiarCorreoCliente(datos.email),
        telefono: datos.telefono,
        ciudad: datos.ciudad || undefined,
        pais: datos.pais,
        fechaNacimiento: datos.fechaNacimiento,
        contrasena: datos.contrasena,
      });

      const [nombre, ...resto] = datos.nombreCompleto.trim().split(/\s+/);
      aplicarPerfil(
        {
          encontrado: true,
          email: limpiarCorreoCliente(datos.email),
          nombre: nombre ?? '',
          apellido: resto.join(' '),
          telefono: datos.telefono || null,
          fechaNacimiento: datos.fechaNacimiento,
          ciudad: datos.ciudad || null,
          pais: datos.pais,
        },
        'nuevo',
        'Te enviamos un código de verificación a tu correo. Ya puedes continuar con la reserva usando esta cuenta recién creada.',
      );
      setMensajeEstado(
        'Tu cuenta quedó creada y vinculada a esta reserva. Continúa con el servicio, horario y demás datos.',
      );
    } catch (error) {
      if (error instanceof ErrorServicioRegistro) {
        setMensajeEstado(error.message);
        return;
      }
      setMensajeEstado('No pudimos crear tu cuenta desde este enlace. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  });

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Acceso del cliente
          </p>
          <h2 className="mt-2 text-lg font-black text-slate-900">
            Identifica al cliente antes de continuar
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Si el cliente ya tiene cuenta, escribe su correo para completar sus datos automáticamente.
            Si aún no está registrado, crea su cuenta aquí mismo y la reserva quedará vinculada a su perfil.
          </p>
        </div>
        {clienteVinculado ? (
          <button
            type="button"
            onClick={onLimpiarCliente}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Cambiar cliente
          </button>
        ) : null}
      </div>

      {clienteVinculado ? (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-sm text-emerald-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Cliente listo
          </p>
          <p className="mt-2 text-lg font-black">{nombreClienteVinculado}</p>
          <p className="mt-1 font-semibold">{clienteVinculado.email}</p>
          <p className="mt-1 text-emerald-800">
            Teléfono: {clienteVinculado.telefono || 'Pendiente'} · Cumpleaños:{' '}
            {clienteVinculado.fechaNacimiento || 'Pendiente'}
          </p>
          {clienteVinculado.mensajeSecundario ? (
            <p className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-xs font-bold text-emerald-800">
              {clienteVinculado.mensajeSecundario}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-6 inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setModo('registrado')}
              className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition ${modo === 'registrado' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              <span className="inline-flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Ya tiene cuenta
              </span>
            </button>
            <button
              type="button"
              onClick={() => setModo('nuevo')}
              className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition ${modo === 'nuevo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Crear cuenta
              </span>
            </button>
          </div>

          {modo === 'registrado' ? (
            <form onSubmit={manejarBusqueda} className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Correo del cliente
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    {...formularioCorreo.register('email', {
                      onChange: (evento) => {
                        evento.target.value = limpiarCorreoCliente(evento.target.value);
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 px-11 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                    placeholder="cliente@gmail.com"
                  />
                </div>
                {formularioCorreo.formState.errors.email ? (
                  <p className="mt-2 text-xs font-bold text-red-600">
                    {formularioCorreo.formState.errors.email.message}
                  </p>
                ) : null}
              </label>
              <button
                type="submit"
                disabled={cargando}
                className="rounded-2xl bg-slate-900 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {cargando ? 'Validando...' : 'Usar esta cuenta'}
              </button>
            </form>
          ) : (
            <form onSubmit={manejarRegistro} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Nombre completo
                  </span>
                  <input
                    type="text"
                    autoComplete="name"
                    {...formularioRegistro.register('nombreCompleto', {
                      onChange: (evento) => {
                        evento.target.value = limpiarTextoSoloLetras(evento.target.value);
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                    placeholder="María López"
                  />
                  {formularioRegistro.formState.errors.nombreCompleto ? (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {formularioRegistro.formState.errors.nombreCompleto.message}
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Correo electrónico
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    {...formularioRegistro.register('email', {
                      onChange: (evento) => {
                        evento.target.value = limpiarCorreoCliente(evento.target.value);
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                    placeholder="cliente@gmail.com"
                  />
                  {formularioRegistro.formState.errors.email ? (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {formularioRegistro.formState.errors.email.message}
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Teléfono
                  </span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={10}
                    {...formularioRegistro.register('telefono', {
                      onChange: (evento) => {
                        evento.target.value = limpiarTelefonoCliente(evento.target.value);
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                    placeholder="5512345678"
                  />
                  {formularioRegistro.formState.errors.telefono ? (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {formularioRegistro.formState.errors.telefono.message}
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    País
                  </span>
                  <select
                    {...formularioRegistro.register('pais')}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                  >
                    <option value="Mexico">México</option>
                    <option value="Colombia">Colombia</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Ciudad
                  </span>
                  <input
                    type="text"
                    autoComplete="address-level2"
                    {...formularioRegistro.register('ciudad', {
                      onChange: (evento) => {
                        evento.target.value = limpiarTextoSoloLetras(evento.target.value);
                      },
                    })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                    placeholder="Ciudad"
                  />
                  {formularioRegistro.formState.errors.ciudad ? (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {formularioRegistro.formState.errors.ciudad.message}
                    </p>
                  ) : null}
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Fecha de cumpleaños
                  </span>
                  <SelectorCumpleanos
                    valor={formularioRegistro.watch('fechaNacimiento') ?? ''}
                    alCambiar={(valor) =>
                      formularioRegistro.setValue('fechaNacimiento', valor, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  {formularioRegistro.formState.errors.fechaNacimiento ? (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {formularioRegistro.formState.errors.fechaNacimiento.message}
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Contraseña
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...formularioRegistro.register('contrasena')}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                    placeholder="Crea una contraseña"
                  />
                  {formularioRegistro.formState.errors.contrasena ? (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {formularioRegistro.formState.errors.contrasena.message}
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Confirmar contraseña
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...formularioRegistro.register('confirmarContrasena')}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
                    placeholder="Repite la contraseña"
                  />
                  {formularioRegistro.formState.errors.confirmarContrasena ? (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {formularioRegistro.formState.errors.confirmarContrasena.message}
                    </p>
                  ) : null}
                </label>
              </div>

              <MedidorContrasena contrasena={contrasena} />

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  {...formularioRegistro.register('aceptaTerminos')}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  Confirmo que el cliente acepta crear su cuenta para continuar con la reserva y
                  recibir el código de verificación por correo.
                </span>
              </label>
              {formularioRegistro.formState.errors.aceptaTerminos ? (
                <p className="text-xs font-bold text-red-600">
                  {formularioRegistro.formState.errors.aceptaTerminos.message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-2xl bg-pink-600 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-pink-500 disabled:opacity-60"
              >
                {cargando ? 'Creando cuenta...' : 'Crear cuenta y continuar'}
              </button>
            </form>
          )}

          {mensajeEstado ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              {mensajeEstado}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}