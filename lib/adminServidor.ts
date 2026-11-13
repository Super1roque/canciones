import { createHmac, timingSafeEqual } from 'crypto';
import { getAuth } from '@/lib/firebaseService';

// Comprueba en el servidor que quien llama es el admin. El guardia de app/admin/layout.tsx solo oculta las páginas:
// las rutas de /api/admin que devuelven datos de personas tienen que verificar el token ellas mismas.
export async function esAdminPeticion(request: Request): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return false;
  try {
    const u = await getAuth().verifyIdToken(token);
    return u.email === 'super1roque@gmail.com' && u.email_verified === true;
  } catch {
    return false;
  }
}

// Para poner al inicio de cada función de /api/admin: devuelve la respuesta 401 si quien llama no es el admin.
export async function soloAdmin(request: Request): Promise<Response | null> {
  if (await esAdminPeticion(request)) return null;
  return Response.json({ error: 'No autorizado' }, { status: 401 });
}

// Marca del navegador del admin (cookie que pone /api/admin/marcar-navegador al abrir el panel): con ella,
// sus escuchas de canciones no cuentan como reproducciones ni como escucha del cliente. Es una firma que
// solo el servidor puede generar, para que nadie la copie y escuche sin que se cuente.
export const COOKIE_ADMIN = 'corridos_admin';
export function firmaAdmin(): string {
  return createHmac('sha256', process.env.FIREBASE_PRIVATE_KEY ?? '').update('navegador-admin').digest('hex');
}
export function esNavegadorAdmin(request: Request): boolean {
  const valor = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${COOKIE_ADMIN}=([0-9a-f]{64})`))?.[1];
  if (!valor || !process.env.FIREBASE_PRIVATE_KEY) return false;
  return timingSafeEqual(Buffer.from(valor), Buffer.from(firmaAdmin()));
}
