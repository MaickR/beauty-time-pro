import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import {
  enviarMensajeMasivo,
  obtenerMensajesMasivos,
  type DatosMensajesMasivos,
} from '../../../servicios/servicioMensajesMasivos';
import type { PlanEstudio } from '../../../tipos';
import { obtenerDefinicionPlan } from '../../../lib/planes';

interface PropsMensajesMasivos {
  estudioId: string;
  plan: PlanEstudio;
}

const WHATSAPP_SOPORTE =
  'https://wa.me/525512345678?text=Hola%2C%20quiero%20adquirir%20envíos%20adicionales%20de%20mensajes%20masivos';

export function MensajesMasivos({ estudioId, plan }: PropsMensajesMasivos) {
  const definicionPlan = obtenerDefinicionPlan(plan);
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const esPro = definicionPlan.fidelidad; // PRO = fidelidad habilitada

  const { data, isLoading } = useQuery({
    queryKey: ['mensajes-masivos', estudioId],
    queryFn: () => obtenerMensajesMasivos(estudioId),
    staleTime: 2 * 60 * 1000,
    enabled: esPro,
  });

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');

  const mutacion = useMutation({
    mutationFn: (datos: { titulo: string; texto: string }) => enviarMensajeMasivo(estudioId, datos),
    onSuccess: (resultado) => {
      void clienteConsulta.invalidateQueries({ queryKey: ['mensajes-masivos', estudioId] });
      mostrarToast(`Mensaje enviado a ${resultado.destinatarios} clientes`);
      setMostrarFormulario(false);
      setTitulo('');
      setTexto('');
    },
    onError: (error: { codigo?: string; message?: string }) => {
      if (error.codigo === 'LIMITE_MENSAJES_ALCANZADO') {
        mostrarToast('Ya usaste todos tus mensajes masivos');
      } else {
        mostrarToast('No se pudo enviar el mensaje');
      }
    },
  });

  // Si no es PRO, no renderizar nada (el guard PRO está en ConfigFidelidad)
  if (!esPro) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const datosMsg: DatosMensajesMasivos = data ?? { mensajes: [], usados: 0, limite: 3, extra: 0 };
  const limiteAlcanzado = datosMsg.usados >= datosMsg.limite;

  const enviar = () => {
    if (!titulo.trim() || !texto.trim()) {
      mostrarToast('El título y el mensaje son obligatorios');
      return;
    }
    if (texto.length > 200) {
      mostrarToast('El mensaje no puede superar los 200 caracteres');
      return;
    }
    mutacion.mutate({ titulo: titulo.trim(), texto: texto.trim() });
  };

  return (
    <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6 max-w-4xl overflow-x-hidden">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Mensajes masivos
          </h3>
          <p className="text-sm text-slate-500 mt-2">
            Envía campañas a los clientes de tu salón que tengan correo registrado.
          </p>
        </div>
        <span className="px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-sm font-black">
          {datosMsg.usados} / {datosMsg.limite} usados este año
        </span>
      </div>

      {limiteAlcanzado ? (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 space-y-4">
          <p className="text-sm font-bold text-amber-800">
            Ya agotaste tus mensajes masivos incluidos. Contacta soporte para adquirir envíos extra.
          </p>
          <a
            href={WHATSAPP_SOPORTE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-sm font-black uppercase tracking-widest transition-colors shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Contactar soporte por WhatsApp
          </a>
        </div>
      ) : (
        <>
          {!mostrarFormulario ? (
            <button
              type="button"
              onClick={() => setMostrarFormulario(true)}
              className="px-6 py-3 rounded-2xl bg-(--color-primario) hover:bg-(--color-primario-oscuro) text-white text-sm font-black uppercase tracking-widest transition-colors shadow-sm"
            >
              Nuevo mensaje masivo
            </button>
          ) : (
            <div className="space-y-4 rounded-2xl border border-slate-200 p-6">
              <div>
                <label
                  htmlFor="tituloMensaje"
                  className="block text-sm font-bold text-slate-700 mb-2"
                >
                  Título
                </label>
                <input
                  id="tituloMensaje"
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={100}
                  placeholder="Ej: Promoción especial de fin de semana"
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3"
                />
              </div>

              <div>
                <label
                  htmlFor="textoMensaje"
                  className="block text-sm font-bold text-slate-700 mb-2"
                >
                  Mensaje
                  <span className="text-slate-400 font-normal ml-2">{texto.length}/200</span>
                </label>
                <textarea
                  id="textoMensaje"
                  rows={3}
                  maxLength={200}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Escribe el mensaje para tus clientes..."
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={enviar}
                  disabled={mutacion.isPending || !titulo.trim() || !texto.trim()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-(--color-primario) hover:bg-(--color-primario-oscuro) text-white text-sm font-black uppercase tracking-widest transition-colors shadow-sm disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  {mutacion.isPending ? 'Enviando...' : 'Enviar mensaje'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setTitulo('');
                    setTexto('');
                  }}
                  className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Historial de mensajes enviados */}
      {datosMsg.mensajes.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-500">
            Mensajes enviados
          </h4>
          <div className="space-y-2">
            {datosMsg.mensajes.map((msg) => (
              <div
                key={msg.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{msg.titulo}</p>
                  <p className="text-xs text-slate-500 truncate">{msg.texto}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400 font-medium">
                  {new Date(msg.fechaEnvio).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
