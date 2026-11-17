export default function StatCard({ title, value, accent = 'bg-blue-50 text-blue-700' }) {
  return (
    <div className="card">
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>{title}</div>
      <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
