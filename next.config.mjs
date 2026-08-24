/** @type {import('next').NextConfig} */

// Landing de ventas. La home de turnogym.com (/) la muestra a ella; todo lo
// demás (gimnasios, logins, demos, pagos) lo sigue sirviendo esta app.
//
// Por defecto se sirve la que viaja con el proyecto en public/landing.html: un
// solo deploy, un solo lugar donde editarla y sin salto a otro dominio.
// Si algún día la landing se muda a un proyecto aparte, alcanza con setear
// LANDING_URL en Vercel y esa gana, sin tocar código.
const LANDING_URL = (process.env.LANDING_URL || '').replace(/\/$/, '');
const LANDING_DESTINO = LANDING_URL || '/landing.html';

const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] },
  // Para el primer deploy: no frenar el build por errores de tipos/lint.
  // Se puede volver a activar cuando el proyecto esté más maduro.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: LANDING_DESTINO },
      ],
    };
  },
};
export default nextConfig;
