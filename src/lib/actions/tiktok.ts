"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-server";
import { deleteTiktokAccount, markTiktokError, syncTiktokAccount, TiktokTokenExpired } from "@/lib/tiktok-sync";

export type TiktokActionState = { error?: string; success?: string } | null;

export async function syncTiktokAccountAction(id: string): Promise<TiktokActionState> {
  await requireAdmin();
  try {
    const { videos } = await syncTiktokAccount(id);
    revalidatePath("/contenido");
    revalidatePath("/contenido/cuentas");
    return { success: `Perfil y ${videos} videos actualizados.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falló la sincronización.";
    if (!(error instanceof TiktokTokenExpired)) await markTiktokError(id, message);
    revalidatePath("/contenido/cuentas");
    return { error: message };
  }
}

export async function disconnectTiktokAccount(id: string): Promise<TiktokActionState> {
  await requireAdmin();
  await deleteTiktokAccount(id);
  revalidatePath("/contenido");
  revalidatePath("/contenido/cuentas");
  return { success: "Cuenta desconectada." };
}
