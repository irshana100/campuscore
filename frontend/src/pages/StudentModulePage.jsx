import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWidget from '../components/ChatWidget';

const moduleDetails = {
  enrollment: { title: 'Course Enrollment', eyebrow: 'Academic registration', description: 'Your enrolled Semester V CSE subjects and course details.' },
  'lesson-plan': { title: 'Lesson Plan', eyebrow: 'Academic learning plan', description: 'Subject-wise teaching plans and current learning progress.' },
  results: { title: 'Score / Examination Results', eyebrow: 'Academic performance', description: 'Internal assessment and examination results.' },
  mentoring: { title: 'Mentoring', eyebrow: 'Student guidance', description: 'Your mentor details and mentoring records.' },
  events: { title: 'Events', eyebrow: 'Campus calendar', description: 'Upcoming academic and co-curricular college events.' },
  feedback: { title: 'Feedback', eyebrow: 'Student feedback', description: 'Submit feedback and view your feedback history.' },
  notifications: { title: 'Notifications', eyebrow: 'Campus updates', description: 'Read academic alerts and unread notifications.' },
  profile: { title: 'My Profile', eyebrow: 'Student account', description: 'Personal, academic, and contact details.' },
  fees: { title: 'My Fee Details', eyebrow: 'Finance', description: 'Fee structure and current payment status.' },
  receipts: { title: 'My Receipts', eyebrow: 'Finance records', description: 'Available payment receipts.' },
};

export default function StudentModulePage({ module }) {
  const details = moduleDetails[module] || { title: module, eyebrow: 'CampusCore portal', description: 'Campus information.' };
  const [dashboard, setDashboard] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [studentFeedback, setStudentFeedback] = useState([]);
  const [mentoringSessions, setMentoringSessions] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ subject_id: '', category: 'Academic', content: '' });
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('http://localhost:5000/api/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setDashboard(data));
    fetch('http://localhost:5000/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : { notifications: [] })
      .then((data) => setNotifications(data.notifications || []));
    if (module === 'results') {
      setResultsLoading(true);
      fetch('http://localhost:5000/api/student/results', { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => response.ok ? response.json() : { results: [] })
        .then((data) => setResults(data.results || []))
        .finally(() => setResultsLoading(false));
    }
    if (module === 'feedback') {
      fetch('http://localhost:5000/api/student/feedback', { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => response.ok ? response.json() : { feedback: [] })
        .then((data) => setStudentFeedback(data.feedback || []));
    }
    if (module === 'mentoring') {
      fetch('http://localhost:5000/api/student/mentoring', { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => response.ok ? response.json() : { sessions: [] })
        .then((data) => setMentoringSessions(data.sessions || []));
    }
  }, [module]);

  const enrollmentSubjects = dashboard?.subjects || [];
  const profile = dashboard?.profile || {};

  const feedbackSubmit = async (event) => {
    event.preventDefault();
    setFeedbackMessage('');
    try {
      const response = await fetch('http://localhost:5000/api/student/feedback', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to submit feedback.');
      setFeedbackMessage(payload.message);
      setFeedbackForm({ ...feedbackForm, content: '' });
      const updated = await fetch('http://localhost:5000/api/student/feedback', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await updated.json();
      setStudentFeedback(data.feedback || []);
    } catch (requestError) {
      setFeedbackMessage(requestError.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <Sidebar role="student" />
      <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
        <div className="mb-6"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{details.eyebrow}</div><h1 className="mt-2 text-3xl font-bold text-slate-950">{details.title}</h1><p className="mt-1 text-sm text-slate-500">{details.description}</p>{profile.name && <p className="mt-2 text-xs font-medium text-slate-600">{profile.name} · USN {profile.usn || '—'} · Semester {profile.semester || '—'} · Section {profile.section || '—'}</p>}</div>

        {module === 'enrollment' && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{enrollmentSubjects.map((subject) => <article key={subject.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold text-blue-700">{subject.code}</div><h2 className="mt-2 font-bold text-slate-900">{subject.name}</h2><div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Enrolled · Semester {profile.semester || 5}</div></article>)}</div>}

        {module === 'profile' && <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-5 sm:grid-cols-2"><div><div className="text-xs text-slate-500">Student name</div><div className="mt-1 font-semibold text-slate-900">{profile.name || localStorage.getItem('userName') || 'Student'}</div></div><div><div className="text-xs text-slate-500">USN</div><div className="mt-1 font-semibold text-slate-900">{profile.usn || '—'}</div></div><div><div className="text-xs text-slate-500">Semester / Section</div><div className="mt-1 font-semibold text-slate-900">{profile.semester || 5} · {profile.section || '—'}</div></div><div><div className="text-xs text-slate-500">Programme</div><div className="mt-1 font-semibold text-slate-900">B.E. Computer Science & Engineering</div></div><div><div className="text-xs text-slate-500">Academic year</div><div className="mt-1 font-semibold text-slate-900">2026-27</div></div></div></div>}

        {module === 'notifications' && <div className="max-w-4xl space-y-3">{notifications.length ? notifications.map((item, index) => <article key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="font-semibold text-slate-900">{item.message}</div><div className="mt-1 text-xs uppercase text-slate-500">{item.type}</div></article>) : <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">No notifications available.</div>}</div>}

        {module === 'results' && (resultsLoading ? <div className="rounded-xl bg-white p-6 text-slate-500 shadow-sm">Loading published results…</div> : results.length ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Assessment</th><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Marks</th><th className="px-5 py-3">Date</th></tr></thead><tbody>{results.map((result) => <tr key={result.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold text-slate-900">{result.title}</td><td className="px-5 py-4">{result.subject}</td><td className="px-5 py-4">{result.type}</td><td className="px-5 py-4 font-semibold">{result.marks_obtained} / {result.max_marks}</td><td className="px-5 py-4">{result.due_date}</td></tr>)}</tbody></table></div> : <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">No results have been published yet.</div>)}

        {module === 'feedback' && <div className="max-w-3xl space-y-5">{feedbackMessage && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{feedbackMessage}</div>}<form onSubmit={feedbackSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><label className="text-sm font-semibold text-slate-700">Subject<select required value={feedbackForm.subject_id} onChange={(event) => setFeedbackForm({ ...feedbackForm, subject_id: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Select enrolled subject</option>{enrollmentSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.name}</option>)}</select></label><label className="mt-4 block text-sm font-semibold text-slate-700">Category<select value={feedbackForm.category} onChange={(event) => setFeedbackForm({ ...feedbackForm, category: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option>Academic</option><option>Faculty</option><option>Facilities</option><option>Other</option></select></label><label className="mt-4 block text-sm font-semibold text-slate-700">Feedback<textarea required rows={5} value={feedbackForm.content} onChange={(event) => setFeedbackForm({ ...feedbackForm, content: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Submit feedback</button></form><div className="space-y-3">{studentFeedback.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between gap-3"><h2 className="font-semibold text-slate-900">{item.subject} · {item.category}</h2><span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span></div><p className="mt-2 text-sm text-slate-600">{item.content}</p>{item.teacher_reply && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Teacher response</strong><p className="mt-1">{item.teacher_reply}</p></div>}</article>)}</div></div>}

        {module === 'mentoring' && <div className="max-w-3xl space-y-3">{mentoringSessions.map((session) => <article key={session.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-xs font-semibold text-blue-700">{session.subject}</div><h2 className="mt-1 font-bold text-slate-900">Session with {session.teacher}</h2><div className="mt-2 text-sm text-slate-600">{new Date(session.session_at).toLocaleString()}</div></article>)}{!mentoringSessions.length && <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">No mentoring sessions have been scheduled.</div>}</div>}

        {!['enrollment', 'profile', 'notifications', 'feedback', 'results', 'mentoring'].includes(module) && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs uppercase text-slate-500">Academic record</div><h2 className="mt-2 text-lg font-bold text-slate-900">No records published</h2><p className="mt-2 text-sm text-slate-500">Verified college records will appear here when they are added by the administration.</p></section>
        </div>}
      </main>
      <ChatWidget />
    </div>
  );
}
