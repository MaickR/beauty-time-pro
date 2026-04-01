import { procesarColaCorreos } from '../lib/colaEmails.js';

let intervaloColaEmails: NodeJS.Timeout | null = null;

export function iniciarJobColaEmails(): void {
  if (intervaloColaEmails) return;

  void procesarColaCorreos().catch((error) => {
    console.error('Error procesando cola de correos inicial:', error);
  });

  intervaloColaEmails = setInterval(() => {
    void procesarColaCorreos().catch((error) => {
      console.error('Error procesando cola de correos:', error);
    });
  }, 60 * 1000);
}