export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 rounded-lg bg-ink-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-ink-800" />)}</div>
      <div className="h-72 rounded-xl bg-ink-800" />
    </div>
  );
}
