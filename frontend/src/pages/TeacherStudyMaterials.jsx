import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWidget from '../components/ChatWidget';

const categories = ['Notes', 'Study Materials', 'Presentation', 'Practice Questions', 'Previous Question Paper', 'Other'];
const emptyForm = { subject_id: '', title: '', description: '', category: 'Notes', module_number: '', semester: 5, academic_year: new Date().getFullYear() + '-' + String(new Date().getFullYear() + 1).slice(-2), examination_type: '', published: true, file: null };

export default function TeacherStudyMaterials({ questionPapersOnly = false }) {
  const initialCategory = questionPapersOnly ? 'Previous Question Paper' : 'Notes';
  const [subjects, setSubjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, category: initialCategory });
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  const load = async () => {
    const [subjectsResponse, materialsResponse] = await Promise.all([
      fetch('http://localhost:5000/api/materials/subjects', { headers: authHeaders() }),
      fetch('http://localhost:5000/api/materials', { headers: authHeaders() }),
    ]);
    if (subjectsResponse.ok && materialsResponse.ok) {
      setSubjects((await subjectsResponse.json()).subjects || []);
      const uploaded = (await materialsResponse.json()).materials || [];
      setMaterials(questionPapersOnly ? uploaded.filter((item) => item.category === 'Previous Question Paper') : uploaded);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    const body = new FormData();
    ['subject_id','title','description','category','module_number','semester','academic_year','examination_type','published'].forEach((field) => body.append(field, String(form[field])));
    if (form.file) body.append('file', form.file);
    const response = await fetch(editing ? `http://localhost:5000/api/materials/${editing}` : 'http://localhost:5000/api/materials', { method: editing ? 'PATCH' : 'POST', headers: authHeaders(), body });
    const data = await response.json();
    if (!response.ok) return setNotice(data.error || 'Unable to save material.');
    setNotice(data.message || 'Study material saved successfully.');
    setForm({ ...emptyForm, category: initialCategory });
    setEditing(null);
    await load();
  };

  const remove = async (material) => {
    if (!window.confirm(`Delete “${material.title}”?`)) return;
    const response = await fetch(`http://localhost:5000/api/materials/${material.id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) return setNotice(data.error || 'Unable to delete material.');
    setNotice(data.message);
    await load();
  };

  const startEdit = (material) => {
    setEditing(material.id);
    setForm({ subject_id: String(material.subject_id), title: material.title, description: material.description || '', category: material.category, module_number: material.module_number || '', semester: material.semester, academic_year: material.academic_year || '', examination_type: material.examination_type || '', published: material.published, file: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="teacher" />
      <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
        <div className="mb-6"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Faculty resources</div><h1 className="mt-2 text-3xl font-bold text-slate-950">{questionPapersOnly ? 'Previous Question Papers' : 'Study Materials'}</h1></div>
        {notice && <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{notice}</div>}
        <form onSubmit={submit} className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{editing ? 'Edit study resource' : 'Upload study resource'}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">Subject<select required value={form.subject_id} onChange={(event) => setForm({...form, subject_id: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Select authorized subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Resource title<input required value={form.title} onChange={(event) => setForm({...form, title: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-semibold text-slate-700">Category<select value={form.category} onChange={(event) => setForm({...form, category: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Module<select value={form.module_number} onChange={(event) => setForm({...form, module_number: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">General / no module</option>{[1,2,3,4,5].map((item) => <option key={item} value={item}>Module {item}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Semester<input type="number" min="1" max="8" value={form.semester} onChange={(event) => setForm({...form, semester: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-semibold text-slate-700">Academic year<input required value={form.academic_year} onChange={(event) => setForm({...form, academic_year: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-semibold text-slate-700">Examination type<select value={form.examination_type} onChange={(event) => setForm({...form, examination_type: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Not applicable</option><option>Internal Assessment</option><option>Semester Examination</option></select></label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Description<textarea rows="3" value={form.description} onChange={(event) => setForm({...form, description: event.target.value})} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-semibold text-slate-700">{editing ? 'Replace file (optional)' : 'Resource file'}<input required={!editing} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.zip,.png,.jpg,.jpeg" onChange={(event) => setForm({...form, file: event.target.files[0] || null})} className="mt-2 block w-full text-xs text-slate-500" /><span className="mt-1 block text-xs font-normal text-slate-500">Maximum file size: 25 MB</span></label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.published} onChange={(event) => setForm({...form, published: event.target.checked})} />Published</label>
          <div className="mt-5 flex gap-2"><button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{editing ? 'Save changes' : 'Upload and publish'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>}</div>
        </form>
        <h2 className="mb-4 text-lg font-bold text-slate-900">Uploaded resources</h2>
        <div className="grid gap-4 xl:grid-cols-2">{materials.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold text-blue-700">{item.subject_code}</div><h3 className="mt-1 font-bold text-slate-900">{item.title}</h3></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.published ? 'Published' : 'Unpublished'}</span></div><div className="mt-3 text-xs text-slate-500">{item.category} · {item.module_number ? `Module ${item.module_number}` : 'General'} · {new Date(item.uploaded_at).toLocaleDateString()}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => startEdit(item)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Edit</button><button onClick={async () => { const body = new FormData(); body.append('published', String(!item.published)); const response = await fetch(`http://localhost:5000/api/materials/${item.id}`, { method:'PATCH', headers:authHeaders(), body }); if (response.ok) { setNotice(`Resource ${item.published ? 'unpublished' : 'published'} successfully.`); await load(); } }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">{item.published ? 'Unpublish' : 'Publish'}</button><button onClick={() => remove(item)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Delete</button></div></article>)}</div>
      </main>
      <ChatWidget />
    </div>
  );
}
