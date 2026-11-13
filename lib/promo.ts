// Promo temporal: mientras dure, nadie compra créditos — cada tenant arranca
// con SALDO_INICIAL y como premium, y el admin sigue sumando saldo a mano
// desde /admin/tenants. Para volver a vender créditos, VENTA_CREDITOS_ACTIVA
// en true (el saldo inicial de los nuevos se puede bajar a 0 al mismo tiempo).
export const VENTA_CREDITOS_ACTIVA = false;
export const SALDO_INICIAL = 300;
export const PLAN_INICIAL: 'freemium' | 'premium' = 'premium';

// Lo que se le dice al tenant cuando no le alcanza el saldo.
export const SIN_SALDO_PEDIR = VENTA_CREDITOS_ACTIVA
  ? 'Comprá créditos'
  : 'Escribinos por el chat de soporte para que te carguemos más saldo';

// Lo que cuesta habilitar la descarga de una canción (se cobra por WhatsApp).
export const PRECIO_DESCARGA = 250;
