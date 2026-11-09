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
