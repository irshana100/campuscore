import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import ChatWidget from '../components/ChatWidget';

export default function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [demoPercentages, setDemoPercentages] = useState({});
  useEffect(() => {
    fetch('http://localhost:5000/api/dashboard', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Dashboard unavailable')))
      .then((payload) => {
        if (payload.profile?.name) localStorage.setItem('userName', payload.profile.name);
        const demoValues = [68, 72, 75, 82, 90, 94];
        setDemoPercentages(Object.fromEntries(
          (payload.attendance_overview || [])
            .filter((item) => item.kind === 'demo')
            .map((item) => [item.subject_id, demoValues[Math.floor(Math.random() * demoValues.length)]])
        ));
        setData(payload);
      })
      .catch(() => setData(null));
  }, []);
  const summary = data?.summary || {};
  const logout = () => { localStorage.clear(); window.location.assign('/login'); };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="teacher" />
      <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Teacher dashboard</div><h1 className="mt-2 text-3xl font-bold text-slate-950">Welcome, {data?.profile?.name || 'Faculty'}</h1><p className="mt-1 text-sm text-slate-500">{data?.profile?.designation || 'Faculty'} · Academic overview</p></div>
          <button onClick={logout} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Logout</button>
        </div>
        {!data ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading teacher dashboard...</div> : <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Assigned Subjects" value={summary.assigned_subjects || 0} accent="bg-blue-50 text-blue-700" />
            <StatCard title="Total Students" value={summary.students || 0} accent="bg-emerald-50 text-emerald-700" />
            <StatCard title="Today's Classes" value={summary.today_classes || 0} accent="bg-sky-50 text-sky-700" />
            <StatCard title="To Evaluate" value={summary.pending_evaluations || 0} accent="bg-amber-50 text-amber-700" />
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.8fr)]">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Today's timetable</h2></div><div className="divide-y divide-slate-100">{(data.today_timetable || []).length ? data.today_timetable.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><div className="font-semibold text-slate-900">{item.subject_code} · {item.subject}</div><div className="mt-1 text-xs text-slate-500">{item.day} · {item.class_name} · Room {item.room}</div></div><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Period {item.period}</span></div>) : <div className="p-6 text-sm text-slate-500">No classes are assigned in the timetable.</div>}</div></section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Quick actions</h2><div className="mt-4 grid grid-cols-2 gap-2">{[['Upload material','/teacher/study-materials'],['Student attendance','/teacher/attendance'],['Assignments','/teacher/assignments'],['Enter marks','/teacher/marks'],['Publish notice','/teacher/notices'],['Student messages','/teacher/messages'],['Mentoring','/teacher/mentoring'],['Student feedback','/teacher/feedback']].map(([label,path]) => <a key={path} href={path} className="rounded-lg border border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">{label}</a>)}</div></section>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Assigned subjects</h2><a href="/teacher/subjects" className="text-sm font-semibold text-blue-700">View all</a></div>{(data.subjects || []).map((subject) => <div key={subject.id} className="mb-2 rounded-lg bg-slate-50 px-4 py-3"><div className="font-semibold text-slate-900">{subject.code} · {subject.name}</div></div>)}</section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Study material status</h2><a href="/teacher/study-materials" className="text-sm font-semibold text-blue-700">Manage</a></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Total uploads</div><div className="mt-1 text-2xl font-bold text-slate-900">{summary.materials || 0}</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Drafts</div><div className="mt-1 text-2xl font-bold text-slate-900">{summary.draft_materials || 0}</div></div></div></section></div>
          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Attendance overview</h2><a href="/teacher/attendance" className="text-xs font-semibold text-blue-700">Open attendance</a></div><div className="mt-5 text-3xl font-bold text-slate-900">{summary.attendance_percentage || 0}%</div><div className="mt-2 text-sm text-slate-500">Present or late across your assigned classes</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(summary.attendance_percentage || 0, 100)}%` }} /></div>{data.attendance_overview?.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Subject-wise attendance</h3><div className="mt-2 max-h-56 space-y-3 overflow-y-auto pr-1"><div><div className="mb-1 text-[11px] font-semibold text-emerald-700">Actual database attendance</div>{data.attendance_overview.filter((item) => item.kind === 'actual').map((item) => <div key={item.subject_id} className="flex items-start justify-between gap-2 py-1.5"><div className="min-w-0"><div className="truncate text-xs font-medium text-slate-800">{item.subject_name}</div><div className="text-[10px] text-slate-500">{item.total ? `${item.present} present · ${item.absent} absent · ${item.total} total` : 'No attendance recorded'}</div></div><div className="shrink-0 text-right"><div className="text-xs font-bold text-slate-900">{item.percentage == null ? 'N/A' : `${Math.round(item.percentage)}%`}</div><div className="text-[10px] text-emerald-700">Actual</div></div></div>)}</div><div><div className="mb-1 text-[11px] font-semibold text-amber-700">Demo only · not saved or synced</div>{data.attendance_overview.filter((item) => item.kind === 'demo').map((item) => { const percentage = demoPercentages[item.subject_id] || 75; const status = percentage >= 85 ? 'Normal' : percentage >= 75 ? 'Warning' : 'At Risk'; const statusColor = percentage >= 85 ? 'text-emerald-700' : percentage >= 75 ? 'text-amber-700' : 'text-red-700'; return <div key={item.subject_id} className="flex items-center justify-between gap-2 py-1.5"><div className="truncate text-xs font-medium text-slate-800">{item.subject_name}</div><div className="shrink-0 text-right"><div className="text-xs font-bold text-slate-900">{percentage}%</div><div className={`text-[10px] font-semibold ${statusColor}`}>{status}</div></div></div>; })}</div></div></div>}</section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Upcoming examinations</h2><a href="/teacher/marks" className="text-xs font-semibold text-blue-700">Manage marks</a></div><div className="mt-3 divide-y divide-slate-100">{(data.upcoming_examinations || []).map((exam) => <div key={exam.id} className="py-3"><div className="font-semibold text-slate-800">{exam.name}</div><div className="mt-1 text-xs text-slate-500">{exam.subject} · {exam.date}</div></div>)}{!data.upcoming_examinations?.length && <p className="py-3 text-sm text-slate-500">No upcoming examinations.</p>}</div></section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Recent notifications</h2><a href="/teacher/notifications" className="text-xs font-semibold text-blue-700">View all</a></div><div className="mt-3 divide-y divide-slate-100">{(data.recent_notifications || []).map((item) => <div key={item.id} className="py-3 text-sm text-slate-700">{item.message}</div>)}{!data.recent_notifications?.length && <p className="py-3 text-sm text-slate-500">No recent notifications.</p>}</div></section>
          </div>
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900">Recent student messages</h2><a href="/teacher/messages" className="text-sm font-semibold text-blue-700">Open inbox</a></div><div className="divide-y divide-slate-100">{(data.recent_messages || []).map((item) => <a key={item.thread_id} href="/teacher/messages" className="block py-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-slate-800">{item.student_name} · {item.subject}</span><span className="text-xs text-slate-500">{item.updated_at ? new Date(item.updated_at).toLocaleString() : ''}</span></div><p className="mt-1 text-sm text-slate-600">{item.message}</p></a>)}{!data.recent_messages?.length && <p className="py-3 text-sm text-slate-500">No student messages yet.</p>}</div></section>
        </>}
      </main>
      <ChatWidget />
    </div>
  );
}
