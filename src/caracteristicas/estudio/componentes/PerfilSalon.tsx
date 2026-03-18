import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { usarTemaSalon } from '../../../hooks/usarTemaSalon';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { URL_BASE } from '../../../lib/clienteHTTP';
import {
  obtenerPerfilEstudio,
  actualizarPerfilEstudio,
  subirLogo,
  type PerfilEstudio,
} from '../../../servicios/servicioPerfil';
import { obtenerDefinicionPlan } from '../../../lib/planes';

interface PropsPerfilSalon {
  estudioId: string;
}

function AreaLogo({
  perfil,
  estudioId,
  onSubida,
}: {
  perfil: PerfilEstudio;
  estudioId: string;
  onSubida: (url: string) => void;
}) {
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);
  const { mostrarToast } = usarToast();

  const logoActual = previsualizacion ?? (perfil.logoUrl ? `${URL_BASE}${perfil.logoUrl}` : null);
  const iniciales = perfil.nombre.slice(0, 2).toUpperCase();

  const manejarArchivo = async (archivo: File) => {
    const urlLocal = URL.createObjectURL(archivo);
    setPrevisualizacion(urlLocal);
    setSubiendo(true);
    try {
      const { logoUrl } = await subirLogo(estudioId, archivo);
      onSubida(logoUrl);
    } catch (err) {
      setPrevisualizacion(null);
      mostrarToast(err instanceof Error ? err.message : 'Error al subir logo');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="flex items-center gap-6">
      <button
        type="button"
        aria-label="Cambiar logo del salón"
        onClick={() => refInput.current?.click()}
        className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-dashed border-slate-300 hover:border-slate-400 transition-colors flex items-center justify-center bg-slate-50 shrink-0"
      >
        {logoActual ? (
          <img src={logoActual} alt="Logo del salón" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-black" style={{ color: perfil.colorPrimario }}>
            {iniciales}
          </span>
        )}
        {subiendo && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>
      <div>
        <p className="text-sm font-bold text-slate-700">Logo del salón</p>
        <p className="text-xs text-slate-400 mt-1">JPG, PNG o WebP · Máximo 2 MB</p>
        <button
          type="button"
          onClick={() => refInput.current?.click()}
          className="mt-2 flex items-center gap-1 text-xs font-bold text-pink-600 hover:text-pink-700"
        >
          <Upload className="w-3 h-3" /> Cambiar logo
        </button>
      </div>
      <input
        ref={refInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void manejarArchivo(f);
        }}
      />
    </div>
  );
}

export function PerfilSalon({ estudioId }: PropsPerfilSalon) {
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
  const clienteConsulta = useQueryClient();
  const refBorradorRestaurado = useRef(false);

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-estudio', estudioId],
    queryFn: () => obtenerPerfilEstudio(estudioId),
    staleTime: 2 * 60 * 1000,
  });

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [emailContacto, setEmailContacto] = useState('');
  const [colorPrimario, setColorPrimario] = useState('#C2185B');
  const CLAVE_ALMACEN = `perfil_salon_${estudioId}`;

  // Hook de tema aplicado siempre, incondicionalmente, antes de cualquier early return
  usarTemaSalon(colorPrimario);

  // Inicializar formulario cuando llegan los datos del servidor
  useEffect(() => {
    if (!perfil) return;
    if (!refBorradorRestaurado.current) {
      try {
        const borrador = localStorage.getItem(CLAVE_ALMACEN);
        if (borrador) {
          const datos = JSON.parse(borrador) as Record<string, string>;
          setNombre(datos.nombre ?? perfil.nombre);
          setDescripcion(datos.descripcion ?? perfil.descripcion ?? '');
          setDireccion(datos.direccion ?? perfil.direccion ?? '');
          setTelefono(datos.telefono ?? perfil.telefono ?? '');
          setEmailContacto(datos.emailContacto ?? perfil.emailContacto ?? '');
          setColorPrimario(datos.colorPrimario ?? perfil.colorPrimario ?? '#C2185B');
          refBorradorRestaurado.current = true;
          return;
        }
      } catch {
        localStorage.removeItem(CLAVE_ALMACEN);
      }
      refBorradorRestaurado.current = true;
    }
    setNombre(perfil.nombre);
    setDescripcion(perfil.descripcion ?? '');
    setDireccion(perfil.direccion ?? '');
    setTelefono(perfil.telefono ?? '');
    setEmailContacto(perfil.emailContacto ?? '');
    setColorPrimario(perfil.colorPrimario ?? '#C2185B');
  }, [CLAVE_ALMACEN, perfil]);

  useEffect(() => {
    if (!refBorradorRestaurado.current) {
      return;
    }

    localStorage.setItem(
      CLAVE_ALMACEN,
      JSON.stringify({ nombre, descripcion, direccion, telefono, emailContacto, colorPrimario }),
    );
  }, [CLAVE_ALMACEN, colorPrimario, descripcion, direccion, emailContacto, nombre, telefono]);

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarPerfilEstudio(estudioId, {
        nombre,
        descripcion,
        direccion,
        telefono,
        emailContacto,
        colorPrimario,
      }),
    onSuccess: () => {
      localStorage.removeItem(CLAVE_ALMACEN);
      void clienteConsulta.invalidateQueries({ queryKey: ['perfil-estudio', estudioId] });
      recargar();
      mostrarToast('Cambios guardados correctamente');
    },
    onError: () => mostrarToast('Error al guardar los cambios'),
  });

  if (isLoading || !perfil) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const definicionPlan = obtenerDefinicionPlan(perfil.plan);

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-4">
        <h3 className="text-lg font-black uppercase tracking-tight">Plan actual</h3>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            {definicionPlan.nombre}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-600">{definicionPlan.resumen}</p>
        </div>
      </section>

      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-6">
        <h3 className="text-lg font-black uppercase tracking-tight">Identidad visual</h3>

        <AreaLogo
          perfil={{ ...perfil, colorPrimario }}
          estudioId={estudioId}
          onSubida={() =>
            void clienteConsulta.invalidateQueries({ queryKey: ['perfil-estudio', estudioId] })
          }
        />

        <div>
          <label htmlFor="colorPrimario" className="block text-sm font-bold text-slate-700 mb-2">
            Color principal del salón
          </label>
          <div className="flex items-center gap-4">
            <input
              id="colorPrimario"
              type="color"
              value={colorPrimario}
              onChange={(e) => setColorPrimario(e.target.value)}
              className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
            />
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-black text-white transition-colors"
              style={{ backgroundColor: colorPrimario }}
            >
              Así se verá tu color en la app
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              '#F48FB1',
              '#CE93D8',
              '#80DEEA',
              '#A5D6A7',
              '#FFF176',
              '#FFCC80',
              '#EF9A9A',
              '#90CAF9',
              '#B2DFDB',
              '#E1BEE7',
            ].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Seleccionar color ${c}`}
                onClick={() => setColorPrimario(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: colorPrimario === c ? '#1e293b' : 'transparent',
                  outline: colorPrimario === c ? '2px solid #1e293b' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-5">
        <h3 className="text-lg font-black uppercase tracking-tight">Información del salón</h3>

        {(
          [
            { id: 'nombre', label: 'Nombre del salón', valor: nombre, set: setNombre },
            { id: 'direccion', label: 'Dirección', valor: direccion, set: setDireccion },
            { id: 'telefono', label: 'Teléfono de contacto', valor: telefono, set: setTelefono },
            {
              id: 'emailContacto',
              label: 'Email de contacto',
              valor: emailContacto,
              set: setEmailContacto,
            },
          ] as const
        ).map(({ id, label, valor, set }) => (
          <div key={id}>
            <label htmlFor={id} className="block text-sm font-bold text-slate-700 mb-1">
              {label}
            </label>
            <input
              id={id}
              type={id === 'emailContacto' ? 'email' : 'text'}
              value={valor}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        ))}

        <div>
          <label htmlFor="descripcion" className="block text-sm font-bold text-slate-700 mb-1">
            Descripción corta
            <span className="font-normal text-slate-400 ml-2">{descripcion.length}/200</span>
          </label>
          <textarea
            id="descripcion"
            value={descripcion}
            maxLength={200}
            rows={3}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
          />
        </div>

        <button
          type="button"
          onClick={() => mutacion.mutate()}
          disabled={mutacion.isPending}
          className="w-full py-3 rounded-2xl text-sm font-black text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ backgroundColor: colorPrimario }}
        >
          {mutacion.isPending && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Guardar cambios
        </button>
      </section>
    </div>
  );
}
