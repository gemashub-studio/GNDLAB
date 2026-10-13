import { NextResponse, type NextRequest } from 'next/server';

/**
 * Alamat khusus R&D Lab (DEC-070): domain yang diawali "gemas-rnd" (mis. gemas-rnd.vercel.app) langsung
 * membuka /lab. Domain utama tidak terpengaruh.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (host.startsWith('gemas-rnd') && req.nextUrl.pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/lab';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/'] };
