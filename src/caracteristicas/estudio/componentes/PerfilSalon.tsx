import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Link as IconoEnlace,
  MapPin,
  Phone,
  User,
  Mail,
  FileText,
  MessageCircle,
} from 'lucide-react';
import { obtenerPerfilEstudio } from '../../../servicios/servicioPerfil';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { construirEnlaceSoporteWhatsApp } from '../utils/soporteSalon';

interface PropsPerfilSalon {
  estudioId: string;
}

interface CampoInfo {
  icono: typeof Building2;
  etiqueta: string;
  valor: string | null | undefined;
}

export function PerfilSalon({ estudioId }: PropsPerfilSalon) {
  const [valorCopiado, setValorCopiado] = useState<'clave' | 'enlace' | null>(null);
  const { mostrarToast } = usarToast();
  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-estudio', estudioId],
    queryFn: () => obtenerPerfilEstudio(estudioId),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading || !perfil) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const campos: CampoInfo[] = [
    { icono: Building2, etiqueta: 'Nombre del salón', valor: perfil.nombre },
    { icono: MapPin, etiqueta: 'Dirección', valor: perfil.direccion },
    { icono: Phone, etiqueta: 'Teléfono', valor: perfil.telefono },
    { icono: User, etiqueta: 'Propietario', valor: perfil.propietario },
    { icono: Mail, etiqueta: 'Correo de la cuenta', valor: perfil.emailCuenta },
  ];
  const enlaceSoporteWhatsApp = construirEnlaceSoporteWhatsApp({
    pais: perfil.country,
    nombreSalon: perfil.nombre,
    nombreResponsable: perfil.propietario,
  });
  const enlaceReservas =
    typeof window === 'undefined' || !perfil.claveCliente
      ? null
      : `${window.location.origin}/reservar/${perfil.claveCliente}`;

  const copiarTexto = async (tipo: 'clave' | 'enlace', valor: string | null) => {
    if (!valor) {
      mostrarToast('No hay un valor disponible para copiar');
      return;
    }

    try {
      await navigator.clipboard.writeText(valor);
      setValorCopiado(tipo);
      window.setTimeout(() => setValorCopiado((actual) => (actual === tipo ? null : actual)), 1800);
      mostrarToast(tipo === 'clave' ? 'Clave del salón copiada' : 'Enlace de reservas copiado');
    } catch {
      mostrarToast('No se pudo copiar al portapapeles');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-5">
        <h3 className="text-lg font-black uppercase tracking-tight">Información del salón</h3>
        <div className="divide-y divide-slate-100">
          {campos.map(({ icono: Icono, etiqueta, valor }) => (
            <div key={etiqueta} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              <div className="bg-slate-100 p-2.5 rounded-xl">
                <Icono className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {etiqueta}
                </p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {valor || <span className="text-slate-300 italic">No registrado</span>}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-fuchsia-100 bg-fuchsia-50 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="bg-white p-2.5 rounded-xl border border-fuchsia-100">
              <KeyRound className="w-4 h-4 text-fuchsia-700" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-700">
                Clave única del salón
              </p>
              <p className="text-sm font-semibold text-slate-800">
                Esta clave es irrepetible y permite abrir el acceso público de reservas de tu salón.
              </p>
              <p className="text-sm text-slate-600">
                Cuando un cliente la ingresa en la pantalla de acceso o la recibe por QR, el sistema lo redirige a tu enlace de reservas.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Clave de acceso
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-2xl border border-fuchsia-100 bg-white px-4 py-3 text-sm font-bold text-slate-900">
                  {perfil.claveCliente ?? 'No disponible'}
                </code>
                <button
                  type="button"
                  onClick={() => void copiarTexto('clave', perfil.claveCliente)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-fuchsia-100 bg-white text-slate-600 transition hover:bg-fuchsia-100"
                  aria-label="Copiar clave del salón"
                >
                  {valorCopiado === 'clave' ? (
                    <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Enlace público de reservas
              </p>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-fuchsia-100 bg-white px-4 py-3 text-sm text-slate-700">
                  <IconoEnlace className="h-4 w-4 shrink-0 text-fuchsia-700" aria-hidden="true" />
                  <span className="truncate">{enlaceReservas ?? 'No disponible'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void copiarTexto('enlace', enlaceReservas)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-fuchsia-100 bg-white text-slate-600 transition hover:bg-fuchsia-100"
                  aria-label="Copiar enlace de reservas"
                >
                  {valorCopiado === 'enlace' ? (
                    <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-green-100 bg-green-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
                Soporte directo
              </p>
              <p className="text-sm font-semibold text-slate-800">
                Canal de WhatsApp para {perfil.country === 'Colombia' ? 'Colombia' : 'México'}
              </p>
              <p className="text-sm text-slate-600">
                Úsalo para temas de acceso, facturación o ajustes operativos del salón.
              </p>
            </div>

            <a
              href={enlaceSoporteWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-black text-white transition hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </section>
      <section className="bg-white rounded-4xl p-8 border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2.5 rounded-xl">
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight">Contrato de servicio</h3>
        </div>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-400">
            Tu contrato de servicio estará disponible aquí próximamente.
          </p>
        </div>
      </section>
    </div>
  );
}
