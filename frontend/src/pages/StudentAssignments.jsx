import { useEffect, useMemo, useState } from 'react';
import ChatWidget from '../components/ChatWidget';
import Sidebar from '../components/Sidebar';

const demoAssignments = [
  { id: 'demo-bcs501-pending', title: 'Requirements Traceability Exercise', subject: 'Software Engineering & Project Management', description: 'Map sample requirements to design decisions and verification steps.', due_date: '2026-11-15', submitted: false, status: 'Pending', demo: true },
  { id: 'demo-bcs501-submitted', title: 'Architecture Review Worksheet', subject: 'Software Engineering & Project Management', description: 'Review a sample architecture and identify its main components.', due_date: '2026-11-05', submitted: true, status: 'Submitted', demo: true },
  { id: 'demo-bcs502-pending', title: 'Network Protocol Comparison', subject: 'Computer Networks', description: 'Compare the responsibilities of the transport and network layers.', due_date: '2026-11-13', submitted: false, status: 'Pending', demo: true },
  { id: 'demo-bcs502-submitted', title: 'Subnetting Practice', subject: 'Computer Networks', description: 'Practice address ranges and subnet masks for a sample network.', due_date: '2026-11-04', submitted: true, status: 'Submitted', demo: true },
  { id: 'demo-bcs503-pending', title: 'Finite Automata Problem Set', subject: 'Theory of Computation', description: 'Construct finite automata for the supplied example languages.', due_date: '2026-11-18', submitted: false, status: 'Pending', demo: true },
  { id: 'demo-bcs503-submitted', title: 'Regular Expression Worksheet', subject: 'Theory of Computation', description: 'Convert the sample expressions into equivalent automata.', due_date: '2026-11-06', submitted: true, status: 'Submitted', demo: true },
];

const toDate = (value) => new Date(`${value}T23:59:59`);
const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(false);

  const loadAssignments = () => {
    const token = localStorage.getItem('token');
    fetch('http://localhost:5000/api/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Failed to load assignments')))
      .then((data) => {
        const records = data.assignments || [];
        setDemoMode(records.length === 0);
        setAssignments(records.length ? records : demoAssignments);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const submitAssignment = async (event, assignmentId) => {
    event.preventDefault();
    const file = files[assignmentId];
    if (!file) return setError('Choose a file before submitting.');
    setSubmitting(assignmentId);
    setError('');
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await fetch(`http://localhost:5000/api/student/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to submit assignment.');
      await loadAssignments();
      setFiles((current) => ({ ...current, [assignmentId]: null }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(null);
    }
  };

  const filteredAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === filter),
    [assignments, filter],
  );
  const pendingAssignments = assignments.filter((assignment) => !assignment.submitted);
  const pendingCount = pendingAssignments.length;
  const dueTodayCount = pendingAssignments.filter((assignment) => {
    const deadline = toDate(assignment.due_date);
    const today = startOfToday();
    return deadline.toDateString() === today.toDateString();
  }).length;

  const deadlineDetails = (assignment) => {
    const deadline = toDate(assignment.due_date);
    const today = startOfToday();
    const daysLeft = Math.ceil((deadline - today) / 86400000);

    if (assignment.submitted) {
      return { label: `Submitted · Due ${assignment.due_date}`, className: 'bg-emerald-50 text-emerald-700' };
    }
    if (daysLeft < 0) {
      return { label: `Overdue · Deadline ${assignment.due_date}`, className: 'bg-red-100 text-red-700 ring-1 ring-red-300' };
    }
    if (daysLeft <= 3) {
      return { label: `${daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`} · ${assignment.due_date}`, className: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' };
    }
    return { label: `Deadline ${assignment.due_date}`, className: 'bg-sky-50 text-sky-700' };
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role="student" />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Student assignments</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Assignments</h1>
            <p className="mt-2 text-sm text-slate-500">Submit pending work before the highlighted deadline.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {pendingCount} pending assignment{pendingCount === 1 ? '' : 's'}
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">
              {dueTodayCount} due today
            </div>
          </div>
        </div>

        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {demoMode && <div role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Showing sample assignments for Software Engineering, Computer Networks, and Theory of Computation. Demo entries are not saved or submittable.</div>}

        <div className="mb-5 inline-flex rounded-xl bg-white p-1 shadow-soft">
          {['Pending', 'Submitted'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${filter === tab ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-6 text-slate-500 shadow-soft">Loading assignments...</div>
        ) : filteredAssignments.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center shadow-soft">
            <div className="text-lg font-semibold text-slate-900">No {filter.toLowerCase()} assignments</div>
            <div className="mt-2 text-sm text-slate-500">Your assignment list is up to date.</div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredAssignments.map((assignment) => {
              const deadline = deadlineDetails(assignment);
              return (
                <article key={assignment.id} className={`rounded-xl border bg-white p-5 shadow-soft ${!assignment.submitted && deadline.className.includes('red') ? 'border-red-300' : 'border-slate-200'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{assignment.subject}</div>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">{assignment.title}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${assignment.submitted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      {assignment.demo ? `Demo · ${assignment.status}` : assignment.status}
                    </span>
                  </div>
                  {assignment.description && <p className="mt-3 text-sm leading-6 text-slate-600">{assignment.description}</p>}
                  <div className={`mt-5 rounded-lg px-4 py-3 text-sm font-semibold ${deadline.className}`}>
                    {deadline.label}
                  </div>
                  {!assignment.submitted && !assignment.demo && (
                    <form onSubmit={(event) => submitAssignment(event, assignment.id)} className="mt-4 flex flex-wrap items-center gap-3">
                      <input type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg" onChange={(event) => setFiles((current) => ({ ...current, [assignment.id]: event.target.files[0] || null }))} className="min-w-0 flex-1 text-xs text-slate-600" />
                      <button disabled={submitting === assignment.id} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                        {submitting === assignment.id ? 'Submitting…' : 'Submit assignment'}
                      </button>
                    </form>
                  )}
                  {assignment.marks_obtained != null && <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><strong>Mark: {assignment.marks_obtained}/{assignment.max_marks}</strong>{assignment.feedback && <p className="mt-1">{assignment.feedback}</p>}</div>}
                </article>
              );
            })}
          </div>
        )}
      </main>
      <ChatWidget />
    </div>
  );
}
