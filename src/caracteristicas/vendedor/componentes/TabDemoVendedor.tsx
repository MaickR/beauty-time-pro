import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Copy,
  FlaskConical,
  KeyRound,
  LogIn,
  RefreshCcw,
  Settings2,
  ShoppingBag,
  Users,
} from 'lucide-react';
import {
  actualizarPlanSalonDemoVendedor,
  obtenerSalonDemoVendedor,
  reiniciarSalonDemoVendedor,
} from '../../../servicios/servicioVendedor';
import { usarTiendaAuth } from '../../../tienda/tiendaAuth';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { formatearFechaHumana } from '../../../utils/formato';

export function TabDemoVendedor() {
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const establecerEstudio = usarTiendaAuth((estado) => estado.establecerEstudio);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const { data: salonDemo, isLoading } = useQuery({
    queryKey: ['vendedor', 'demo'],
    queryFn: obtenerSalonDemoVendedor,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (!salonDemo) return;
    establecerEstudio(salonDemo.id, salonDemo.slug);
  }, [salonDemo, establecerEstudio]);

  const mutacionReset = useMutation({
    mutationFn: reiniciarSalonDemoVendedor,
    onSuccess: (resultado) => {
      clienteConsulta.invalidateQueries({ queryKey: ['vendedor'] });
      establecerEstudio(resultado.id, resultado.slug);
      setMostrarConfirmacion(false);
      mostrarToast('El salón demo se reinició correctamente.');
    },
    onError: () => {
      mostrarToast('No se pudo reiniciar el salón demo.');
    },
  });

  const mutacionPlan = useMutation({
    mutationFn: actualizarPlanSalonDemoVendedor,
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: ['vendedor', 'demo'] });
      void clienteConsulta.invalidateQueries({ queryKey: ['vendedor', 'resumen'] });
      mostrarToast('El plan demo se actualizó correctamente.');
    },
    onError: () => {
      mostrarToast('No se pudo actualizar el plan demo.');
    },
  });

  const copiarTexto = async (texto: string, mensaje: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      mostrarToast({ mensaje, variante: 'exito', icono: '✓' });
    } catch {
      mostrarToast({
        mensaje: 'No se pudo copiar la información del demo.',
        variante: 'error',
        icono: '✗',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  if (!salonDemo) {
    return <p className="py-12 text-center text-slate-500">No se pudo cargar el espacio demo.</p>;
  }

  const urlAgenda = salonDemo.slug
    ? `/estudio/${salonDemo.slug}/agenda`
    : `/estudio/${salonDemo.id}/agenda`;
  const urlAdmin = salonDemo.slug
    ? `/estudio/${salonDemo.slug}/admin`
    : `/estudio/${salonDemo.id}/admin`;
  const estadoAccesoEmpleadoDemo = {
    desde: '/empleado/agenda',
    demo: {
      identificador: salonDemo.credencialesDemo.empleadoEmail,
      contrasena: salonDemo.credencialesDemo.contrasenaCompartida,
      autoIniciar: true,
      titulo: 'Employee demo access',
      mensaje:
        'This action switches the current session to the demo employee and opens the employee dashboard automatically.',
    },
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
        <article className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                Espacio demo
              </p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">{salonDemo.nombre}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Usa este salón aislado como una operación comercial completa: agenda, clientes,
                personal, productos, pagos y cambios de plan sin tocar información productiva.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <FlaskConical className="h-6 w-6" aria-hidden="true" />
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-white/60">
                Plan
              </p>
              <p className="text-2xl font-black">{salonDemo.plan}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaDato etiqueta="Reservas" valor={salonDemo.totales.reservas} icono={Calendar} />
            <TarjetaDato etiqueta="Clientes" valor={salonDemo.totales.clientes} icono={Users} />
            <TarjetaDato etiqueta="Personal" valor={salonDemo.totales.personal} icono={Settings2} />
            <TarjetaDato
              etiqueta="Productos"
              valor={salonDemo.totales.productos}
              icono={ShoppingBag}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Cambiar plan demo
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['STANDARD', 'PRO'] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => mutacionPlan.mutate(plan)}
                  disabled={mutacionPlan.isPending || salonDemo.plan === plan}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${salonDemo.plan === plan ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'} disabled:opacity-60`}
                >
                  {plan}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={urlAgenda}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Abrir agenda
            </Link>
            <Link
              to={urlAdmin}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Abrir administración
            </Link>
            <Link
              to="/iniciar-sesion"
              state={estadoAccesoEmpleadoDemo}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Abrir dashboard empleado
            </Link>
            <button
              type="button"
              onClick={() => setMostrarConfirmacion(true)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Reiniciar demo
            </button>
          </div>
        </article>

        <article className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                Acceso comercial
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">
                Credenciales listas para copiar y presentar ambos roles.
              </h3>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-3 text-emerald-700">
              <LogIn className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-6 rounded-4xl border border-emerald-100 bg-linear-to-r from-emerald-50 via-white to-emerald-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
              Shared password
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Both demo accesses use the same password so the role switch is faster during a live
                presentation.
              </p>
              <button
                type="button"
                onClick={() =>
                  copiarTexto(
                    salonDemo.credencialesDemo.contrasenaCompartida,
                    'Se copió la contraseña compartida del demo.',
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition hover:border-emerald-300"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                {salonDemo.credencialesDemo.contrasenaCompartida}
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <TarjetaCredencialDemo
              titulo="Admin demo"
              descripcion="Usa esta cuenta para mostrar agenda, panel administrativo y control operativo completo del salón demo."
              email={salonDemo.credencialesDemo.adminEmail}
              contrasena={salonDemo.credencialesDemo.adminContrasena}
              onCopiarAcceso={() =>
                copiarTexto(
                  `Email: ${salonDemo.credencialesDemo.adminEmail}\nPassword: ${salonDemo.credencialesDemo.adminContrasena}`,
                  'Se copió el acceso del admin demo.',
                )
              }
              onCopiarContrasena={() =>
                copiarTexto(
                  salonDemo.credencialesDemo.adminContrasena,
                  'Se copió la contraseña del admin demo.',
                )
              }
            />
            <TarjetaCredencialDemo
              titulo="Empleado demo"
              descripcion="Ideal para mostrar agenda del especialista, métricas del día y seguimiento de servicio."
              email={salonDemo.credencialesDemo.empleadoEmail}
              contrasena={salonDemo.credencialesDemo.empleadoContrasena}
              onCopiarAcceso={() =>
                copiarTexto(
                  `Email: ${salonDemo.credencialesDemo.empleadoEmail}\nPassword: ${salonDemo.credencialesDemo.empleadoContrasena}`,
                  'Se copió el acceso del empleado demo.',
                )
              }
              onCopiarContrasena={() =>
                copiarTexto(
                  salonDemo.credencialesDemo.empleadoContrasena,
                  'Se copió la contraseña del empleado demo.',
                )
              }
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-100 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Última sincronización
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {new Date(salonDemo.actualizadoEn).toLocaleString()}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Renovación
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {formatearFechaHumana(salonDemo.fechaVencimiento)}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-4xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Demo operating rules
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                Reset creates a clean presentation state and rebuilds demo reservations, clients,
                staff, products and payments inside this sandbox only.
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                Your assigned sales, productive salons and commission records stay untouched outside
                the demo sandbox.
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                Demo emails and password stay stable for the current seller, so you can repeat the
                same walkthrough without regenerating access every time.
              </div>
            </div>
          </div>
        </article>
      </section>

      {mostrarConfirmacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-md rounded-4xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900">¿Reiniciar salón demo?</h3>
            <p className="mt-3 text-sm text-slate-600">
              Esto eliminará reservas, clientes, personal, productos y pagos demo para que puedas
              iniciar una nueva presentación desde cero.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMostrarConfirmacion(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => mutacionReset.mutate()}
                disabled={mutacionReset.isPending}
                className="rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {mutacionReset.isPending ? 'Reiniciando...' : 'Reiniciar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaCredencialDemo({
  titulo,
  descripcion,
  email,
  contrasena,
  onCopiarAcceso,
  onCopiarContrasena,
}: {
  titulo: string;
  descripcion: string;
  email: string;
  contrasena: string;
  onCopiarAcceso: () => void;
  onCopiarContrasena: () => void;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-900">{titulo}</p>
          <p className="mt-1 text-sm text-slate-500">{descripcion}</p>
        </div>
        <button
          type="button"
          onClick={onCopiarAcceso}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          Copiar acceso
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-2xl bg-white px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Email</p>
          <p className="mt-1 break-all text-sm font-semibold text-slate-900">{email}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            Password
          </p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-900">{contrasena}</p>
            <button
              type="button"
              onClick={onCopiarContrasena}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Copiar
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TarjetaDato({
  etiqueta,
  valor,
  icono: Icono,
}: {
  etiqueta: string;
  valor: number;
  icono: typeof Calendar;
}) {
  return (
    <div className="rounded-3xl bg-slate-100 p-4">
      <Icono className="h-5 w-5 text-slate-500" aria-hidden="true" />
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {etiqueta}
      </p>
      <p className="mt-1 text-3xl font-black text-slate-900">{valor}</p>
    </div>
  );
}
