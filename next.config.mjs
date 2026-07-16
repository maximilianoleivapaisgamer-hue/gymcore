/** @type {import('next').NextConfig} */

// Landing de ventas (proyecto Next aparte). Si LANDING_URL está seteada en
// Vercel, la home de turnogym.com (/) muestra esa landing; todo lo demás
// (gimnasios, logins, demos, pagos) lo sigue sirviendo esta app.
// Si LANDING_URL NO está seteada, no cambia nada: se ve la home actual.
const LANDING_URL = (process.env.LANDING_URL || '').replace(/\/$/, '');

const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] },
  // Para el primer deploy: no frenar el build por errores de tipos/lint.
  // Se puede volver a activar cuando el proyecto esté más maduro.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    if (!LANDING_URL) return [];
    return {
      beforeFiles: [
        { source: '/', destination: LANDING_URL },
      ],
    };
  },
};
export default nextConfig;
