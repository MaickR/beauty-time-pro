import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, MessageCircle, Percent, Sparkles } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import {
  guardarConfigFidelidad,
  obtenerConfigFidelidad,
  type ConfiguracionFidelidad,
} from '../../../servicios/servicioFidelidad';
import type { PlanEstudio } from '../../../tipos';
import { MENSAJE_FUNCION_PRO, obtenerDefinicionPlan } from '../../../lib/planes';

interface PropsConfigFidelidad {
  estudioId: string;
  plan: PlanEstudio;
}

export function ConfigFidelidad({ estudioId, plan }: PropsConfigFidelidad) {
  const definicionPlan = obtenerDefinicionPlan(plan);
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const planPermiteFidelidad = definicionPlan.fidelidad;
  const { data: config } = useQuery({
    queryKey: ['fidelidad-config', estudioId],
    queryFn: () => obtenerConfigFidelidad(estudioId),
    staleTime: 2 * 60 * 1000,
    enabled: planPermiteFidelidad,
  });
  const [formulario, setFormulario] = useState<ConfiguracionFidelidad | null>(null);

  useEffect(() => {
    if (config) setFormulario(config);
  }, [config]);

  const mutacion = useMutation({
    mutationFn: (datos: ConfiguracionFidelidad) => guardarConfigFidelidad(estudioId, datos),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: ['fidelidad-config', estudioId] });
      void clienteConsulta.invalidateQueries({ queryKey: ['fidelidad-ranking', estudioId] });
      mostrarToast('Configuración de fidelidad guardada');
    },
    onError: () => mostrarToast('No fue posible guardar la configuración'),
  });

  if (!planPermiteFidelidad) {
    return (
      <section className="max-w-4xl rounded-[2.5rem] border border-amber-200 bg-amber-50 p-8 shadow-sm space-y-6">
        <p className="text-xs font-black uppercase tracking-widest text-amber-700">Función Pro</p>
        <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
          El programa de fidelidad no está incluido en el plan {definicionPlan.nombre}
        </h3>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
          {MENSAJE_FUNCION_PRO}
        </p>
        <a
          href="https://wa.me/525512345678?text=Hola%2C%20quiero%20información%20sobre%20el%20plan%20Pro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-sm font-black uppercase tracking-widest transition-colors shadow-sm"
        >
          <MessageCircle className="w-4 h-4" />
          Mejorar a Pro por WhatsApp
        </a>
      </section>
    );
  }

  if (!formulario) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const actualizar = <K extends keyof ConfiguracionFidelidad>(
    campo: K,
    valor: ConfiguracionFidelidad[K],
  ) => {
    setFormulario((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  };

  return (
    <div className="space-y-8 overflow-x-hidden">
      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6 max-w-4xl overflow-x-hidden">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Programa de Fidelidad</h3>
            <p className="text-sm text-slate-500 mt-2">
              Premia a tus clientes frecuentes automáticamente.
            </p>
          </div>
          {formulario.activo ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Activo
              </span>
              <button
                type="button"
                onClick={() => actualizar('activo', false)}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Desactivar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => actualizar('activo', true)}
              className="px-6 py-3 rounded-2xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-black uppercase tracking-widest transition-colors shadow-sm"
            >
              Activar programa de fidelidad
            </button>
          )}
        </div>

        {formulario.activo && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="visitasRequeridas"
                className="block text-sm font-bold text-slate-700 mb-2"
              >
                Número de visitas requeridas
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="visitasRequeridas"
                  type="range"
                  min={2}
                  max={20}
                  value={formulario.visitasRequeridas}
                  onChange={(e) => actualizar('visitasRequeridas', Number(e.target.value))}
                  className="flex-1"
                />
                <span className="min-w-12 text-center font-black text-slate-800">
                  {formulario.visitasRequeridas}
                </span>
              </div>
            </div>

            <div>
              <p className="block text-sm font-bold text-slate-700 mb-3">Tipo de recompensa</p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { valor: 'descuento', titulo: 'Descuento %', icono: Percent },
                  { valor: 'servicio_gratis', titulo: 'Servicio gratis', icono: Gift },
                ].map(({ valor, titulo, icono: Icono }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() =>
                      actualizar(
                        'tipoRecompensa',
                        valor as ConfiguracionFidelidad['tipoRecompensa'],
                      )
                    }
                    className={`p-5 rounded-2xl border text-left transition-colors ${formulario.tipoRecompensa === valor ? 'border-pink-500 bg-pink-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <Icono className="w-5 h-5 mb-3 text-slate-700" />
                    <p className="font-black text-slate-900">{titulo}</p>
                  </button>
                ))}
              </div>
            </div>

            {formulario.tipoRecompensa === 'descuento' && (
              <div>
                <label
                  htmlFor="porcentajeDescuento"
                  className="block text-sm font-bold text-slate-700 mb-2"
                >
                  Porcentaje de descuento
                </label>
                <div className="flex items-center gap-4">
                  <input
                    id="porcentajeDescuento"
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={formulario.porcentajeDescuento ?? 10}
                    onChange={(e) => actualizar('porcentajeDescuento', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="min-w-12 text-center font-black text-slate-800">
                    {formulario.porcentajeDescuento ?? 10}%
                  </span>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="descripcionRecompensa"
                className="block text-sm font-bold text-slate-700 mb-2"
              >
                Descripción personalizable
                <span className="text-slate-400 font-normal ml-2">
                  {formulario.descripcionRecompensa.length}/100
                </span>
              </label>
              <textarea
                id="descripcionRecompensa"
                rows={3}
                maxLength={100}
                value={formulario.descripcionRecompensa}
                onChange={(e) => actualizar('descripcionRecompensa', e.target.value)}
                placeholder={
                  formulario.tipoRecompensa === 'descuento'
                    ? 'Ej: 20% de descuento en tu próxima visita'
                    : 'Ej: Corte de cabello gratis'
                }
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 resize-none"
              />
            </div>

            <div className="rounded-3xl bg-emerald-50 border border-emerald-200 px-5 py-4">
              <p className="text-sm font-black text-emerald-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Vista previa
              </p>
              <p className="text-sm text-emerald-900 mt-2">
                🎉 ¡Felicidades! Has completado {formulario.visitasRequeridas} visitas.{' '}
                {formulario.descripcionRecompensa}
              </p>
            </div>

            <button
              type="button"
              onClick={() => mutacion.mutate(formulario)}
              disabled={mutacion.isPending}
              className="px-6 py-3 rounded-2xl bg-[var(--color-primario)] hover:bg-[var(--color-primario-oscuro)] text-white font-black uppercase tracking-widest text-sm disabled:opacity-60"
            >
              {mutacion.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
