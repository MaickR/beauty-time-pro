/**
 * Servicio de personal — delega en servicioEstudios.
 *
 * Fase 5: Re-exporta las operaciones de staff desde el servicio de estudios.
 * Fase 6: Reemplazar con llamadas HTTP al backend Fastify/MySQL.
 */
export { actualizarStaff as actualizarPersonal } from './servicioEstudios';
