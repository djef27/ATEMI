'use client';

export default function ProductsError({
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
          Erreur lors du chargement
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          Impossible de charger le catalogue. Vérifiez votre connexion et réessayez.
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
