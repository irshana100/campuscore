import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const studentGroups = [
  { title: 'Main Menu', items: [
    { label: 'My Dashboard', path: '/student', short: 'D' },
    { label: 'Course Enrollment', path: '/student/enrollment', short: 'CE' },
    { label: 'Timetable', path: '/student/timetable', short: 'TT', expandable: true },
    { label: 'My Attendance', path: '/student/attendance', short: 'A' },
    { label: 'Assignments', path: '/student/assignments', short: 'AS' },
    { label: 'Score / Examination Results', path: '/student/results', short: 'SE', expandable: true },
    { label: 'Notices', path: '/student/notices', short: 'N' },
    { label: 'Feedback', path: '/student/feedback', short: 'F', expandable: true },
  ] },
  { title: 'Communication', items: [
    { label: 'Contact Teacher', path: '/student/messages', short: 'CT' },
    { label: 'Notifications', path: '/student/notifications', short: 'NT' },
    { label: 'AI Chat / AI Assistant', path: '/chat', short: 'AI' },
  ] },
  { title: 'Learning Resources', items: [
    { label: 'Study Materials', path: '/student/study-materials', short: 'SM' },
  ] },
  { title: 'Student Account', items: [
    { label: 'My Profile', path: '/student/profile', short: 'P' },
    { label: 'My Fee Details', path: '/student/fees', short: 'FD' },
    { label: 'My Receipts', path: '/student/receipts', short: 'R' },
  ] },
];

const links = {
  student: studentGroups.flatMap((group) => group.items),
  teacher: [
    { label: 'My Dashboard', path: '/teacher' },
    { label: 'My Profile', path: '/teacher/profile' },
    { label: 'My Assigned Subject', path: '/teacher/subjects' },
    { label: 'My Class Timetable', path: '/teacher/timetable' },
    { label: 'Student Attendance', path: '/teacher/attendance' },
    { label: 'Assignments & Submissions', path: '/teacher/assignments' },
    { label: 'Marks & Examination Results', path: '/teacher/marks' },
    { label: 'Study Materials', path: '/teacher/study-materials' },
    { label: 'Notices & Announcements', path: '/teacher/notices' },
    { label: 'Student Messages', path: '/teacher/messages' },
    { label: 'Notifications', path: '/teacher/notifications' },
    { label: 'AI Assistant', path: '/chat' },
  ],
  admin: [
    { label: 'Overview', path: '/admin' },
    { label: 'Students', path: '/admin/students' },
    { label: 'Teachers', path: '/admin/teachers' },
    { label: 'Timetable', path: '/admin/timetable' },
    { label: 'Exams', path: '/admin/exams' },
    { label: 'AI Chat', path: '/chat' },
  ],
};

export default function Sidebar({ role }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);
  useEffect(() => {
    const toggle = () => setMobileOpen((current) => !current);
    document.addEventListener('campuscore-toggle-sidebar', toggle);
    return () => document.removeEventListener('campuscore-toggle-sidebar', toggle);
  }, []);
  const [openGroups, setOpenGroups] = useState({ 'Main Menu': true, Communication: true, 'Learning Resources': true, 'Student Account': true });
  const name = localStorage.getItem('userName') || 'Campus User';
  const initial = name.charAt(0).toUpperCase();
  const toggle = (title) => setOpenGroups((current) => ({ ...current, [title]: !current[title] }));
  const sidebarContent = (
    <>
      <div className="border-b border-slate-200 bg-white px-5 py-5 text-slate-900">
        <div className="text-lg font-bold">CampusCore</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">College Portal</div>
        <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">{initial}</div>
          <div className="min-w-0"><div className="truncate text-sm font-semibold">{name}</div><div className="text-[11px] capitalize text-slate-500">{role}</div></div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {role === 'student' ? studentGroups.map((group) => (
          <div key={group.title} className="mb-2">
            <button onClick={() => toggle(group.title)} className="flex w-full items-center justify-between px-2 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"><span>{group.title}</span><span>{openGroups[group.title] ? '⌃' : '⌄'}</span></button>
            {openGroups[group.title] && (
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    end
                    onClick={closeMobile}
                    className={({ isActive }) => `flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition ${isActive ? 'border-l-4 border-blue-600 bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-600">{item.short}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.expandable && <span className="text-white/50">›</span>}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )) : (
          links[role]?.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={closeMobile}
              className={({ isActive }) => `flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition ${role === 'teacher' ? (isActive ? 'border-l-4 border-blue-600 bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900') : (isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white')}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs ${role === 'teacher' ? 'border-slate-200 bg-white font-bold text-slate-600' : 'border-white/20 text-white'}`}>{item.label.charAt(0)}</span>
              {item.label}
            </NavLink>
          ))
        )}
      </nav>
    </>
  );

  return (
    <>
      <button onClick={() => document.dispatchEvent(new CustomEvent('campuscore-toggle-sidebar'))} aria-label="Open navigation menu" className="fixed left-4 top-4 z-40 rounded-lg bg-white p-2 text-slate-800 shadow-lg ring-1 ring-slate-200 lg:hidden">☰</button>
      <aside className="hidden h-screen w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">{sidebarContent}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close menu" onClick={closeMobile} className="absolute inset-0 bg-slate-950/50" /><aside className="relative flex h-full w-[280px] flex-col bg-white shadow-2xl">{sidebarContent}</aside></div>}
    </>
  );
}
