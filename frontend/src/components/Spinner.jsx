export default function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-8 text-gray-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden />
      Loading…
    </div>
  );
}
