export default function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
      <p className="font-medium text-gray-700">{title}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
