import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Runs only on the private area. Keeps the session fresh and turns away anyone who is not signed in.
// (This is the first gate. The database's Row Level Security is the one that actually protects the data.)
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPrivate = pathname.startsWith('/portal') || pathname.startsWith('/admin') || pathname.startsWith('/api/download') || pathname === '/auth/update-password';
  const toLogin = () => {
    const url = request.nextUrl.clone(); url.pathname = '/login'; url.search = '';
    if (isPrivate && !pathname.startsWith('/api')) url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return isPrivate ? toLogin() : NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && isPrivate) return toLogin();
  return response;
}

export const config = { matcher: ['/portal/:path*', '/admin/:path*', '/login', '/auth/:path*', '/api/download/:path*'] };
