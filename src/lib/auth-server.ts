import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

/**
 * Defensa en profundidad para server actions del panel interno: el middleware ya
 * bloquea la navegación, pero una action puede invocarse fuera de esa ruta.
 */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const ok = await isValidSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!ok) redirect("/login");
}
