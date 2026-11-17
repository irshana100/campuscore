import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWidget from '../components/ChatWidget';

const categories = ['Attendance', 'Assignments', 'Exams', 'Subject doubts', 'Other query'];

export default function MessagesPage({ role }) {
  const [threads, setThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState({ teacher_id: '', subject_id: '', subject: '', category: 'Other query', message: '' });
  const [reply, setReply] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [notice, setNotice] = useState('');
  const [facultySearch, setFacultySearch] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');

  const loadThreads = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:5000/api/communication/threads', { headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) {
      const data = await response.json();
      setThreads(data.threads || []);
      setActiveId((current) => current || data.threads?.[0]?.id || null);
    }
  };

  useEffect(() => {
    loadThreads();
    const refreshTimer = window.setInterval(loadThreads, 10000);
    if (role === 'student') {
      const token = localStorage.getItem('token');
      fetch('http://localhost:5000/api/communication/contacts', { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((data) => setContacts(data.contacts || []));
    }
    return () => window.clearInterval(refreshTimer);
  }, [role]);

  const active = threads.find((thread) => thread.id === activeId);
  const filteredContacts = contacts.filter((contact) => `${contact.teacher_name} ${contact.subject_name} ${contact.subject_code || ''}`.toLowerCase().includes(facultySearch.toLowerCase()));
  const filteredThreads = threads.filter((thread) => `${role === 'student' ? thread.teacher?.name : thread.student?.name} ${thread.subject_name} ${thread.subject}`.toLowerCase().includes(conversationSearch.toLowerCase()));

  const sendMessage = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const contact = contacts.find((item) => String(item.teacher_id) === String(form.teacher_id) && String(item.subject_id) === String(form.subject_id));
    const body = new FormData();
    body.append('teacher_id', form.teacher_id);
    body.append('subject_id', form.subject_id);
    body.append('subject', form.subject);
    body.append('category', form.category);
    body.append('message', form.message);
    if (attachment) body.append('attachment', attachment);

    const response = await fetch('http://localhost:5000/api/communication/threads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (response.ok) {
      const data = await response.json();
      setActiveId(data.thread.id);
      setCompose(false);
      setForm({ teacher_id: '', subject_id: '', subject: '', category: 'Other query', message: '' });
      setAttachment(null);
      setNotice('Message sent successfully.');
      await loadThreads();
    } else {
      const data = await response.json();
      setNotice(data.error || 'Unable to send message.');
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000/api/communication/threads/${active.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply }),
    });
    if (response.ok) {
      setReply('');
      await loadThreads();
    }
  };

  const openThread = async (threadId) => {
    setActiveId(threadId);
    const token = localStorage.getItem('token');
    await fetch(`http://localhost:5000/api/communication/threads/${threadId}/read`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    await loadThreads();
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role={role} />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Student-teacher communication</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Messages</h1>
          </div>
          {role === 'student' && <button onClick={() => setCompose(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">New message</button>}
        </div>
        {notice && <div className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-700 shadow-soft">{notice}</div>}

        <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft xl:grid-cols-[260px_310px_1fr]">
          {role === 'student' && (
            <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r">
              <div className="border-b px-4 py-3 text-sm font-bold text-slate-800">Faculty directory</div>
              <div className="p-3"><input value={facultySearch} onChange={(event) => setFacultySearch(event.target.value)} placeholder="Search faculty or subject" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
              <div className="max-h-[520px] overflow-y-auto px-2 pb-2">
                {filteredContacts.map((contact) => (
                  <button key={`${contact.teacher_id}-${contact.subject_id}`} onClick={() => { setCompose(true); setForm((current) => ({ ...current, teacher_id: String(contact.teacher_id), subject_id: String(contact.subject_id) })); }} className="mb-2 w-full rounded-lg border border-slate-100 p-3 text-left hover:border-blue-200 hover:bg-blue-50">
                    <div className="font-semibold text-slate-900">{contact.teacher_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{contact.subject_code || ''} · {contact.subject_name}</div>
                  </button>
                ))}
              </div>
            </aside>
          )}
          <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="border-b px-4 py-3 text-sm font-bold text-slate-800">Conversations</div>
            <div className="p-3"><input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search conversations" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
            <div className="max-h-[620px] overflow-y-auto">
              {filteredThreads.map((thread) => (
                <button key={thread.id} onClick={() => openThread(thread.id)} className={`w-full border-b border-slate-100 px-4 py-4 text-left ${activeId === thread.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-semibold text-slate-900">{role === 'student' ? thread.teacher?.name : thread.student?.name}</div>
                    {thread.status === 'replied' && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">Replied</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">{thread.subject_name} · {thread.category}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{new Date(thread.updated_at).toLocaleDateString()}</span>
                    {thread.unread_count > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 font-bold text-white">{thread.unread_count}</span>}
                  </div>
                </button>
              ))}
              {!threads.length && <div className="p-5 text-sm text-slate-500">No conversations yet.</div>}
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col">
            {!active ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Select a conversation.</div>
            ) : (
              <>
                <div className="border-b px-5 py-4">
                  <div className="font-bold text-slate-900">{active.subject}</div>
                  <div className="mt-1 text-xs text-slate-500">{active.subject_name} · {active.category} · {active.status}</div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
                  {active.messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender_role === role ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-xl px-4 py-3 text-sm ${message.sender_role === role ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 shadow'}`}>
                        <div>{message.message}</div>
                        {message.attachment_url && <a href={`http://localhost:5000${message.attachment_url}`} className="mt-2 block underline">Download {message.attachment_name}</a>}
                        <div className="mt-2 text-[10px] opacity-75">{new Date(message.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t p-4">
                  <input value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendReply()} placeholder="Write a reply..." className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button onClick={sendReply} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Send</button>
                </div>
              </>
            )}
          </section>
        </div>

        {compose && role === 'student' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <form onSubmit={sendMessage} className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">New message</h2><button type="button" onClick={() => setCompose(false)} className="text-sm text-slate-500">Close</button></div>
              <div className="mt-5 grid gap-4">
                <label className="text-sm font-medium text-slate-700">Teacher and subject
                  <select required value={`${form.teacher_id}|${form.subject_id}`} onChange={(event) => { const [teacherId, subjectId] = event.target.value.split('|'); setForm((current) => ({ ...current, teacher_id: teacherId, subject_id: subjectId })); }} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="">Select teacher</option>
                    {contacts.map((contact) => <option key={`${contact.teacher_id}-${contact.subject_id}`} value={`${contact.teacher_id}|${contact.subject_id}`}>{contact.subject_name} · {contact.teacher_name}</option>)}
                  </select>
                </label>
                <input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Message subject" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
                <textarea required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Write your message" rows={5} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.zip" onChange={(event) => setAttachment(event.target.files[0] || null)} className="text-sm text-slate-600" />
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Send message</button>
              </div>
            </form>
          </div>
        )}
      </main>
      <ChatWidget />
    </div>
  );
}
