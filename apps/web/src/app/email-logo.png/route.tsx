import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

/** Logo PNG untuk email OTP (DEC-090): tanda gemasSTUDIO + "GnD Lab" di latar gelap (336×88, tampil 168×44). */
export function GET() {
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="88" height="88"><circle cx="22" cy="23" r="16" fill="#63E6CF" stroke="#F3F6F7" stroke-width="2.5"/><path d="M14 18l5 5M19 18l-5 5M25 18l5 5M30 18l-5 5" stroke="#0E1A1F" stroke-width="2.6" stroke-linecap="round"/><path d="M15 30c4 3 10 3 14 0" stroke="#0E1A1F" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M22 7l2-5 2 5" stroke="#F5A524" stroke-width="2.6" stroke-linejoin="round" fill="none"/></svg>`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 16, background: '#0E1A1F', padding: '0 8px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(mark)}`} width={72} height={72} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#F3F6F7' }}>
            gemas<span style={{ color: '#63E6CF' }}>STUDIO</span>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#A9B8BE', marginTop: 6, letterSpacing: 2 }}>GnD LAB</div>
        </div>
      </div>
    ),
    { width: 336, height: 88 },
  );
}
