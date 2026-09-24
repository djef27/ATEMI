'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="font-serif text-2xl font-bold text-[#1A1919] mb-3">
          Une erreur est survenue
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          {error.message || 'Quelque chose s\u2019est mal passé. Veuillez réessayer.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-lg bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
