import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWidget from '../components/ChatWidget';
import { academicCalendarNotices, noticeCategoryStyle } from '../data/academicCalendar';

export default function StudentNotices() {
  const [databaseNotices, setDatabaseNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/api/student/notices', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load notices.');
        setDatabaseNotices(payload.notices || []);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const notices = [
    ...academicCalendarNotices,
    ...databaseNotices.map((notice) => ({
      id: `campus-${notice.id}`,
      date: notice.published_at ? new Date(notice.published_at).toLocaleDateString() : 'Date not recorded',
      sortDate: notice.published_at ? notice.published_at.slice(0, 10) : todayKey,
      title: notice.title,
      category: notice.type || 'Notice',
      detail: notice.content,
    })),
  ].sort((left, right) => {
    const leftUpcoming = left.sortDate >= todayKey;
    const rightUpcoming = right.sortDate >= todayKey;
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    return leftUpcoming ? left.sortDate.localeCompare(right.sortDate) : right.sortDate.localeCompare(left.sortDate);
  });

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role="student" />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-6">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Academic calendar</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Notices, holidays and reminders</h1>
          <p className="mt-2 text-sm text-slate-500">PA College of Engineering · 5th Semester · 2026–27</p>
        </div>
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {loading ? <div className="rounded-xl bg-white p-6 text-slate-500 shadow-soft">Loading notices…</div> : notices.length ? <div className="grid gap-4 xl:grid-cols-2">{notices.map((notice, index) => <article key={notice.id || `${notice.sortDate}-${notice.title}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div className="text-sm font-bold text-blue-700">{notice.date}</div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${noticeCategoryStyle(notice.category)}`}>{notice.category}</span></div><h2 className="mt-3 text-lg font-bold text-slate-900">{notice.title}</h2>{notice.detail && <p className="mt-2 text-sm leading-6 text-slate-600">{notice.detail}</p>}</article>)}</div> : <div className="rounded-xl bg-white p-10 text-center shadow-soft"><div className="font-semibold text-slate-900">No notices yet</div><div className="mt-2 text-sm text-slate-500">Notices for your courses will appear here.</div></div>}
      </main>
      <ChatWidget />
    </div>
  );
}
