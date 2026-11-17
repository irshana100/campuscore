import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import ChatWidget from '../components/ChatWidget';
import { mockDashboard } from '../data/mockData';

export default function AdminDashboard() {
  const [data] = useState(mockDashboard.admin);
  const [admissionSummary, setAdmissionSummary] = useState(null);
  const [applications, setApplications] = useState([]);
  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    Promise.all([
      fetch('http://localhost:5000/api/admissions/summary', { headers }),
      fetch('http://localhost:5000/api/admissions', { headers }),
    ]).then(async ([summaryResponse, applicationsResponse]) => {
      if (summaryResponse.ok) setAdmissionSummary((await summaryResponse.json()).summary);
      if (applicationsResponse.ok) setApplications((await applicationsResponse.json()).applications || []);
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role="admin" />
      <main className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Administrator Dashboard</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">College overview</h1>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Students" value={data.summary.students} accent="bg-blue-50 text-blue-700" />
          <StatCard title="Faculty" value={data.summary.teachers} accent="bg-emerald-50 text-emerald-700" />
          <StatCard title="Departments" value={data.summary.departments} accent="bg-violet-50 text-violet-700" />
          <StatCard title="Notices" value={data.summary.notices} accent="bg-amber-50 text-amber-700" />
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold text-slate-900">Admission applications</h2><span className="text-sm text-slate-500">Live registration workflow</span></div>
          {admissionSummary ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Total</div><div className="mt-1 text-xl font-bold">{admissionSummary.total}</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Document verification</div><div className="mt-1 text-xl font-bold">{admissionSummary.pending_document_verification}</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Pending approval</div><div className="mt-1 text-xl font-bold">{admissionSummary.pending_approval}</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Approved</div><div className="mt-1 text-xl font-bold text-emerald-700">{admissionSummary.approved}</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Rejected</div><div className="mt-1 text-xl font-bold text-red-700">{admissionSummary.rejected}</div></div></div> : <div className="text-sm text-slate-500">Loading admission summary...</div>}
          <div className="mt-4 space-y-2">{applications.slice(0,5).map((application) => <div key={application.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-4 py-3"><div><div className="font-semibold text-slate-900">{application.application_number} · {application.applicant_name}</div><div className="text-xs text-slate-500">{application.course}</div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{application.status}</span></div>)}</div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="card">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Examination schedule</h2>
            <div className="space-y-3">
              {data.examinations.map((exam) => (
                <div key={exam.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <div className="font-medium text-slate-800">{exam.name}</div>
                    <div className="text-sm text-slate-500">{exam.date}</div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Published</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Latest notices</h2>
            <div className="space-y-3">
              {data.notices.map((notice) => (
                <div key={notice.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="font-medium text-slate-800">{notice.title}</div>
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-500">{notice.type}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}
