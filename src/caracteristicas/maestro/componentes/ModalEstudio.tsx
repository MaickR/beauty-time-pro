import type { Dispatch, SetStateAction } from 'react';
import { XCircle, User, ListChecks, Clock, Key, DollarSign } from 'lucide-react';
import { CATALOGO_SERVICIOS, DIAS_SEMANA } from '../../../lib/constantes';
import { SeccionPersonalFormulario } from './SeccionPersonalFormulario';
import type { Personal } from '../../../tipos';
import type { FormularioEstudio } from '../hooks/usarFormularioEstudio';

interface PropsCatalogo {
  alternarServicio: (nombre: string) => void;
  actualizarCampoServicio: (nombre: string, campo: 'duration' | 'price', valor: string) => void;
  agregarServicioPersonalizado: (categoria: string) => void;
  entradaServicioPersonalizado: Record<string, string>;
  setEntradaServicioPersonalizado: Dispatch<SetStateAction<Record<string, string>>>;
}

interface PropsModalEstudio {
  modo: 'ADD' | 'EDIT';
  formulario: FormularioEstudio;
  setFormulario: Dispatch<SetStateAction<FormularioEstudio>>;
  catalogoProps: PropsCatalogo;
  onAgregarPersonal: (personal: Personal) => void;
  onEnviar: (e: React.FormEvent) => void;
  onCerrar: () => void;
}

export function ModalEstudio({
  modo,
  formulario,
  setFormulario,
  catalogoProps,
  onAgregarPersonal,
  onEnviar,
  onCerrar,
}: PropsModalEstudio) {
  const { alternarServicio, actualizarCampoServicio, agregarServicioPersonalizado,
    entradaServicioPersonalizado, setEntradaServicioPersonalizado } = catalogoProps;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-estudio-titulo"
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[60] flex items-center justify-center p-4"
    >
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
          <h2 id="modal-estudio-titulo" className="text-2xl font-black italic uppercase tracking-tighter">
            {modo === 'EDIT' ? 'Editar Studio' : 'Registro Completo'}
          </h2>
          <button onClick={onCerrar} aria-label="Cerrar modal">
            <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
          </button>
        </div>

        <form onSubmit={onEnviar} className="flex-1 overflow-y-auto p-10 space-y-12">
          {/* SECCIÓN 1: IDENTIDAD */}
          <section className="grid grid-cols-2 gap-6">
            <div className="col-span-full font-black text-xs text-pink-600 uppercase tracking-widest mb-2 flex items-center gap-2">
              <User className="w-4 h-4" /> Identidad del Negocio
            </div>
            <div>
              <label htmlFor="nombre-estudio" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre del Estudio</label>
              <input id="nombre-estudio" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500" placeholder="Nombre" value={formulario.name} onChange={(e) => setFormulario((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label htmlFor="dueno-estudio" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Dueño</label>
              <input id="dueno-estudio" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500 w-full" placeholder="Dueño" value={formulario.owner} onChange={(e) => setFormulario((p) => ({ ...p, owner: e.target.value }))} required />
            </div>
            <div>
              <label htmlFor="pais-estudio" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">País del Studio</label>
              <select id="pais-estudio" value={formulario.country} onChange={(e) => setFormulario((p) => ({ ...p, country: e.target.value as 'Mexico' | 'Colombia' }))} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-pink-500 appearance-none">
                <option value="Mexico">México ($1,000 MXN)</option>
                <option value="Colombia">Colombia ($200,000 COP)</option>
              </select>
            </div>
            <div>
              <label htmlFor="inicio-operaciones" className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-2 ml-1">Día de Inicio Operaciones (Cobro)</label>
              <input id="inicio-operaciones" type="date" value={formulario.subscriptionStart ?? ''} onChange={(e) => setFormulario((p) => ({ ...p, subscriptionStart: e.target.value }))} className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl font-bold outline-none text-white focus:border-pink-500 transition-all cursor-pointer" required />
            </div>
            {formulario.branches.map((b, i) => (
              <div key={i} className="col-span-full">
                <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" placeholder={`Sucursal ${i + 1}`} value={b} onChange={(e) => { const copy = [...formulario.branches]; copy[i] = e.target.value; setFormulario((p) => ({ ...p, branches: copy })); }} required />
              </div>
            ))}
            {formulario.branches.length < 5 && (
              <button type="button" onClick={() => setFormulario((p) => ({ ...p, branches: [...p.branches, ''] }))} className="col-span-full py-3 border-2 border-dashed rounded-2xl text-slate-400 font-bold text-xs uppercase">
                + Añadir Sucursal
              </button>
            )}
          </section>

          {/* SECCIÓN 2: CATÁLOGO */}
          <section className="space-y-6">
            <div className="font-black text-xs text-pink-600 uppercase tracking-widest flex items-center gap-2"><ListChecks className="w-4 h-4" /> Catálogo y Tiempos</div>
            {Object.entries(CATALOGO_SERVICIOS).map(([cat, items]) => {
              const custom = (formulario.customServices ?? []).filter((c) => c.category === cat).map((c) => c.name);
              const todos = Array.from(new Set([...items, ...custom]));
              return (
                <div key={cat} className="space-y-3 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-md inline-block uppercase">{cat}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {todos.map((s) => {
                      const sel = formulario.selectedServices.find((sv) => sv.name === s);
                      return (
                        <div key={s} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border gap-3 transition-all ${sel ? 'bg-pink-50 border-pink-300' : 'bg-white border-slate-100'}`}>
                          <button type="button" onClick={() => alternarServicio(s)} className={`text-left text-[10px] font-bold flex-1 ${sel ? 'text-pink-700' : 'text-slate-500'}`}>{sel && '✓ '}{s}</button>
                          {sel && (
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-pink-100">
                                <Clock className="w-3 h-3 text-pink-400" />
                                <input type="number" min="5" step="5" value={sel.duration} onChange={(e) => actualizarCampoServicio(s, 'duration', e.target.value)} className="w-12 text-[10px] font-black outline-none text-center text-slate-700" />
                                <span className="text-[8px] font-black text-slate-400">MIN</span>
                              </div>
                              <div className="flex items-center gap-1 bg-green-50 p-1 rounded-lg border border-green-200">
                                <DollarSign className="w-3 h-3 text-green-600" />
                                <input type="number" min="0" value={sel.price ?? 0} onChange={(e) => actualizarCampoServicio(s, 'price', e.target.value)} className="w-16 text-[10px] font-black outline-none text-center text-green-800 bg-transparent" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-2 w-full md:w-1/2">
                    <input value={entradaServicioPersonalizado[cat] ?? ''} onChange={(e) => setEntradaServicioPersonalizado((p) => ({ ...p, [cat]: e.target.value }))} placeholder={`+ Añadir servicio en ${cat}...`} className="flex-1 text-[10px] font-bold p-3 rounded-xl border border-slate-200 outline-none focus:border-pink-400 bg-white" />
                    <button type="button" onClick={() => agregarServicioPersonalizado(cat)} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-black">AÑADIR</button>
                  </div>
                </div>
              );
            })}
          </section>

          {/* SECCIÓN 3: PERSONAL */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SeccionPersonalFormulario serviciosDisponibles={formulario.selectedServices} onAgregarPersonal={onAgregarPersonal} />
            {/* SECCIÓN 4: HORARIO OPERATIVO */}
            <div>
              <div className="font-black text-xs text-pink-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Horario Operativo del Local</div>
              <div className="space-y-2">
                {DIAS_SEMANA.map((dia) => (
                  <div key={dia} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-[10px] font-black">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={formulario.schedule[dia]?.isOpen ?? true} onChange={(e) => setFormulario((p) => ({ ...p, schedule: { ...p.schedule, [dia]: { ...p.schedule[dia], isOpen: e.target.checked } } }))} className="accent-pink-600" />
                      <span className="uppercase">{dia}</span>
                    </div>
                    {formulario.schedule[dia]?.isOpen && (
                      <div className="flex gap-1">
                        <input type="time" value={formulario.schedule[dia]?.openTime ?? '09:00'} onChange={(e) => setFormulario((p) => ({ ...p, schedule: { ...p.schedule, [dia]: { ...p.schedule[dia], openTime: e.target.value } } }))} className="bg-white border border-slate-200 rounded p-1 text-[10px] outline-none" />
                        <span>-</span>
                        <input type="time" value={formulario.schedule[dia]?.closeTime ?? '19:00'} onChange={(e) => setFormulario((p) => ({ ...p, schedule: { ...p.schedule, [dia]: { ...p.schedule[dia], closeTime: e.target.value } } }))} className="bg-white border border-slate-200 rounded p-1 text-[10px] outline-none" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECCIÓN 5: CREDENCIALES */}
          <section className="bg-slate-900 p-8 rounded-[2rem] text-white">
            <div className="font-black text-xs text-pink-400 uppercase tracking-widest mb-6"><Key className="w-4 h-4 inline mr-2" /> Credenciales</div>
            <label className="text-[9px] font-black text-slate-400 uppercase" htmlFor="clave-dueno">Clave DUEÑO</label>
            <input id="clave-dueno" className="w-full p-3 mb-4 bg-slate-800 border border-slate-700 rounded-xl text-pink-400 font-mono text-sm uppercase" value={formulario.assignedKey} onChange={(e) => setFormulario((p) => ({ ...p, assignedKey: e.target.value.toUpperCase() }))} required />
            <label className="text-[9px] font-black text-slate-400 uppercase" htmlFor="clave-clientes">Clave CLIENTES</label>
            <input id="clave-clientes" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-purple-400 font-mono text-sm uppercase" value={formulario.clientKey} onChange={(e) => setFormulario((p) => ({ ...p, clientKey: e.target.value.toUpperCase() }))} required />
          </section>

          <div className="pt-8 flex gap-4">
            <button type="button" onClick={onCerrar} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-[2rem] uppercase text-xs">Cancelar</button>
            <button type="submit" className="flex-1 py-5 bg-pink-600 text-white font-black rounded-[2rem] uppercase text-xs shadow-2xl hover:bg-pink-700 transition-colors">Confirmar Alta / Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
}
