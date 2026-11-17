export const academicCalendarNotices = [
  { date: '17 Aug 2026', sortDate: '2026-08-17', title: 'Nagarpanchami', category: 'Holiday' },
  { date: '25 Aug 2026', sortDate: '2026-08-25', title: 'Eid Milad', category: 'Holiday' },
  { date: '26 Aug 2026', sortDate: '2026-08-26', title: 'Onam', category: 'Festival / Holiday' },
  { date: '29 Aug 2026', sortDate: '2026-08-29', title: 'Graduation Day', category: 'College Event' },
  { date: '07 Sep 2026', sortDate: '2026-09-07', title: '5th Semester Commencement', category: 'Academic' },
  { date: '09 Sep 2026', sortDate: '2026-09-09', title: 'Assignment 1 Start Date', category: 'Assignment' },
  { date: '14 Sep 2026', sortDate: '2026-0git 9-14', title: 'Ganesh Chaturthi', category: 'Festival / Holiday' },
  { date: '21-26 Sep 2026', sortDate: '2026-09-21', title: 'IQAC-1, Class Committee Meeting-1 & Feedback Analysis-1', category: 'Academic Activity' },
  { date: '02 Oct 2026', sortDate: '2026-10-02', title: 'Gandhi Jayanti', category: 'Public Holiday' },
  { date: '05-08 Oct 2026', sortDate: '2026-10-05', title: 'OA-1: Unit Test, Quiz, Certification & Project Evaluation', category: 'Assessment' },
  { date: '09 Oct 2026', sortDate: '2026-10-09', title: 'Annual Day', category: 'College Event' },
  { date: '10 Oct 2026', sortDate: '2026-10-10', title: 'Pace Talents Day', category: 'College Event' },
  { date: '12-16 Oct 2026', sortDate: '2026-10-12', title: 'Lab IA-1', category: 'Lab IA' },
  { date: '20 Oct 2026', sortDate: '2026-10-20', title: 'Ayudha Pooja', category: 'Festival / Holiday' },
  { date: '21 Oct 2026', sortDate: '2026-10-21', title: 'Vijaya Dashami', category: 'Festival / Holiday' },
  { date: '26 Oct 2026', sortDate: '2026-10-26', title: 'KAUSHAL Activities', category: 'Academic Activity' },
  { date: '27 Oct 2026', sortDate: '2026-10-27', title: 'Assignment 1 Submission Deadline', category: 'Assignment' },
  { date: '27-30 Oct 2026', sortDate: '2026-10-27', title: 'First IA Test', category: 'Assessment' },
  { date: '02 Nov 2026', sortDate: '2026-11-02', title: 'Assignment 2 Start Date', category: 'Assignment' },
  { date: '03-06 Nov 2026', sortDate: '2026-11-03', title: 'IQAC-1, Class Committee Meeting-1 & Feedback Analysis-1', category: 'Academic Activity' },
  { date: '09-14 Nov 2026', sortDate: '2026-11-09', title: 'Sports / NSS Activity Week (3rd & 5th Semester)', category: 'College Event' },
  { date: '10 Nov 2026', sortDate: '2026-11-10', title: 'Balipady', category: 'Holiday' },
  { date: '19 Nov 2026', sortDate: '2026-11-19', title: 'College Holiday (marked on calendar; occasion not named)', category: 'Holiday' },
  { date: '23-28 Nov 2026', sortDate: '2026-11-23', title: 'OA-1: Unit Test, Quiz, Certification & Project Evaluation', category: 'Assessment' },
  { date: '07-11 Dec 2026', sortDate: '2026-12-07', title: 'Lab IA-2', category: 'Lab IA' },
  { date: '09 Dec 2026', sortDate: '2026-12-09', title: '3rd & 5th Semester Last Working Day', category: 'Academic' },
  { date: '15 Dec 2026', sortDate: '2026-12-15', title: 'Assignment 2 Submission Deadline', category: 'Assignment' },
  { date: '16-18 Dec 2026', sortDate: '2026-12-16', title: 'Second IA Test', category: 'Assessment' },
  { date: '21-24 Dec 2026', sortDate: '2026-12-21', title: 'IQAC-2, Class Committee Meeting-2 & Feedback Analysis-2', category: 'Academic Activity' },
  { date: '25 Dec 2026', sortDate: '2026-12-25', title: 'Christmas', category: 'Public Holiday' },
  { date: '30 Dec 2026', sortDate: '2026-12-30', title: '3rd & 5th Semester Last Working Day', category: 'Academic' },
  { date: '04 Jan-05 Feb 2027', sortDate: '2027-01-04', title: 'Theory Examinations (3rd & 5th Semester)', category: 'Semester Examination' },
  { date: '08-20 Feb 2027', sortDate: '2027-02-08', title: 'Practical / Viva Voce Examinations (3rd & 5th Semester)', category: 'Semester Examination' },
];

export const noticeCategoryStyle = (category) => {
  if (category.includes('Holiday')) return 'bg-red-50 text-red-700';
  if (category.includes('Festival')) return 'bg-rose-50 text-rose-700';
  if (category.includes('Assignment')) return 'bg-amber-50 text-amber-800';
  if (category.includes('Assessment') || category.includes('IA')) return 'bg-orange-50 text-orange-800';
  if (category.includes('Examination')) return 'bg-blue-50 text-blue-700';
  if (category.includes('Event')) return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
};