import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * El importador de contactos manda hasta 10.000 filas ya parseadas en una
     * server action. El techo por defecto es 1 MB y un CSV de ese tamaño lo
     * pasa: sin esto el import falla recién al confirmar, después de que el
     * usuario mapeó todo.
     */
    serverActions: { bodySizeLimit: "8mb" },
  },
  async redirects() {
    // La pestaña "Reels" pasó a llamarse "Videos" cuando entró TikTok.
    return [{ source: "/contenido/reels", destination: "/contenido/videos", permanent: true }];
  },
};

export default nextConfig;
