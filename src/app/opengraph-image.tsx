import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Atémi — Mode, Chaussures & Perruques au Bénin';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#1A1919',
        }}
      >
        <div
          style={{
            fontSize: 132,
            fontStyle: 'italic',
            fontWeight: 700,
            color: '#C5A880',
            letterSpacing: -2,
            display: 'flex',
          }}
        >
          Atémi
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 42,
            color: '#F5F5F5',
            display: 'flex',
            textAlign: 'center',
          }}
        >
          Mode, Chaussures &amp; Perruques au Bénin
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 28,
            color: '#C5A880',
            display: 'flex',
          }}
        >
          Acompte à la commande · Solde à la livraison
        </div>
      </div>
    ),
    size,
  );
}