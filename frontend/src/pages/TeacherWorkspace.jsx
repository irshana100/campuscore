import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWidget from '../components/ChatWidget';

const API = 'http://localhost:5000/api';
const today = new Date().toISOString().slice(0, 10);
const titles = {
  profile: ['My Profile', 'Faculty account and employment details'],
  subjects: ['My Assigned Subjects', 'Subjects, sections, and enrolled students'],
  timetable: ['My Class Timetable', 'Manage your class timetable and examination schedules'],
  attendance: ['Student Attendance', 'Record attendance for an assigned class'],
  assignments: ['Assignments and Submissions', 'Publish assignments and evaluate student work'],
  marks: ['Marks and Examination Results', 'Create assessments and publish marks'],
  examinations: ['Examination Schedule', 'Schedule examinations for your assigned subjects'],
  notices: ['Notices and Announcements', 'Publish notices to students in an assigned subject'],
  mentoring: ['Mentoring', 'Students assigned to your mentoring group'],
  feedback: ['Student Feedback', 'Read student feedback and respond privately'],
  notifications: ['Notifications', 'Recent updates for your faculty account'],
  'question-papers': ['Previous Question Papers', 'Manage published examination resources'],
};

async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
  return payload;
}

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-slate-700';

export default function TeacherWorkspace({ section }) {
  const [dashboard, setDashboard] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceSchedule, setAttendanceSchedule] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [examinations, setExaminations] = useState([]);
  const [notices, setNotices] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [mentoring, setMentoring] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [attendancePeriod, setAttendancePeriod] = useState('1');
  const [marks, setMarks] = useState({});
  const [publishMarks, setPublishMarks] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({ subject_id: '', title: '', description: '', due_date: '', max_marks: 100 });
  const [assessmentForm, setAssessmentForm] = useState({ subject_id: '', title: '', type: 'Internal Assessment', due_date: '', max_marks: 100 });
  const [noticeForm, setNoticeForm] = useState({ subject_id: '', title: '', content: '', type: 'Announcement' });
  const [timetableForm, setTimetableForm] = useState({ subject_id: '', day: 'Monday', period: 1, room: '', class_name: '' });
  const [mentoringForm, setMentoringForm] = useState({ subject_id: '', student_id: '', session_at: '', notes: '' });
  const [profileForm, setProfileForm] = useState({ name: '', email: '', current_password: '', new_password: '' });
  const [examForm, setExamForm] = useState({ subject_id: '', name: '', exam_date: '', start_time: '', duration: '', room: '' });

  const loadList = async (path, setter, key) => {
    const payload = await api(path);
    setter(payload[key] || []);
  };

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    Promise.all([
      api('/dashboard'),
      api('/teacher/subjects'),
      api('/notifications'),
    ]).then(async ([summary, subjectPayload, notificationPayload]) => {
      if (!active) return;
      const assigned = subjectPayload.subjects || [];
      setDashboard(summary);
      setSubjects(assigned);
      setNotifications(notificationPayload.notifications || []);
      setProfileForm((current) => ({ ...current, name: summary.profile?.name || '', email: summary.profile?.email || '' }));
      setSelectedSubject((current) => current || String(assigned[0]?.id || ''));
      if (section === 'assignments') await loadList('/teacher/assignments', setAssignments, 'assignments');
      if (section === 'marks') await loadList('/teacher/assessments', setAssessments, 'assessments');
      if (section === 'examinations') await loadList('/teacher/examinations', setExaminations, 'examinations');
      if (section === 'notices') await loadList('/teacher/notices', setNotices, 'notices');
      if (section === 'timetable') {
        await Promise.all([
          loadList('/teacher/timetable', setTimetable, 'timetable'),
          loadList('/teacher/examinations', setExaminations, 'examinations'),
        ]);
      }
      if (section === 'mentoring') await loadList('/teacher/mentoring', setMentoring, 'mentoring');
      if (section === 'feedback') await loadList('/teacher/feedback', setFeedback, 'feedback');
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [section]);

  useEffect(() => {
    if (section !== 'attendance' || !selectedSubject) return;
    api(`/teacher/attendance?subject_id=${selectedSubject}&date=${attendanceDate}&period=${attendancePeriod}`)
      .then((payload) => { setAttendance(payload.students || []); setAttendanceSchedule(payload.schedule || []); })
      .catch((requestError) => setError(requestError.message));
  }, [section, selectedSubject, attendanceDate, attendancePeriod]);

  useEffect(() => {
    const assessment = assessments.find((item) => String(item.id) === String(selectedAssessment));
    if (!assessment) return;
    setMarks(Object.fromEntries(assessment.marks.map((item) => [item.student_id, String(item.marks_obtained)])));
    setPublishMarks(assessment.published);
  }, [assessments, selectedAssessment]);

  const [title, description] = titles[section] || ['Teacher Workspace', 'Faculty information'];
  const refreshAssignments = () => loadList('/teacher/assignments', setAssignments, 'assignments');
  const refreshAssessments = () => loadList('/teacher/assessments', setAssessments, 'assessments');
  const refreshExaminations = () => loadList('/teacher/examinations', setExaminations, 'examinations');
  const refreshNotices = () => loadList('/teacher/notices', setNotices, 'notices');
  const refreshTimetable = () => loadList('/teacher/timetable', setTimetable, 'timetable');
  const refreshMentoring = () => loadList('/teacher/mentoring', setMentoring, 'mentoring');
  const refreshFeedback = () => loadList('/teacher/feedback', setFeedback, 'feedback');

  const submitJson = async (event, path, body, afterSave) => {
    event.preventDefault();
    setNotice('');
    setError('');
    try {
      const result = await api(path, { method: 'POST', body: JSON.stringify(body) });
      setNotice(result.message || 'Saved successfully.');
      await afterSave?.(result);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const saveAttendance = async () => {
    const records = attendance.filter((item) => item.status).map((item) => ({ student_id: item.id, status: item.status }));
    if (!records.length) return setError('Choose an attendance status for at least one student.');
    try {
      const result = await api('/teacher/attendance', { method: 'PUT', body: JSON.stringify({ subject_id: Number(selectedSubject), date: attendanceDate, period: Number(attendancePeriod), records }) });
      setNotice(`${result.updated} attendance record${result.updated === 1 ? '' : 's'} saved.`);
      const updated = await api(`/teacher/attendance?subject_id=${selectedSubject}&date=${attendanceDate}&period=${attendancePeriod}`);
      setAttendance(updated.students || []);
      setAttendanceSchedule(updated.schedule || []);
    } catch (requestError) { setError(requestError.message); }
  };

  const saveAttendanceStatus = async (student, status) => {
    if (!status) return;
    setNotice('');
    setError('');
    try {
      await api('/teacher/attendance', {
        method: 'PUT',
        body: JSON.stringify({
          subject_id: Number(selectedSubject),
          date: attendanceDate,
          period: Number(attendancePeriod),
          records: [{ student_id: student.id, status }],
        }),
      });
      setNotice(`Attendance saved for ${student.roll_number}.`);
      const updated = await api(`/teacher/attendance?subject_id=${selectedSubject}&date=${attendanceDate}&period=${attendancePeriod}`);
      setAttendance(updated.students || []);
      setAttendanceSchedule(updated.schedule || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const saveMarks = async (event) => {
    event.preventDefault();
    const assessment = assessments.find((item) => String(item.id) === String(selectedAssessment));
    if (!assessment) return setError('Select an assessment first.');
    const records = Object.entries(marks).filter(([, value]) => value !== '').map(([student_id, marks_obtained]) => ({ student_id: Number(student_id), marks_obtained: Number(marks_obtained) }));
    try {
      const result = await api(`/teacher/assessments/${assessment.id}/marks`, { method: 'PUT', body: JSON.stringify({ records, published: publishMarks }) });
      setNotice(result.message + (result.published ? ' Results are visible to students.' : ''));
      await refreshAssessments();
    } catch (requestError) { setError(requestError.message); }
  };

  const saveTimetable = async (event) => {
    event.preventDefault();
    try {
      const path = editingTimetable ? `/teacher/timetable/${editingTimetable}` : '/teacher/timetable';
      const result = await api(path, { method: editingTimetable ? 'PATCH' : 'POST', body: JSON.stringify(timetableForm) });
      setNotice(result.message);
      setEditingTimetable(null);
      setTimetableForm({ subject_id: '', day: 'Monday', period: 1, room: '', class_name: '' });
      await refreshTimetable();
    } catch (requestError) { setError(requestError.message); }
  };

  const removeTimetableEntry = async (entryId) => {
    try {
      const result = await api(`/teacher/timetable/${entryId}`, { method: 'DELETE' });
      setNotice(result.message);
      await refreshTimetable();
    } catch (requestError) { setError(requestError.message); }
  };

  const evaluateSubmission = async (event, submissionId) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api(`/teacher/submissions/${submissionId}/evaluate`, { method: 'POST', body: JSON.stringify({ marks_obtained: form.get('marks_obtained'), feedback: form.get('feedback') }) });
      setNotice(result.message);
      await refreshAssignments();
    } catch (requestError) { setError(requestError.message); }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/teacher/profile', { method: 'PATCH', body: JSON.stringify(profileForm) });
      setNotice(result.message);
      setProfileForm((current) => ({ ...current, current_password: '', new_password: '' }));
      localStorage.setItem('userName', result.profile.name);
    } catch (requestError) { setError(requestError.message); }
  };

  const replyToFeedback = async (event, feedbackId) => {
    event.preventDefault();
    const reply = new FormData(event.currentTarget).get('reply');
    try {
      const result = await api(`/teacher/feedback/${feedbackId}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) });
      setNotice(result.message);
      await refreshFeedback();
    } catch (requestError) { setError(requestError.message); }
  };

  const downloadSubmission = async (url, filename) => {
    try {
      const response = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!response.ok) throw new Error('Unable to download submission.');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) { setError(requestError.message); }
  };

  const assignedStudents = subjects.find((item) => String(item.id) === String(selectedSubject))?.students || [];
  const input = (value, onChange, props = {}) => <input {...props} value={value} onChange={onChange} className={fieldClass} />;
  const selectSubject = (value, onChange) => <select required value={value} onChange={onChange} className={fieldClass}><option value="">Select assigned subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="teacher" />
      <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
        <header className="mb-6"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Faculty portal</div><h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></header>
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        {busy ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">Loading workspace…</div> : <>
          {section === 'profile' && <section className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6"><div className="mb-5"><h2 className="text-lg font-bold text-slate-900">Faculty account</h2><p className="mt-1 text-sm text-slate-500">Employee ID {dashboard?.profile?.employee_id || '—'} · {dashboard?.profile?.designation || 'Faculty'}</p></div><form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Name{input(profileForm.name, (event) => setProfileForm({ ...profileForm, name: event.target.value }), { required: true })}</label><label className={labelClass}>Email{input(profileForm.email, (event) => setProfileForm({ ...profileForm, email: event.target.value }), { type: 'email', required: true })}</label><label className={labelClass}>Current password{input(profileForm.current_password, (event) => setProfileForm({ ...profileForm, current_password: event.target.value }), { type: 'password', autoComplete: 'current-password' })}</label><label className={labelClass}>New password{input(profileForm.new_password, (event) => setProfileForm({ ...profileForm, new_password: event.target.value }), { type: 'password', minLength: 8, autoComplete: 'new-password' })}</label><button className="w-fit rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Save profile</button></form></section>}

          {section === 'subjects' && <div className="space-y-4">{subjects.map((subject) => <section key={subject.id} className="rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><div className="text-xs font-semibold text-blue-700">{subject.code}</div><h2 className="mt-1 text-lg font-bold text-slate-900">{subject.name}</h2><div className="mt-1 text-xs text-slate-500">{subject.section ? `Section ${subject.section}` : 'All assigned sections'} · {subject.student_count} enrolled</div></div><a href="/teacher/study-materials" className="text-sm font-semibold text-blue-700">Course materials</a></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Student ID</th><th className="px-5 py-3">Section</th></tr></thead><tbody>{subject.students.map((student) => <tr key={student.id} className="border-t border-slate-100"><td className="px-5 py-3 font-medium text-slate-800">{student.name}</td><td className="px-5 py-3">{student.roll_number}</td><td className="px-5 py-3">{student.section || '—'}</td></tr>)}</tbody></table></div></section>)}{!subjects.length && <div className="rounded-xl bg-white p-8 text-slate-500">No subjects are assigned to this teacher account.</div>}</div>}

          {section === 'attendance' && <section className="rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap gap-3 border-b border-slate-100 p-4"><label className={`${labelClass} min-w-56`}>Subject{selectSubject(selectedSubject, (event) => setSelectedSubject(event.target.value))}</label><label className={labelClass}>Class date{input(attendanceDate, (event) => setAttendanceDate(event.target.value), { type: 'date' })}</label><label className={labelClass}>Period{input(attendancePeriod, (event) => setAttendancePeriod(event.target.value), { type: 'number', min: 1, max: 7 })}</label></div><div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm">{attendanceSchedule.length ? <><span className="font-semibold text-slate-800">Scheduled: </span>{attendanceSchedule.map((item) => `${item.section} · Period ${item.period} · ${item.label}`).join(' | ')}</> : <span className="text-slate-500">No class is scheduled for this section at the selected period. Attendance remains unrecorded until an actual class is verified.</span>}</div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">USN</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Status for date</th></tr></thead><tbody>{attendance.map((student) => <tr key={student.id} className="border-t"><td className="px-4 py-3 font-medium">{student.name}</td><td className="px-4 py-3">{student.roll_number}</td><td className="px-4 py-3">{student.percentage}% ({student.present}/{student.total})</td><td className="px-4 py-3"><select aria-label={`Attendance status for ${student.name}`} value={student.status} onChange={(event) => { const status = event.target.value; setAttendance((rows) => rows.map((row) => row.id === student.id ? { ...row, status } : row)); saveAttendanceStatus(student, status); }} className="rounded-md border border-slate-300 px-2 py-1.5"><option value="">Not recorded</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option></select></td></tr>)}</tbody></table></div><div className="flex justify-end border-t p-4"><button onClick={saveAttendance} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Save attendance</button></div></section>}

          {section === 'assignments' && <div className="space-y-5"><form onSubmit={(event) => submitJson(event, '/teacher/assignments', assignmentForm, async () => { setAssignmentForm({ subject_id: '', title: '', description: '', due_date: '', max_marks: 100 }); await refreshAssignments(); })} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Publish an assignment</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><label className={labelClass}>Subject{selectSubject(assignmentForm.subject_id, (event) => setAssignmentForm({ ...assignmentForm, subject_id: event.target.value }))}</label><label className={labelClass}>Title{input(assignmentForm.title, (event) => setAssignmentForm({ ...assignmentForm, title: event.target.value }), { required: true, maxLength: 150 })}</label><label className={labelClass}>Deadline{input(assignmentForm.due_date, (event) => setAssignmentForm({ ...assignmentForm, due_date: event.target.value }), { type: 'date', required: true })}</label><label className={labelClass}>Maximum marks{input(assignmentForm.max_marks, (event) => setAssignmentForm({ ...assignmentForm, max_marks: event.target.value }), { type: 'number', min: 1, step: '0.5', required: true })}</label><label className={`${labelClass} md:col-span-2`}>Description<textarea value={assignmentForm.description} onChange={(event) => setAssignmentForm({ ...assignmentForm, description: event.target.value })} rows="3" className={fieldClass} /></label></div><button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Publish assignment</button></form>{assignments.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white"><div className="border-b px-5 py-4"><div className="text-xs font-semibold text-blue-700">{item.subject} · Due {item.due_date}</div><h2 className="mt-1 font-bold text-slate-900">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.description}</p></div><div className="divide-y divide-slate-100">{item.submissions.map((submission) => <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><div className="font-semibold text-slate-800">{submission.student_name} · {submission.roll_number}</div><div className="mt-1 text-xs text-slate-500">{submission.status}{submission.marks_obtained != null ? ` · ${submission.marks_obtained}/${item.max_marks}` : ''}{submission.submitted_at ? ` · ${new Date(submission.submitted_at).toLocaleString()}` : ''}</div>{submission.feedback && <p className="mt-1 text-sm text-slate-600">{submission.feedback}</p>}</div><div className="flex flex-wrap items-center gap-2">{submission.download_url && <button onClick={() => downloadSubmission(submission.download_url, `${submission.roll_number}-submission`)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Download</button>}<form onSubmit={(event) => evaluateSubmission(event, submission.id)} className="flex flex-wrap items-center gap-2"><input name="marks_obtained" type="number" min="0" max={item.max_marks} step="0.5" required defaultValue={submission.marks_obtained ?? ''} aria-label={`Marks for ${submission.student_name}`} className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm" /><input name="feedback" defaultValue={submission.feedback || ''} aria-label={`Feedback for ${submission.student_name}`} placeholder="Feedback" className="w-40 rounded-md border border-slate-300 px-2 py-2 text-sm" /><button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Save grade</button></form></div></div>)}{!item.submissions.length && <p className="px-5 py-4 text-sm text-slate-500">No submissions yet.</p>}</div></article>)}{!assignments.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No assignments have been published.</p>}</div>}

          {section === 'marks' && <div className="space-y-5"><form onSubmit={(event) => submitJson(event, '/teacher/assessments', assessmentForm, async () => { setAssessmentForm({ subject_id: '', title: '', type: 'Internal Assessment', due_date: '', max_marks: 100 }); await refreshAssessments(); })} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Create assessment</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><label className={labelClass}>Subject{selectSubject(assessmentForm.subject_id, (event) => setAssessmentForm({ ...assessmentForm, subject_id: event.target.value }))}</label><label className={labelClass}>Assessment title{input(assessmentForm.title, (event) => setAssessmentForm({ ...assessmentForm, title: event.target.value }), { required: true })}</label><label className={labelClass}>Type<select value={assessmentForm.type} onChange={(event) => setAssessmentForm({ ...assessmentForm, type: event.target.value })} className={fieldClass}><option>Internal Assessment</option><option>Assignment</option><option>Practical</option><option>Examination</option></select></label><label className={labelClass}>Maximum marks{input(assessmentForm.max_marks, (event) => setAssessmentForm({ ...assessmentForm, max_marks: event.target.value }), { type: 'number', min: 1, step: '0.5', required: true })}</label><label className={labelClass}>Date{input(assessmentForm.due_date, (event) => setAssessmentForm({ ...assessmentForm, due_date: event.target.value }), { type: 'date', required: true })}</label></div><button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Create assessment</button></form><section className="rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-end gap-3 border-b p-4"><label className={`${labelClass} min-w-64`}>Assessment<select value={selectedAssessment} onChange={(event) => setSelectedAssessment(event.target.value)} className={fieldClass}><option value="">Select assessment</option>{assessments.map((item) => <option key={item.id} value={item.id}>{item.subject} · {item.title}</option>)}</select></label>{selectedAssessment && <label className="flex items-center gap-2 pb-2 text-sm text-slate-700"><input type="checkbox" checked={publishMarks} onChange={(event) => setPublishMarks(event.target.checked)} />Publish marks to students</label>}</div>{selectedAssessment && <form onSubmit={saveMarks}><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Marks</th></tr></thead><tbody>{(subjects.find((item) => item.id === assessments.find((row) => String(row.id) === String(selectedAssessment))?.subject_id)?.students || []).map((student) => <tr key={student.id} className="border-t"><td className="px-4 py-3">{student.name}</td><td className="px-4 py-3">{student.roll_number}</td><td className="px-4 py-3"><input aria-label={`Marks for ${student.name}`} type="number" min="0" max={assessments.find((row) => String(row.id) === String(selectedAssessment))?.max_marks} step="0.5" value={marks[student.id] ?? ''} onChange={(event) => setMarks((current) => ({ ...current, [student.id]: event.target.value }))} className="w-32 rounded-md border border-slate-300 px-2 py-1.5" /></td></tr>)}</tbody></table></div><div className="flex justify-end border-t p-4"><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Save marks</button></div></form>}{!selectedAssessment && <div className="p-6 text-sm text-slate-500">Select an assessment to enter student marks.</div>}</section>{assessments.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"><span>{item.subject} · {item.title} · {item.max_marks} marks</span><span className={item.published ? 'font-semibold text-emerald-700' : 'text-slate-500'}>{item.published ? 'Published' : 'Draft'}</span></div>)}</div>}

          {section === 'examinations' && <div className="space-y-5"><form onSubmit={(event) => submitJson(event, '/teacher/examinations', examForm, async () => { setExamForm({ subject_id: '', name: '', exam_date: '', start_time: '', duration: '', room: '' }); await refreshExaminations(); })} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Schedule an examination</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><label className={labelClass}>Subject{selectSubject(examForm.subject_id, (event) => setExamForm({ ...examForm, subject_id: event.target.value }))}</label><label className={labelClass}>Examination name{input(examForm.name, (event) => setExamForm({ ...examForm, name: event.target.value }), { required: true })}</label><label className={labelClass}>Date{input(examForm.exam_date, (event) => setExamForm({ ...examForm, exam_date: event.target.value }), { type: 'date', required: true })}</label><label className={labelClass}>Start time{input(examForm.start_time, (event) => setExamForm({ ...examForm, start_time: event.target.value }), { type: 'time', required: true })}</label><label className={labelClass}>Duration{input(examForm.duration, (event) => setExamForm({ ...examForm, duration: event.target.value }), { required: true, placeholder: 'For example, 2 hours' })}</label><label className={labelClass}>Room{input(examForm.room, (event) => setExamForm({ ...examForm, room: event.target.value }), { required: true })}</label></div><button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Publish examination schedule</button></form><div className="space-y-3">{examinations.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold text-slate-900">{item.name}</h2><span className="text-xs text-slate-500">{item.subject}</span></div><div className="mt-2 text-sm text-slate-600">{item.exam_date} · {item.start_time} · {item.duration} · Room {item.room}</div></article>)}{!examinations.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No examinations scheduled for your subjects.</p>}</div></div>}

          {section === 'notices' && <div className="space-y-5"><form onSubmit={(event) => submitJson(event, '/teacher/notices', noticeForm, async () => { setNoticeForm({ subject_id: '', title: '', content: '', type: 'Announcement' }); await refreshNotices(); })} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Publish a class notice</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className={labelClass}>Subject{selectSubject(noticeForm.subject_id, (event) => setNoticeForm({ ...noticeForm, subject_id: event.target.value }))}</label><label className={labelClass}>Notice type<select value={noticeForm.type} onChange={(event) => setNoticeForm({ ...noticeForm, type: event.target.value })} className={fieldClass}><option>Announcement</option><option>Important</option><option>Deadline</option><option>Exam</option></select></label><label className={`${labelClass} md:col-span-2`}>Title{input(noticeForm.title, (event) => setNoticeForm({ ...noticeForm, title: event.target.value }), { required: true, maxLength: 200 })}</label><label className={`${labelClass} md:col-span-2`}>Description<textarea required rows="4" value={noticeForm.content} onChange={(event) => setNoticeForm({ ...noticeForm, content: event.target.value })} className={fieldClass} /></label></div><button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Publish notice</button></form><div className="space-y-3">{notices.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold text-slate-900">{item.title}</h2><span className="text-xs text-slate-500">{item.subject} · {new Date(item.published_at).toLocaleDateString()}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.content}</p></article>)}{!notices.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No notices have been published.</p>}</div></div>}

          {section === 'timetable' && <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold text-slate-900">Class timetable</h2>
              <form onSubmit={saveTimetable} className="mt-4">
                <h3 className="font-semibold text-slate-800">{editingTimetable ? 'Edit timetable entry' : 'Add timetable entry'}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className={labelClass}>Subject{selectSubject(timetableForm.subject_id, (event) => setTimetableForm({ ...timetableForm, subject_id: event.target.value }))}</label>
                  <label className={labelClass}>Day<select value={timetableForm.day} onChange={(event) => setTimetableForm({ ...timetableForm, day: event.target.value })} className={fieldClass}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => <option key={day}>{day}</option>)}</select></label>
                  <label className={labelClass}>Period{input(timetableForm.period, (event) => setTimetableForm({ ...timetableForm, period: event.target.value }), { type: 'number', min: 1, max: 12, required: true })}</label>
                  <label className={labelClass}>Classroom{input(timetableForm.room, (event) => setTimetableForm({ ...timetableForm, room: event.target.value }), { required: true })}</label>
                  <label className={labelClass}>Class / section{input(timetableForm.class_name, (event) => setTimetableForm({ ...timetableForm, class_name: event.target.value }), { required: true, placeholder: 'For example, CSE-A' })}</label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{editingTimetable ? 'Save changes' : 'Add class'}</button>
                  {editingTimetable && <button type="button" onClick={() => { setEditingTimetable(null); setTimetableForm({ subject_id: '', day: 'Monday', period: 1, room: '', class_name: '' }); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>}
                </div>
              </form>
            </section>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Day</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Room</th><th className="px-4 py-3">Actions</th></tr></thead>
                <tbody>{timetable.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3">{item.day}</td><td className="px-4 py-3">{item.period}</td><td className="px-4 py-3">{item.subject}</td><td className="px-4 py-3">{item.class_name}</td><td className="px-4 py-3">{item.room}</td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => { setEditingTimetable(item.id); setTimetableForm({ subject_id: String(item.subject_id), day: item.day, period: item.period, room: item.room, class_name: item.class_name }); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold">Edit</button><button onClick={() => removeTimetableEntry(item.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">Remove</button></div></td></tr>)}</tbody>
              </table>
              {!timetable.length && <p className="p-5 text-sm text-slate-500">No timetable entries yet.</p>}
            </div>
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4"><h2 className="font-bold text-slate-900">Examination schedules</h2><p className="mt-1 text-sm text-slate-500">Publish exam dates and room details for your assigned subjects.</p></div>
              <form onSubmit={(event) => submitJson(event, '/teacher/examinations', examForm, async () => { setExamForm({ subject_id: '', name: '', exam_date: '', start_time: '', duration: '', room: '' }); await refreshExaminations(); })}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className={labelClass}>Subject{selectSubject(examForm.subject_id, (event) => setExamForm({ ...examForm, subject_id: event.target.value }))}</label>
                  <label className={labelClass}>Examination name{input(examForm.name, (event) => setExamForm({ ...examForm, name: event.target.value }), { required: true })}</label>
                  <label className={labelClass}>Date{input(examForm.exam_date, (event) => setExamForm({ ...examForm, exam_date: event.target.value }), { type: 'date', required: true })}</label>
                  <label className={labelClass}>Start time{input(examForm.start_time, (event) => setExamForm({ ...examForm, start_time: event.target.value }), { type: 'time', required: true })}</label>
                  <label className={labelClass}>Duration{input(examForm.duration, (event) => setExamForm({ ...examForm, duration: event.target.value }), { required: true, placeholder: 'For example, 2 hours' })}</label>
                  <label className={labelClass}>Room{input(examForm.room, (event) => setExamForm({ ...examForm, room: event.target.value }), { required: true })}</label>
                </div>
                <button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Publish examination schedule</button>
              </form>
              <div className="mt-5 space-y-3">{examinations.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-slate-900">{item.name}</h3><span className="text-xs text-slate-500">{item.subject}</span></div><div className="mt-2 text-sm text-slate-600">{item.exam_date} · {item.start_time} · {item.duration} · Room {item.room}</div></article>)}{!examinations.length && <p className="text-sm text-slate-500">No examinations scheduled for your subjects.</p>}</div>
            </section>
          </div>}

          {section === 'notifications' && <div className="max-w-4xl space-y-3">{notifications.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="font-semibold text-slate-900">{item.message}</div><div className="mt-1 text-xs capitalize text-slate-500">{item.type}</div></article>)}{!notifications.length && <div className="rounded-xl bg-white p-8 text-center text-slate-500">No notifications available.</div>}</div>}
          {section === 'mentoring' && <div className="space-y-5"><form onSubmit={(event) => submitJson(event, '/teacher/mentoring', mentoringForm, async () => { setMentoringForm({ subject_id: '', student_id: '', session_at: '', notes: '' }); await refreshMentoring(); })} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Add mentoring note or session</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className={labelClass}>Assigned subject{selectSubject(mentoringForm.subject_id, (event) => setMentoringForm({ ...mentoringForm, subject_id: event.target.value, student_id: '' }))}</label><label className={labelClass}>Student<select required value={mentoringForm.student_id} onChange={(event) => setMentoringForm({ ...mentoringForm, student_id: event.target.value })} className={fieldClass}><option value="">Select student</option>{(subjects.find((item) => String(item.id) === String(mentoringForm.subject_id))?.students || []).map((student) => <option key={student.id} value={student.id}>{student.name} · {student.roll_number}</option>)}</select></label><label className={labelClass}>Session time{input(mentoringForm.session_at, (event) => setMentoringForm({ ...mentoringForm, session_at: event.target.value }), { type: 'datetime-local' })}</label><label className={`${labelClass} md:col-span-2`}>Private mentoring note<textarea value={mentoringForm.notes} onChange={(event) => setMentoringForm({ ...mentoringForm, notes: event.target.value })} rows="3" className={fieldClass} /></label></div><button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Save mentoring record</button></form><div className="space-y-3">{mentoring.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div className="font-bold text-slate-900">{item.student_name} · {item.roll_number}</div><div className="text-xs text-slate-500">{item.subject}</div></div>{item.session_at && <div className="mt-2 text-sm text-blue-700">Session · {new Date(item.session_at).toLocaleString()}</div>}{item.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.notes}</p>}</article>)}{!mentoring.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No mentoring notes or sessions yet.</p>}</div></div>}
          {section === 'feedback' && <div className="space-y-3">{feedback.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div className="font-bold text-slate-900">{item.student_name} · {item.roll_number}</div><div className="text-xs text-slate-500">{item.subject} · {item.category} · {new Date(item.created_at).toLocaleDateString()}</div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</p>{item.teacher_reply ? <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Your reply</strong><p className="mt-1">{item.teacher_reply}</p></div> : <form onSubmit={(event) => replyToFeedback(event, item.id)} className="mt-4 flex flex-wrap gap-2"><input name="reply" required aria-label={`Reply to ${item.student_name}`} className="min-w-52 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Write a response" /><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Reply</button></form>}</article>)}{!feedback.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No student feedback received.</p>}</div>}
          {section === 'question-papers' && <div className="rounded-xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-600">Manage question papers in <a className="font-semibold text-blue-700" href="/teacher/study-materials">Study Materials</a>.</p></div>}
        </>}
      </main>
      <ChatWidget />
    </div>
  );
}
