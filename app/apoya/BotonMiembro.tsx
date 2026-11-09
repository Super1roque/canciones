'use client';

import { trackMetaPixel } from '@/lib/metaPixel';

// El botón que lleva al pago de Hotmart. Avisa al Píxel de Meta (InitiateCheckout) para que los anuncios sepan
// cuántas personas llegaron a intentar la membresía; el pago en sí ocurre en Hotmart.
export default function BotonMiembro({ href, className }: { href: string; className: string }) {
  return (
    <a href={href} className={className} onClick={() => trackMetaPixel('InitiateCheckout', { value: 2.99, currency: 'USD', content_name: 'Membresía /apoya' })}>
      Hacerme miembro
    </a>
  );
}
