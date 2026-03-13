import NodeCache from 'node-cache';

/** Caché en memoria para listados de salones públicos — TTL 5 minutos */
export const cacheSalonesPublicos = new NodeCache({ stdTTL: 300, checkperiod: 60 });
