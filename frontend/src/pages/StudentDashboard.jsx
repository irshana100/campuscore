import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import ChatWidget from '../components/ChatWidget';
import { mockDashboard } from '../data/mockData';
import { academicCalendarNotices, noticeCategoryStyle } from '../data/academicCalendar';

function attendanceStatus(percentage) {
  if (percentage >= 85) return { label: 'Normal', badge: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', accent: 'bg-emerald-50 text-emerald-700' };
  if (percentage >= 75) return { label: 'Warning', badge: 'bg-amber-50 text-amber-800', bar: 'bg-amber-500', accent: 'bg-amber-50 text-amber-800' };
  return { label: 'At Risk', badge: 'bg-red-50 text-red-700', bar: 'bg-red-500', accent: 'bg-red-50 text-red-700' };
}

export default function StudentDashboard() {
  const [data, setData] = useState({ ...mockDashboard.student, attendance_summary: [], subjects: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('http://localhost:5000/api/dashboard', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch dashboard')))
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch(() => {
        setData({ ...mockDashboard.student, attendance_summary: [], subjects: [] });
        setLoading(false);
      });
  }, []);

  const recordedAttendance = (data.attendance_summary || []).filter((item) => item.total > 0);
  const enrolledSubjects = data.subjects?.length ? data.subjects : (data.attendance_summary || []);
  const recordedRows = enrolledSubjects.map((subject) => {
    const subjectId = subject.id ?? subject.subject_id;
    const record = recordedAttendance.find((item) => String(item.subject_id) === String(subjectId));
    const total = record?.total || 0;
    return {
      subject_id: subjectId,
      subject_name: subject.name || subject.subject_name,
      present: record?.present || 0,
      total,
      absent: Math.max(0, total - (record?.present || 0)),
    };
  });
  const hasRecordedAttendance = recordedRows.some((item) => item.total > 0);
  const attendanceRows = recordedRows;
  const totalAttended = attendanceRows.reduce((total, item) => total + Number(item.present || 0), 0);
  const totalClasses = attendanceRows.reduce((total, item) => total + Number(item.total || 0), 0);
  const overallAttendance = totalClasses ? (totalAttended / totalClasses) * 100 : 0;
  const attendance = totalClasses ? Math.round(overallAttendance) : 0;
  const overallStatus = totalClasses ? attendanceStatus(overallAttendance) : { label: 'No data', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', accent: 'bg-slate-100 text-slate-600' };
  const todayKey = new Date().toISOString().slice(0, 10);
  const notices = [
    ...academicCalendarNotices,
    ...(data.notices || []).map((notice) => ({
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
  const logout = () => { localStorage.clear(); window.location.assign('/login'); };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar role="student" />
      <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Student dashboard</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Welcome back, {data.profile?.name || 'Student'}</h1>
            <p className="mt-1 text-sm text-slate-500">USN {data.profile?.usn || '—'} · Semester {data.profile?.semester || 5} · Section {data.profile?.section || '—'} · Computer Science & Engineering</p>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Notifications" className="relative rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">Notifications<span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" /></button>
            <button onClick={logout} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">Logout</button>
          </div>
        </header>

        {loading ? <div className="rounded-xl bg-white p-8 text-slate-500 shadow-sm">Loading dashboard...</div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Overall Attendance" value={totalClasses ? `${attendance}%` : 'N/A'} accent={overallStatus.accent} />
              <StatCard title="Today's Classes" value={String(data.today_timetable?.length || 0).padStart(2, '0')} accent="bg-sky-50 text-sky-700" />
              <StatCard title="Pending Assignments" value={data.pending_assignments?.length || 0} accent="bg-amber-50 text-amber-700" />
              <StatCard title="New Notices" value={notices.length} accent="bg-violet-50 text-violet-700" />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]">
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div><h2 className="font-bold text-slate-900">Today's timetable</h2><p className="mt-1 text-xs text-slate-500">Semester V · Section A/B</p></div>
                  <a href="/student/timetable" className="text-sm font-semibold text-blue-700">View full timetable</a>
                </div>
                <div className="divide-y divide-slate-100">
                  {(data.today_timetable || []).slice(0, 4).map((entry, index) => (
                    <div key={index} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 px-5 py-4">
                      <div className="text-xs font-semibold text-blue-700">Period {entry.period}</div>
                      <div><div className="font-semibold text-slate-800">{entry.subject}</div><div className="mt-1 text-xs text-slate-500">Room {entry.room}</div></div>
                      <div className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{entry.day}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">Attendance overview</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${overallStatus.badge}`}>{overallStatus.label}</span></div>
                <div className="mt-4 flex items-baseline justify-between"><span className="text-3xl font-bold text-slate-950">{totalClasses ? `${attendance}%` : 'N/A'}</span><span className="text-xs text-slate-500">Minimum 75%</span></div>
                <div role="progressbar" aria-label="Overall attendance" aria-valuemin="0" aria-valuemax="100" aria-valuenow={totalClasses ? attendance : 0} className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${overallStatus.bar}`} style={{ width: `${totalClasses ? Math.min(overallAttendance, 100) : 0}%` }} /></div>
                <div className="mt-2 text-xs text-slate-500">{totalClasses ? `${totalAttended} classes attended of ${totalClasses} conducted` : 'Attendance data is not available yet for this student.'}</div>
                <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold text-slate-900">Subject-wise attendance</h3>{!hasRecordedAttendance && <p className="mt-1 text-[11px] text-slate-500">No attendance records are available yet.</p>}<div className="mt-3 space-y-4">{attendanceRows.map((subject) => { const percentage = subject.total ? (subject.present / subject.total) * 100 : 0; const roundedPercentage = subject.total ? Math.round(percentage) : 0; const status = subject.total ? attendanceStatus(percentage) : { label: 'No data', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', accent: 'bg-slate-100 text-slate-600' }; return <div key={subject.subject_id}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-800">{subject.subject_name}</div><div className="mt-1 text-[11px] text-slate-500">{subject.total ? `${subject.present} present · ${subject.absent} absent · ${subject.total} total` : 'Attendance not recorded yet'}</div></div><div className="shrink-0 text-right"><div className="text-sm font-bold text-slate-900">{subject.total ? `${roundedPercentage}%` : 'N/A'}</div><div className={`mt-1 text-[10px] font-semibold ${status.badge}`}>{status.label}</div></div></div><div role="progressbar" aria-label={`${subject.subject_name} attendance`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={subject.total ? roundedPercentage : 0} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${status.bar}`} style={{ width: `${subject.total ? Math.min(percentage, 100) : 0}%` }} /></div></div>; })}</div></div>
              </section>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Assignments</h2><a href="/student/assignments" className="text-sm font-semibold text-blue-700">View all</a></div>
                <div className="space-y-3">{(data.assignments || []).slice(0, 4).map((assignment) => (<div key={assignment.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"><div><div className="font-semibold text-slate-800">{assignment.title}</div><div className="mt-1 text-xs text-slate-500">Deadline · {assignment.due_date}</div></div><span className={`text-xs font-semibold ${assignment.submitted ? 'text-emerald-700' : 'text-amber-700'}`}>{assignment.status}</span></div>))}</div>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Academic calendar & notices</h2><a href="/student/notices" className="text-sm font-semibold text-blue-700">View all</a></div>
                <div className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto pr-1">{notices.map((notice, index) => <article key={notice.id || `${notice.sortDate}-${notice.title}-${index}`} className="py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="text-xs font-semibold text-blue-700">{notice.date}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${noticeCategoryStyle(notice.category)}`}>{notice.category}</span></div><div className="mt-1 text-sm font-semibold text-slate-900">{notice.title}</div>{notice.detail && <div className="mt-1 text-xs leading-5 text-slate-600">{notice.detail}</div>}</article>)}</div>
              </section>
            </div>
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Upcoming examinations</h2><a href="/student/results" className="text-sm font-semibold text-blue-700">Score & results</a></div>
              <div className="grid gap-3 md:grid-cols-2">{(data.upcoming_examinations || []).map((exam) => <article key={exam.id} className="rounded-lg border border-slate-100 px-4 py-3"><div className="font-semibold text-slate-900">{exam.name}</div><div className="mt-1 text-sm text-slate-600">{exam.subject} · {exam.date} · {exam.start_time} · Room {exam.room}</div></article>)}{!data.upcoming_examinations?.length && <p className="text-sm text-slate-500">No upcoming examinations have been scheduled for your subjects.</p>}</div>
            </section>
          </>
        )}
      </main>
      <ChatWidget />
    </div>
  );
}
