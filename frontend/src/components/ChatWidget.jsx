import { useEffect, useState } from 'react';

const suggestionsByRole = {
  student: ['My attendance', 'My marks', 'Pending assignments', 'Study materials', 'Next holiday', 'Classes tomorrow', 'Notifications', 'Fee status', 'My timetable'],
  teacher: ['My timetable today', 'Low attendance', 'Who has not submitted?', 'Unread messages'],
  admin: ['Student summary', 'Department stats', 'Timetable', 'Notice search'],
};

const navigationPaths = {
  student: {
    'My attendance': '/student/attendance',
    'My timetable': '/student/timetable',
    Assignments: '/student/assignments',
    'My assignments': '/student/assignments',
    'Pending assignments': '/student/assignments',
    'Exam schedule': '/student/results',
    'My marks': '/student/results',
    'My results': '/student/results',
    'Notice board': '/student/notices',
    Notices: '/student/notices',
    Notifications: '/student/notifications',
    'Fee details': '/student/fees',
    'Fee status': '/student/fees',
  },
  teacher: {
    'My timetable': '/teacher/timetable',
    'Low attendance': '/teacher/attendance',
    'Pending submissions': '/teacher/assignments',
    Assignments: '/teacher/assignments',
    'Student messages': '/teacher/messages',
    'Academic summary': '/teacher',
    'Marks and examinations': '/teacher/marks',
    'My subjects': '/teacher/subjects',
    Mentoring: '/teacher/mentoring',
    Notices: '/teacher/notices',
    'Student attendance': '/teacher/attendance',
  },
};

export default function ChatWidget({ embedded = false, defaultOpen = false }) {
  const role = localStorage.getItem('role') || 'student';
  const tokenKey = localStorage.getItem('token') || role;
  const historyKey = `campuscore-chat-${tokenKey.slice(-16)}`;
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(historyKey) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {
      sessionStorage.removeItem(historyKey);
    }
    return [{
      sender: 'assistant',
      text: 'Hi! I can look up your attendance, assignments, study materials, timetable, exams, notices, holidays, and published marks from CampusCore.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(suggestionsByRole[role] || suggestionsByRole.student);

  const openMaterial = async (material, preview = false) => {
    const token = localStorage.getItem('token');
    if (!token || !(preview ? material.preview_url : material.download_url)) return;

    const path = preview ? material.preview_url : material.download_url;
    const response = await fetch(`http://localhost:5000${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      window.alert('This material is not available to you right now.');
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (preview) {
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = material.file_name || 'study-material';
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(historyKey, JSON.stringify(messages.slice(-60)));
    } catch (error) {
      // Session history is best-effort when browser storage is unavailable.
    }
  }, [historyKey, messages]);

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage = {
      sender: 'user',
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-8).map((item) => ({ role: item.sender, content: item.text })),
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to get response');
      }

      const assistantMessage = {
        sender: 'assistant',
        text: payload.reply,
        links: (payload.suggestions || []).map((label) => ({ label, path: navigationPaths[role]?.[label] })).filter((item) => item.path),
        materials: payload.materials || [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSuggestions(payload.suggestions || suggestionsByRole[role] || suggestionsByRole.student);
    } catch (error) {
      setMessages((prev) => [...prev, {
        sender: 'assistant',
        text: `I could not answer that request right now. ${error instanceof Error ? error.message : 'Please try again or check your login state.'}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!embedded && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-blue-700"
      >
        Ask AI Assistant
      </button>
    );
  }

  return (
    <div className={embedded ? 'mx-auto w-full max-w-4xl rounded-3xl bg-white shadow-soft' : 'fixed bottom-5 right-5 z-50 w-[360px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft'}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <div>
          <div className="text-sm font-semibold">CampusCore AI Assistant</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Role-aware support</div>
        </div>
        {!embedded && (
          <button onClick={() => setOpen(false)} className="text-sm text-slate-200">Close</button>
        )}
      </div>

      <div className="space-y-3 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((item) => (
            <button
              key={item}
              onClick={() => sendMessage(item)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[360px] space-y-3 overflow-y-auto bg-white p-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              <div className="whitespace-pre-line">{msg.text}</div>
              {msg.links?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{msg.links.map((link) => <a key={`${link.label}-${link.path}`} href={link.path} className="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-blue-800 underline">{link.label}</a>)}</div>}
              {msg.materials?.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
                  {msg.materials.map((material) => (
                    <div key={material.id} className="rounded-lg border border-slate-200 p-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{material.subject_name}{material.subject_code ? ` (${material.subject_code})` : ''}</div>
                      <div className="mt-1 font-semibold text-slate-900">{material.title}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {material.category} · Module {material.module_number || 'General'} · {material.file_name}
                        {' · Uploaded '}
                        {material.uploaded_at ? new Date(material.uploaded_at).toLocaleDateString() : 'date unavailable'}
                      </div>
                      <div className="mt-2 flex gap-2">
                        {material.preview_url && <button onClick={() => openMaterial(material, true)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">View</button>}
                        <button onClick={() => openMaterial(material)} className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white">Download</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className={`mt-1 text-[10px] ${msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>{msg.time}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
              Assistant is typing...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage();
            }}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            placeholder="Ask about attendance, assignments, study materials, calendar..."
          />
          <button
            onClick={() => sendMessage()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
