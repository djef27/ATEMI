export default function Loading() {
  return (
    <div className="min-h-[60vh] px-4 py-12 flex items-center justify-center" role="status" aria-live="polite">
      <div className="w-full max-w-2xl space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-primary-100 mx-auto" />
        <div className="space-y-3">
          <div className="h-4 rounded bg-primary-50" />
          <div className="h-4 w-5/6 rounded bg-primary-50 mx-auto" />
          <div className="h-32 rounded-2xl bg-primary-50" />
        </div>
        <div className="flex justify-center items-center gap-3 text-sm text-gray-500">
          <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-800 rounded-full animate-spin" />
          <span>Chargement…</span>
        </div>
      </div>
    </div>
  );
}
