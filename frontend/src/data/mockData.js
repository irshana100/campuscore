export const mockDashboard = {
  student: {
    profile: { name: 'Aarav Patel', semester: 5 },
    attendance_summary: [
      { subject_id: 1, percentage: 82, present: 18, total: 22 },
      { subject_id: 2, percentage: 76, present: 16, total: 21 },
    ],
    attendance_projection: {
      current_percentage: 79.5,
      threshold: 75,
      needed_classes: 3,
      max_miss_allowed: 5,
      warning: 'On track',
    },
    notices: [
      { id: 1, title: 'Mid-Semester Seminar', content: 'Operating systems security seminar on 20 Oct.' },
      { id: 2, title: 'Placement Drive', content: 'Campus recruitment details shared by the placement cell.' },
    ],
    assignments: [
      { id: 1, title: 'Operating Systems Lab Report', due_date: '2026-10-18' },
      { id: 2, title: 'Data Structures Quiz', due_date: '2026-10-24' },
    ],
    today_timetable: [
      { subject: 'Operating Systems', room: 'C-101', day: 'Monday', period: 1 },
      { subject: 'DBMS', room: 'C-204', day: 'Monday', period: 2 },
    ],
  },
  teacher: {
    profile: { name: 'Dr. Meera Shah', department_id: 1 },
    today_classes: [
      { subject: 'Operating Systems', room: 'C-101', day: 'Monday', period: 1 },
      { subject: 'Data Structures', room: 'C-105', day: 'Monday', period: 3 },
    ],
    notices: [
      { id: 1, title: 'Assignment Review', type: 'teacher' },
      { id: 2, title: 'Faculty Meeting', type: 'meeting' },
    ],
  },
  admin: {
    summary: {
      students: 326,
      teachers: 42,
      departments: 8,
      notices: 18,
    },
    notices: [
      { id: 1, title: 'Semester Registration', type: 'notice' },
      { id: 2, title: 'Exam Calendar', type: 'schedule' },
    ],
    examinations: [
      { id: 1, name: 'Semester V Mid-Term', date: '2026-10-20' },
      { id: 2, name: 'Semester VI Final', date: '2026-11-05' },
    ],
  },
};
