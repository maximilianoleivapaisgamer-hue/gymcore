import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_APP, COOKIE_APP_DURACION, slugValido } from "@/lib/app-nativa";

/**
 * Refresca la sesión de Supabase en cada request y protege /dashboard.
 * (La autorización fina por rol se hace además con RLS en la base de datos.)
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Las apps de tienda abren en `/portal?app=<slug>`. Guardamos ese gimnasio en
  // una cookie para que la pantalla de acceso salga con SU marca ya pintada
  // desde el servidor, incluso cuando el socio cierra sesión y vuelve a entrar
  // sin que la URL traiga nada.
  //
  // Va acá y no en la página porque un componente de servidor no puede escribir
  // cookies mientras dibuja: si esperáramos al cliente, la primera pantalla
  // saldría genérica y recién después se pintaría. Ese parpadeo es justo lo que
  // hace que la app no se sienta del gimnasio.
  const app = request.nextUrl.searchParams.get("app");
  if (app && slugValido(app) && request.cookies.get(COOKIE_APP)?.value !== app) {
    response.cookies.set(COOKIE_APP, app, {
      maxAge: COOKIE_APP_DURACION,
      sameSite: "lax",
      httpOnly: true,
      // En producción siempre; en local no, porque el navegador descarta las
      // cookies `secure` sobre http y no se podría probar esto en la máquina.
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas del panel requieren sesión
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    return NextResponse.redirect(new URL("/acceso", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
