import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ChatPage from './pages/ChatPage';
import StudentAttendance from './pages/StudentAttendance';
import StudentTimetable from './pages/StudentTimetable';
import StudentAssignments from './pages/StudentAssignments';
import StudentNotices from './pages/StudentNotices';
import MessagesPage from './pages/MessagesPage';
import StudentModulePage from './pages/StudentModulePage';
import StudyMaterials from './pages/StudyMaterials';
import TeacherStudyMaterials from './pages/TeacherStudyMaterials';
import TeacherWorkspace from './pages/TeacherWorkspace';

function ProtectedRoute({ children, role }) {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" replace />;
  if (role && userRole !== role) return <Navigate to={`/${userRole || 'login'}`} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute role="student"><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute role="student"><StudentTimetable /></ProtectedRoute>} />
      <Route path="/student/assignments" element={<ProtectedRoute role="student"><StudentAssignments /></ProtectedRoute>} />
      <Route path="/student/notices" element={<ProtectedRoute role="student"><StudentNotices /></ProtectedRoute>} />
      <Route path="/student/messages" element={<ProtectedRoute role="student"><MessagesPage role="student" /></ProtectedRoute>} />
      <Route path="/student/enrollment" element={<ProtectedRoute role="student"><StudentModulePage module="enrollment" /></ProtectedRoute>} />
      <Route path="/student/lesson-plan" element={<ProtectedRoute role="student"><StudentModulePage module="lesson-plan" /></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute role="student"><StudentModulePage module="results" /></ProtectedRoute>} />
      <Route path="/student/mentoring" element={<ProtectedRoute role="student"><StudentModulePage module="mentoring" /></ProtectedRoute>} />
      <Route path="/student/events" element={<ProtectedRoute role="student"><StudentModulePage module="events" /></ProtectedRoute>} />
      <Route path="/student/feedback" element={<ProtectedRoute role="student"><StudentModulePage module="feedback" /></ProtectedRoute>} />
      <Route path="/student/notifications" element={<ProtectedRoute role="student"><StudentModulePage module="notifications" /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute role="student"><StudentModulePage module="profile" /></ProtectedRoute>} />
      <Route path="/student/fees" element={<ProtectedRoute role="student"><StudentModulePage module="fees" /></ProtectedRoute>} />
      <Route path="/student/receipts" element={<ProtectedRoute role="student"><StudentModulePage module="receipts" /></ProtectedRoute>} />
      <Route path="/student/study-materials" element={<ProtectedRoute role="student"><StudyMaterials /></ProtectedRoute>} />
      <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/study-materials" element={<ProtectedRoute role="teacher"><TeacherStudyMaterials /></ProtectedRoute>} />
      <Route path="/teacher/profile" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="profile" /></ProtectedRoute>} />
      <Route path="/teacher/subjects" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="subjects" /></ProtectedRoute>} />
      <Route path="/teacher/timetable" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="timetable" /></ProtectedRoute>} />
      <Route path="/teacher/attendance" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="attendance" /></ProtectedRoute>} />
      <Route path="/teacher/assignments" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="assignments" /></ProtectedRoute>} />
      <Route path="/teacher/marks" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="marks" /></ProtectedRoute>} />
      <Route path="/teacher/examinations" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="examinations" /></ProtectedRoute>} />
      <Route path="/teacher/question-papers" element={<ProtectedRoute role="teacher"><TeacherStudyMaterials questionPapersOnly /></ProtectedRoute>} />
      <Route path="/teacher/notices" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="notices" /></ProtectedRoute>} />
      <Route path="/teacher/mentoring" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="mentoring" /></ProtectedRoute>} />
      <Route path="/teacher/feedback" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="feedback" /></ProtectedRoute>} />
      <Route path="/teacher/notifications" element={<ProtectedRoute role="teacher"><TeacherWorkspace section="notifications" /></ProtectedRoute>} />
      <Route path="/teacher/messages" element={<ProtectedRoute role="teacher"><MessagesPage role="teacher" /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
