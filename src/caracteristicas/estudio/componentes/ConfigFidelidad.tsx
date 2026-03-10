import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Percent, Sparkles } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import {
  guardarConfigFidelidad,
  obtenerConfigFidelidad,
  obtenerRankingFidelidad,
  type ConfiguracionFidelidad,
} from '../../../servicios/servicioFidelidad';

interface PropsConfigFidelidad {
  estudioId: string;
}

export function ConfigFidelidad({ estudioId }: PropsConfigFidelidad) {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ['fidelidad-config', estudioId],
    queryFn: () => obtenerConfigFidelidad(estudioId),
  });
  const { data: ranking = [] } = useQuery({
    queryKey: ['fidelidad-ranking', estudioId],
    queryFn: () => obtenerRankingFidelidad(estudioId, 10),
    refetchInterval: 10000,
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

  if (!formulario) {
    return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const actualizar = <K extends keyof ConfiguracionFidelidad>(campo: K, valor: ConfiguracionFidelidad[K]) => {
    setFormulario((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  };

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Programa de Fidelidad</h3>
            <p className="text-sm text-slate-500 mt-2">Premia a tus clientes frecuentes automáticamente.</p>
          </div>
          <button
            type="button"
            onClick={() => actualizar('activo', !formulario.activo)}
            className={`px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-colors ${formulario.activo ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            {formulario.activo ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        {formulario.activo && (
          <div className="space-y-6">
            <div>
              <label htmlFor="visitasRequeridas" className="block text-sm font-bold text-slate-700 mb-2">Número de visitas requeridas</label>
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
                <span className="min-w-12 text-center font-black text-slate-800">{formulario.visitasRequeridas}</span>
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
                    onClick={() => actualizar('tipoRecompensa', valor as ConfiguracionFidelidad['tipoRecompensa'])}
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
                <label htmlFor="porcentajeDescuento" className="block text-sm font-bold text-slate-700 mb-2">Porcentaje de descuento</label>
                <div className="flex items-center gap-4">
                  <input
                    id="porcentajeDescuento"
                    type="range"
                    min={10}
                    max={100}
                    step={10}
                    value={formulario.porcentajeDescuento ?? 100}
                    onChange={(e) => actualizar('porcentajeDescuento', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="min-w-12 text-center font-black text-slate-800">{formulario.porcentajeDescuento ?? 100}%</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="descripcionRecompensa" className="block text-sm font-bold text-slate-700 mb-2">
                Descripción personalizable
                <span className="text-slate-400 font-normal ml-2">{formulario.descripcionRecompensa.length}/100</span>
              </label>
              <textarea
                id="descripcionRecompensa"
                rows={3}
                maxLength={100}
                value={formulario.descripcionRecompensa}
                onChange={(e) => actualizar('descripcionRecompensa', e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 resize-none"
              />
            </div>

            <div className="rounded-3xl bg-emerald-50 border border-emerald-200 px-5 py-4">
              <p className="text-sm font-black text-emerald-800 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Vista previa</p>
              <p className="text-sm text-emerald-900 mt-2">🎉 ¡Felicidades! Has completado {formulario.visitasRequeridas} visitas. {formulario.descripcionRecompensa}</p>
            </div>

            <button
              type="button"
              onClick={() => mutacion.mutate(formulario)}
              disabled={mutacion.isPending}
              className="px-6 py-3 rounded-2xl bg-(--color-primario) hover:bg-(--color-primario-oscuro) text-white font-black uppercase tracking-widest text-sm disabled:opacity-60"
            >
              {mutacion.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm max-w-4xl">
        <h3 className="text-xl font-black uppercase tracking-tight mb-6">Ranking de clientes fieles</h3>
        <div className="space-y-4">
          {ranking.map((cliente) => (
            <div key={cliente.id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                <div>
                  <p className="font-black text-slate-900">{cliente.nombre}</p>
                  <p className="text-sm text-slate-500">{cliente.telefono}</p>
                </div>
                {cliente.recompensaDisponible && (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">🎁 Recompensa disponible</span>
                )}
              </div>
              <progress
                className="w-full h-3 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-(--color-primario)"
                max={cliente.visitasRequeridas}
                value={Math.min(cliente.visitasAcumuladas, cliente.visitasRequeridas)}
              />
              <p className="text-xs text-slate-500 mt-2">{cliente.visitasAcumuladas} visitas acumuladas de {cliente.visitasRequeridas} requeridas</p>
            </div>
          ))}
          {ranking.length === 0 && <p className="text-sm text-slate-400">Aún no hay clientes con progreso de fidelidad.</p>}
        </div>
      </section>
    </div>
  );
}