import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWidget from '../components/ChatWidget';

const categories = ['Notes', 'Study Materials', 'Presentation', 'Practice Questions', 'Previous Question Paper', 'Other'];

export default function StudyMaterials() {
  const [materials, setMaterials] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [module, setModule] = useState('');
  const [category, setCategory] = useState('');
  const [year, setYear] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('http://localhost:5000/api/materials/subjects', { headers }),
      fetch('http://localhost:5000/api/materials', { headers }),
    ]).then(async ([subjectResponse, materialResponse]) => {
      if (!subjectResponse.ok || !materialResponse.ok) throw new Error('Unable to load study materials.');
      const subjectData = await subjectResponse.json();
      const materialData = await materialResponse.json();
      setSubjects(subjectData.subjects || []);
      setMaterials(materialData.materials || []);
      setLoading(false);
    }).catch((reason) => {
      setError(reason.message);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => materials.filter((item) => {
    const query = `${item.title} ${item.subject_name}`.toLowerCase();
    return (!search || query.includes(search.toLowerCase()))
      && (!subject || String(item.subject_id) === subject)
      && (!module || String(item.module_number) === module)
      && (!category || item.category === category)
      && (!year || item.academic_year === year);
  }).sort((left, right) => sort === 'oldest' ? new Date(left.uploaded_at) - new Date(right.uploaded_at) : new Date(right.uploaded_at) - new Date(left.uploaded_at)), [materials, search, subject, module, category, year, sort]);

  const questionPapers = filtered.filter((item) => item.category === 'Previous Question Paper');
  const studyResources = filtered.filter((item) => item.category !== 'Previous Question Paper');

  const openProtected = async (url, preview = false) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000${url}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('You are not authorized to access this file.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (preview) window.open(objectUrl, '_blank', 'noopener,noreferrer'); else {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = url;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="student" />
      <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
        <div className="mb-6"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Learning resources</div><h1 className="mt-2 text-3xl font-bold text-slate-950">Study Materials</h1><p className="mt-2 text-sm text-slate-500">Materials uploaded for your enrolled subjects by authorized faculty.</p></div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          <select value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All subjects</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select>
          <select value={module} onChange={(event) => setModule(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All modules</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>Module {value}</option>)}</select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
        </div>

        {loading && <div className="mt-5 rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">Loading study materials...</div>}
        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && <div className="mt-6 space-y-8">
          <section>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Subject study resources</h2><span className="text-sm text-slate-500">{studyResources.length} resource(s)</span></div>
            {studyResources.length ? <div className="grid gap-4 xl:grid-cols-2">{studyResources.map((item) => <ResourceCard key={item.id} item={item} onOpen={openProtected} />)}</div> : <EmptyState text="No study materials have been uploaded for this selection yet." />}
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Previous Question Papers</h2><span className="text-sm text-slate-500">{questionPapers.length} paper(s)</span></div>
            {questionPapers.length ? <div className="grid gap-4 xl:grid-cols-2">{questionPapers.map((item) => <ResourceCard key={item.id} item={item} questionPaper onOpen={openProtected} />)}</div> : <EmptyState text="No previous question papers are available for this selection yet." />}
          </section>
        </div>}
      </main>
      <ChatWidget />
    </div>
  );
}

function EmptyState({ text }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>; }

function ResourceCard({ item, questionPaper = false, onOpen }) {
  const fileDate = new Date(item.uploaded_at).toLocaleDateString();
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-blue-700">{item.subject_code}</div><h3 className="mt-1 font-bold text-slate-900">{item.title}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${questionPaper ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>{item.category}</span></div>{item.description && <p className="mt-3 text-sm text-slate-600">{item.description}</p>}<div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{item.module_number ? `Module ${item.module_number}` : 'General resource'}</span><span>{item.academic_year || 'Academic year not specified'}</span><span>Uploaded {fileDate}</span><span>By {item.teacher_name}</span></div><div className="mt-4 flex gap-2">{item.preview_url && <button onClick={() => onOpen(item.preview_url, true)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Preview</button>}<button onClick={() => onOpen(item.download_url)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Download</button></div></article>;
}
