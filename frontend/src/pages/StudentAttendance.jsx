import { useEffect, useState } from 'react';
import ChatWidget from '../components/ChatWidget';
import Sidebar from '../components/Sidebar';

const attendanceView = (records, enrolledSubjects = []) => {
  const recorded = (records || []).filter((item) => item.total > 0);
  const subjects = (enrolledSubjects.length ? enrolledSubjects : recorded).map((subject) => {
    const subjectId = subject.id ?? subject.subject_id;
    const record = recorded.find((item) => String(item.subject_id) === String(subjectId));
    const total = record?.total || 0;
    return {
      subject_id: subjectId,
      subject_name: subject.name || subject.subject_name || 'Subject',
      present: record?.present || 0,
      total,
      absent: Math.max(0, total - (record?.present || 0)),
      percentage: total ? (record.present / total) * 100 : 0,
      unavailable: total === 0,
    };
  });
  const totalPresent = subjects.reduce((total, item) => total + Number(item.present || 0), 0);
  const totalClasses = subjects.reduce((total, item) => total + Number(item.total || 0), 0);
  const currentPercentage = totalClasses ? (totalPresent / totalClasses) * 100 : 0;
  const status = totalClasses ? (currentPercentage >= 85 ? 'Normal' : currentPercentage >= 75 ? 'Warning' : 'At Risk') : 'No data';

  return {
    subjects,
    projection: {
      current_percentage: totalClasses ? Number(currentPercentage.toFixed(1)) : 0,
      threshold: 75,
      warning: status,
      total_present: totalPresent,
      total_classes: totalClasses,
    },
  };
};

export default function StudentAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [attendanceProjection, setAttendanceProjection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('http://localhost:5000/api/dashboard', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Failed to load attendance')))
      .then((data) => {
        const view = attendanceView(data.attendance_summary, data.subjects || []);
        setSubjects(view.subjects);
        setAttendanceProjection(view.projection);
        setLoading(false);
      })
      .catch(() => {
        const view = attendanceView([], []);
        setSubjects(view.subjects);
        setAttendanceProjection(view.projection);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role="student" />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-6">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Student attendance</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Subject-wise attendance</h1>
          <p className="mt-2 text-sm text-slate-500">A detailed view of attendance for every subject.</p>
          {!subjects.some((item) => item.total > 0) && <p className="mt-2 text-sm text-slate-500">No attendance records are available yet.</p>}
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-6 text-slate-500 shadow-soft">Loading attendance...</div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-5 shadow-soft">
                <div className="text-sm text-slate-500">Overall average</div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{attendanceProjection?.total_classes ? `${Math.round(attendanceProjection.current_percentage || 0)}%` : 'N/A'}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${(attendanceProjection?.current_percentage || 0) >= 85 ? 'bg-emerald-500' : (attendanceProjection?.current_percentage || 0) >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${attendanceProjection?.total_classes ? Math.min(attendanceProjection.current_percentage || 0, 100) : 0}%` }} /></div>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-soft">
                <div className="text-sm text-slate-500">Required attendance</div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{attendanceProjection?.threshold || 75}%</div>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-soft">
                <div className="text-sm text-slate-500">Status</div>
                <div className={`mt-2 text-xl font-bold ${(attendanceProjection?.current_percentage || 0) >= 85 ? 'text-emerald-700' : (attendanceProjection?.current_percentage || 0) >= 75 ? 'text-amber-700' : 'text-red-700'}`}>{attendanceProjection?.warning || 'At Risk'}</div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {subjects.length ? subjects.map((subject) => {
                const percentage = subject.total ? (subject.percentage ?? (subject.present / subject.total) * 100) : 0;
                const status = subject.total ? (percentage >= 85 ? 'Normal' : percentage >= 75 ? 'Warning' : 'At Risk') : 'No data';
                return (
                  <section key={subject.subject_id} className="rounded-xl bg-white p-5 shadow-soft">
                    <div className="min-h-12 font-semibold text-slate-900">{subject.subject_name}</div>
                    <div className="mt-5 flex items-end justify-between">
                      <div className="text-3xl font-bold text-slate-900">{subject.total ? `${Math.round(percentage)}%` : 'N/A'}</div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${subject.total ? (percentage >= 85 ? 'bg-emerald-50 text-emerald-700' : percentage >= 75 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700') : 'bg-slate-100 text-slate-600'}`}>
                        {status}
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${subject.total ? (percentage >= 85 ? 'bg-emerald-500' : percentage >= 75 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-400'}`} style={{ width: `${subject.total ? Math.min(percentage, 100) : 0}%` }} />
                    </div>
                    <div className="mt-3 text-sm text-slate-500">{subject.total ? `${subject.present} present · ${subject.absent} absent · ${subject.total} total` : 'Attendance not recorded yet for this subject.'}</div>
                  </section>
                );
              }) : <div className="rounded-xl bg-white p-6 text-slate-500 shadow-soft lg:col-span-2 xl:col-span-3">No attendance records have been saved for your enrolled subjects yet.</div>}
            </div>
          </>
        )}
      </main>
      <ChatWidget />
    </div>
  );
}
