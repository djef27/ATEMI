'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#FAFAF8',
          padding: '2rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1919', marginBottom: '0.75rem' }}>
              Une erreur est survenue
            </h1>
            <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {error?.message || "Quelque chose s'est mal passé. Veuillez réessayer."}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                backgroundColor: '#1A1919',
                color: '#fff',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
