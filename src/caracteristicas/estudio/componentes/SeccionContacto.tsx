import { Mail, MessageCircle, Phone, Clock } from 'lucide-react';

const DATOS_CONTACTO = {
  email: 'soporte@beautytimepro.com',
  whatsapp: '+52 55 1234 5678',
  horario: 'Mon – Fri, 9:00 AM – 6:00 PM (CST)',
};

export function SeccionContacto() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black italic uppercase tracking-tighter">Contact Us</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-pink-100 p-3 text-pink-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Email
              </p>
              <a
                href={`mailto:${DATOS_CONTACTO.email}`}
                className="text-sm font-bold text-slate-900 hover:text-pink-600 transition-colors"
              >
                {DATOS_CONTACTO.email}
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            For billing, technical issues, or general inquiries. We usually respond within 24 hours.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-green-100 p-3 text-green-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                WhatsApp
              </p>
              <a
                href={`https://wa.me/${DATOS_CONTACTO.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-slate-900 hover:text-green-600 transition-colors"
              >
                {DATOS_CONTACTO.whatsapp}
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Need quick help? Chat with our support team on WhatsApp for faster responses.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Support Hours
              </p>
              <p className="text-sm font-bold text-slate-900">{DATOS_CONTACTO.horario}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Messages received outside business hours will be answered the next business day.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Urgent Issues
              </p>
              <p className="text-sm font-bold text-slate-900">Billing & Account</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            For urgent billing or account access problems, please email with the subject "URGENT"
            for priority handling.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">
          Frequently Asked Questions
        </h3>
        <ul className="space-y-3 text-sm text-slate-600">
          <li>
            <p className="font-bold text-slate-800">How do I change my subscription plan?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Contact our support team via email or WhatsApp and we'll process your plan change.
            </p>
          </li>
          <li>
            <p className="font-bold text-slate-800">Can I add more specialists?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Yes! Go to the "My Team" tab to manage your specialists and their schedules.
            </p>
          </li>
          <li>
            <p className="font-bold text-slate-800">How do I update my salon information?</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Visit the "My Salon" tab to update your logo, description, location, and business
              hours.
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}
