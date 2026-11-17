from datetime import date
from app import db
from app.models import (
    User,
    Department,
    Subject,
    StudentProfile,
    TeacherProfile,
    TimetableEntry,
    AttendanceRecord,
    Assessment,
    Mark,
    Assignment,
    Submission,
    Notice,
    Notification,
    Examination,
    ExaminationSeatAllocation,
    ClassScheduleEntry,
    StudentSubjectAllocation,
    TeacherSubjectAssignment,
)


CURRICULUM_SUBJECTS = [
    ("Software Engineering & Project Management", "BCS501"),
    ("Computer Networks", "BCS502"),
    ("Theory of Computation", "BCS503"),
    ("Web Technology Lab", "BCSL504"),
    ("Artificial Intelligence", "BCS515B"),
    ("Mini Project", "BCS586"),
    ("Research Methodology and Intellectual Property Rights (IPR)", "BRMK557"),
    ("Environmental Studies", "BCS508"),
    ("National Service Scheme", "BNSK559"),
    ("Physical Education (Sports and Athletics)", "BPEK559"),
    ("Yoga", "BYOK559"),
    ("Computer Networks Lab", "BCS502-LAB"),
    ("Employability Skill Program", "ESP"),
]

OFFICIAL_FACULTY = {
    "BCS501": [("Prof. Kadeejath Ramzeela", "KR")],
    "BCS502": [("Prof. Muhammad Saifudeen", "MS")],
    "BCS503": [("Dr. Mohammed Hafeez M K", "MH")],
    "BCSL504": [("Prof. Fathimath Zuhra", "FZ")],
    "BCS515B": [("Prof. Fathimath Raihana", "FR")],
    "BCS586": [("Prof. Ankitha Bekal", "AB"), ("Mrs. Anshidha Nazrin", "AN")],
    "BRMK557": [("Dr. Sharmila Kumari M", "SK")],
    "BNSK559": [("Prof. Thameezza", "TZ")],
    "BCS502-LAB": [("Mr. Habeeb Ur Rehman", "HR")],
    "ESP": [("Prof. Jagadeesh", "JD"), ("Prof. Faizal", "ST")],
}

DEMO_TEACHER_SUBJECTS = {
    "teacher1@college.edu": "BRMK557",
    "teacher2@college.edu": "ESP",
}

RETIRED_SUBJECT_CODES = {"AI", "CN", "CS101", "CS201", "CS205", "EVS", "MP", "RM", "SEPM", "TOC", "WTL"}

OFFICIAL_CLASS_TIMETABLE = [
    ("Monday", "A", 1, 2, None, "MP-LAB-A1(NT) / WEB-LAB-A2(HPC)"),
    ("Monday", "A", 3, 1, "ESP", "ESP"),
    ("Monday", "A", 4, 1, "BCS503", "TC"),
    ("Monday", "A", 5, 1, "ESP", "ESP"),
    ("Monday", "A", 6, 1, "BCS502", "CN"),
    ("Monday", "A", 7, 1, "BCS501", "SE"),
    ("Monday", "B", 1, 1, "BCS503", "TC"),
    ("Monday", "B", 2, 1, "BRMK557", "RM"),
    ("Monday", "B", 3, 1, "BCS515B", "AI"),
    ("Monday", "B", 4, 1, "BCS502", "CN"),
    ("Monday", "B", 5, 1, "BRMK557", "RM(T)"),
    ("Monday", "B", 6, 2, None, "MP-LAB-B1(NOVEL) / MP-LAB-B2(NT)"),
    ("Tuesday", "A", 1, 1, "BCS501", "SE"),
    ("Tuesday", "A", 2, 1, "BCS503", "TC"),
    ("Tuesday", "A", 3, 2, "BCS502-LAB", "CN-LAB(CC-2)"),
    ("Tuesday", "A", 5, 1, "BCS508", "EVS"),
    ("Tuesday", "A", 6, 1, "BCS515B", "AI"),
    ("Tuesday", "A", 7, 1, "BCS502", "CN"),
    ("Tuesday", "B", 1, 1, "BRMK557", "RM"),
    ("Tuesday", "B", 2, 1, "BCS515B", "AI"),
    ("Tuesday", "B", 3, 1, "ESP", "ESP"),
    ("Tuesday", "B", 4, 1, "BCS508", "EVS"),
    ("Tuesday", "B", 5, 1, "ESP", "ESP"),
    ("Tuesday", "B", 6, 1, "BCS501", "SE"),
    ("Tuesday", "B", 7, 1, "BCS503", "TC"),
    ("Wednesday", "A", 1, 1, "BCS502", "CN"),
    ("Wednesday", "A", 2, 1, "BCS515B", "AI"),
    ("Wednesday", "A", 3, 1, "BRMK557", "RM"),
    ("Wednesday", "A", 4, 1, "BCS501", "SE"),
    ("Wednesday", "A", 5, 1, "BCS508", "EVS"),
    ("Wednesday", "A", 6, 1, "BCS515B", "AI"),
    ("Wednesday", "A", 7, 1, None, "DEPARTMENT MEETING"),
    ("Wednesday", "B", 1, 1, "BRMK557", "RM(T)"),
    ("Wednesday", "B", 2, 1, "BCS501", "SE"),
    ("Wednesday", "B", 3, 1, "BCS502", "CN"),
    ("Wednesday", "B", 4, 1, "BCS508", "EVS"),
    ("Wednesday", "B", 5, 2, None, "MP-LAB-B2(NT) / WEB-LAB-B1(HPC)"),
    ("Wednesday", "B", 7, 1, None, "DEPARTMENT MEETING"),
    ("Thursday", "A", 1, 1, "BCS515B", "AI"),
    ("Thursday", "A", 2, 1, "BCS503", "TC"),
    ("Thursday", "A", 3, 1, "BCS501", "SE"),
    ("Thursday", "A", 4, 1, "BCS503", "TC(T)"),
    ("Thursday", "A", 5, 1, "BRMK557", "RM(T)"),
    ("Thursday", "A", 6, 2, None, "MP-LAB-A2(NT) / WEB-LAB-A1(HPC)"),
    ("Thursday", "B", 1, 2, "BCS502-LAB", "CN-LAB(CC-2)"),
    ("Thursday", "B", 3, 1, "BCS502", "CN"),
    ("Thursday", "B", 4, 1, "BCS515B", "AI"),
    ("Thursday", "B", 5, 1, "BCS501", "SE"),
    ("Thursday", "B", 6, 1, "BCS502", "CN"),
    ("Thursday", "B", 7, 1, "BCS503", "TC"),
    ("Friday", "A", 1, 1, "BCS502", "CN"),
    ("Friday", "A", 2, 1, "BRMK557", "RM(T)"),
    ("Friday", "A", 3, 1, "BCS503", "TC(T)"),
    ("Friday", "A", 4, 1, None, "COUNSELING / YOGA / NSS"),
    ("Friday", "A", 5, 1, "BRMK557", "RM"),
    ("Friday", "A", 6, 2, None, "MP-LAB-A1(NOVEL) / WEB-LAB-A2(NT)"),
    ("Friday", "B", 1, 1, "BCS503", "TC(T)"),
    ("Friday", "B", 2, 2, None, "MP-LAB-B1(NT) / WEB-LAB-B2(HPC)"),
    ("Friday", "B", 4, 1, None, "COUNSELING / YOGA / NSS"),
    ("Friday", "B", 5, 1, "BCS515B", "AI"),
    ("Friday", "B", 6, 1, "BCS501", "SE"),
    ("Friday", "B", 7, 1, "BCS503", "TC(T)"),
]


def synchronize_curriculum():
    cse = Department.query.filter_by(code="CSE").first()
    if not cse:
        return

    for name, code in CURRICULUM_SUBJECTS:
        subject = Subject.query.filter_by(code=code).first()
        if subject:
            subject.name = name
            subject.department_id = cse.id
            subject.is_active = True
        else:
            db.session.add(Subject(name=name, code=code, department_id=cse.id))
    db.session.commit()

    retired_subjects = Subject.query.filter(Subject.code.in_(RETIRED_SUBJECT_CODES)).all()
    retired_ids = [subject.id for subject in retired_subjects]
    for subject in retired_subjects:
        subject.is_active = False
    if retired_ids:
        StudentSubjectAllocation.query.filter(StudentSubjectAllocation.subject_id.in_(retired_ids)).delete(synchronize_session=False)
        TeacherSubjectAssignment.query.filter(TeacherSubjectAssignment.subject_id.in_(retired_ids)).delete(synchronize_session=False)
    db.session.commit()


    official_codes = {code for _, code in CURRICULUM_SUBJECTS}
    subjects = Subject.query.filter(Subject.department_id == cse.id, Subject.is_active.is_(True), Subject.code.in_(official_codes)).all()
    for student in StudentProfile.query.join(User, User.id == StudentProfile.user_id).filter(User.is_active.is_(True)).all():
        subject_ids = {item.subject_id for item in StudentSubjectAllocation.query.filter_by(student_id=student.id).all()}
        for subject in subjects:
            if subject.id not in subject_ids:
                db.session.add(StudentSubjectAllocation(student_id=student.id, subject_id=subject.id))
    db.session.commit()

    for code, faculty_members in OFFICIAL_FACULTY.items():
        subject = Subject.query.filter_by(code=code).first()
        if not subject:
            continue
        for index, (faculty_name, short_name) in enumerate(faculty_members):
            normalized_email = short_name.lower().replace("/", "") + "@college.edu"
            user = User.query.filter_by(email=normalized_email).first()
            if not user:
                user = User(name=faculty_name, email=normalized_email, role="teacher")
                user.set_password("teacher123")
                db.session.add(user)
                db.session.flush()
                teacher_profile = TeacherProfile(user_id=user.id, employee_id=f"TCH-{short_name}", department_id=cse.id, designation="Faculty")
                db.session.add(teacher_profile)
            else:
                teacher_profile = TeacherProfile.query.filter_by(user_id=user.id).first()
            db.session.flush()
            if teacher_profile and not TeacherSubjectAssignment.query.filter_by(teacher_id=teacher_profile.id, subject_id=subject.id).first():
                db.session.add(TeacherSubjectAssignment(teacher_id=teacher_profile.id, subject_id=subject.id))
    db.session.commit()

    preferred_subjects = {}
    for code, faculty_members in OFFICIAL_FACULTY.items():
        for _, short_name in faculty_members:
            preferred_subjects.setdefault(short_name.lower().replace("/", "") + "@college.edu", code)
    preferred_subjects.update(DEMO_TEACHER_SUBJECTS)
    for profile in TeacherProfile.query.join(User, User.id == TeacherProfile.user_id).all():
        assignments = TeacherSubjectAssignment.query.filter_by(teacher_id=profile.id).order_by(TeacherSubjectAssignment.id).all()
        preferred_code = preferred_subjects.get(User.query.get(profile.user_id).email)
        preferred_subject = Subject.query.filter_by(code=preferred_code, is_active=True).first() if preferred_code else None
        keep_subject_id = preferred_subject.id if preferred_subject else assignments[0].subject_id if assignments else None
        if keep_subject_id is None:
            continue
        TeacherSubjectAssignment.query.filter(
            TeacherSubjectAssignment.teacher_id == profile.id,
            TeacherSubjectAssignment.subject_id != keep_subject_id,
        ).delete(synchronize_session=False)
        if not any(item.subject_id == keep_subject_id for item in assignments):
            db.session.add(TeacherSubjectAssignment(teacher_id=profile.id, subject_id=keep_subject_id))
    db.session.commit()

    today_assignment_title = "Computer Networks Lab Submission"
    today_assignment = Assignment.query.filter_by(title=today_assignment_title).first()
    if not today_assignment:
        network_subject = Subject.query.filter_by(code="CN", is_active=True).first()
        teacher_profile = TeacherProfile.query.first()
        if network_subject and teacher_profile:
            db.session.add(Assignment(
                title=today_assignment_title,
                subject_id=network_subject.id,
                teacher_id=teacher_profile.id,
                description="Submit the configured network topology and packet analysis report.",
                due_date=date.today(),
            ))
            db.session.commit()



def synchronize_official_class_timetable():
    subjects = {subject.code: subject for subject in Subject.query.filter_by(is_active=True).all()}
    expected_keys = set()
    for day, section, period, duration, subject_code, label in OFFICIAL_CLASS_TIMETABLE:
        key = (day, section, period, label)
        expected_keys.add(key)
        entry = ClassScheduleEntry.query.filter_by(day=day, section=section, period=period, label=label).first()
        if not entry:
            entry = ClassScheduleEntry(day=day, section=section, period=period, label=label)
            db.session.add(entry)
        entry.duration_periods = duration
        entry.subject_id = subjects[subject_code].id if subject_code in subjects else None
    for entry in ClassScheduleEntry.query.all():
        if (entry.day, entry.section, entry.period, entry.label) not in expected_keys:
            db.session.delete(entry)
    db.session.commit()


def seed_demo_data():
    if User.query.first():
        synchronize_curriculum()
        synchronize_official_class_timetable()
        return

    cse = Department(name="Computer Science and Engineering", code="CSE")
    ece = Department(name="Electronics and Communication", code="ECE")
    db.session.add_all([cse, ece])
    db.session.flush()

    subjects = [Subject(name=name, code=code, department_id=cse.id) for name, code in CURRICULUM_SUBJECTS]
    db.session.add_all(subjects)
    oa, dbms, dsa = subjects[:3]
    db.session.flush()

    admin_user = User(name="Admin User", email="admin@college.edu", role="admin")
    admin_user.set_password("admin123")
    teacher_user = User(name="Dr. Sharmila Kumari M", email="teacher1@college.edu", role="teacher")
    teacher_user.set_password("teacher123")
    teacher_user_2 = User(name="Mr. Nikhil Rao", email="teacher2@college.edu", role="teacher")
    teacher_user_2.set_password("teacher123")

    student_1 = User(name="Fathima Shazna", email="student1@college.edu", role="student")
    student_1.set_password("student123")
    student_2 = User(name="Fathimath Irshahana", email="student2@college.edu", role="student")
    student_2.set_password("student123")
    student_3 = User(name="Fathimath Shaima", email="student3@college.edu", role="student")
    student_3.set_password("student123")
    student_4 = User(name="Assiya Riha", email="student4@college.edu", role="student")
    student_4.set_password("student123")

    db.session.add_all([admin_user, teacher_user, teacher_user_2, student_1, student_2, student_3, student_4])
    db.session.flush()

    teacher_profile = TeacherProfile(user_id=teacher_user.id, employee_id="TCH-101", department_id=cse.id, designation="Associate Professor")
    teacher_profile_2 = TeacherProfile(user_id=teacher_user_2.id, employee_id="TCH-204", department_id=cse.id, designation="Assistant Professor")
    db.session.add_all([teacher_profile, teacher_profile_2])
    db.session.flush()
    db.session.add(TeacherSubjectAssignment(teacher_id=teacher_profile.id, subject_id=subjects[6].id))

    student_profile_1 = StudentProfile(user_id=student_1.id, roll_number="4PA24CS027", department_id=cse.id, semester=5, section="A", batch="2024")
    student_profile_2 = StudentProfile(user_id=student_2.id, roll_number="4PA24CS028", department_id=cse.id, semester=5, section="A", batch="2024")
    student_profile_3 = StudentProfile(user_id=student_3.id, roll_number="4PA24CS030", department_id=cse.id, semester=5, section="A", batch="2024")
    student_profile_4 = StudentProfile(user_id=student_4.id, roll_number="4PA24CS013", department_id=cse.id, semester=5, section="A", batch="2024")
    db.session.add_all([student_profile_1, student_profile_2, student_profile_3, student_profile_4])
    db.session.flush()

    db.session.add_all([
        StudentSubjectAllocation(student_id=student_profile_1.id, subject_id=oa.id),
        StudentSubjectAllocation(student_id=student_profile_1.id, subject_id=dbms.id),
        StudentSubjectAllocation(student_id=student_profile_2.id, subject_id=oa.id),
        StudentSubjectAllocation(student_id=student_profile_2.id, subject_id=dbms.id),
        StudentSubjectAllocation(student_id=student_profile_3.id, subject_id=oa.id),
        StudentSubjectAllocation(student_id=student_profile_3.id, subject_id=dbms.id),
        StudentSubjectAllocation(student_id=student_profile_4.id, subject_id=oa.id),
        StudentSubjectAllocation(student_id=student_profile_4.id, subject_id=dbms.id),
    ])

    db.session.add_all([
        TimetableEntry(subject_id=oa.id, teacher_id=teacher_profile.id, day="Monday", period=1, room="C-101", class_name="CSE-A"),
        TimetableEntry(subject_id=dbms.id, teacher_id=teacher_profile_2.id, day="Tuesday", period=2, room="C-204", class_name="CSE-A"),
        TimetableEntry(subject_id=dsa.id, teacher_id=teacher_profile.id, day="Wednesday", period=3, room="C-105", class_name="CSE-A"),
    ])

    assessment = Assessment(title="Unit Test 1", subject_id=oa.id, type="IA", max_marks=20, due_date=date(2026, 10, 15))
    db.session.add(assessment)
    db.session.flush()

    db.session.add_all([
        Mark(student_id=student_profile_2.id, subject_id=oa.id, assessment_id=assessment.id, marks_obtained=12, exam_type="IA"),
        Mark(student_id=student_profile_3.id, subject_id=oa.id, assessment_id=assessment.id, marks_obtained=9, exam_type="IA"),
    ])

    assignment = Assignment(title="OS Lab Report", subject_id=oa.id, teacher_id=teacher_profile.id, description="Submit a process scheduling analysis report.", due_date=date(2026, 10, 18))
    db.session.add(assignment)
    db.session.flush()

    from datetime import datetime
    due_today = Assignment(
        title="Computer Networks Lab Submission",
        subject_id=subjects[1].id if 'subjects' in locals() else oa.id,
        teacher_id=teacher_profile.id,
        description="Submit the configured network topology and packet analysis report.",
        due_date=datetime.now().date(),
    )
    db.session.add(due_today)
    db.session.flush()

    db.session.add_all([
        Submission(assignment_id=assignment.id, student_id=student_profile_2.id, file_url=None, status="pending"),
    ])

    notice = Notice(title="Mid-Semester Seminar", content="A seminar on operating systems security will be held on 20 October. Attendance is mandatory.", type="event", department_id=cse.id, semester=5, class_name="CSE-A", target_role="student")
    notice_2 = Notice(title="Holiday Notice", content="College is closed on 18 October for Gandhi Jayanti.", type="notice", department_id=cse.id, semester=None, class_name=None, target_role="all")
    db.session.add_all([notice, notice_2])

    db.session.add_all([
        Notification(user_id=student_2.id, message="Assignment due in 2 days.", type="assignment"),
        Notification(user_id=teacher_user.id, message="Two students need attendance follow-up.", type="reminder"),
    ])

    exam = Examination(name="Semester V Mid-Term Exam", subject_id=oa.id, exam_date=date(2026, 10, 20), start_time="09:00", duration="2 hours", room="C-101")
    db.session.add(exam)
    db.session.flush()

    db.session.add_all([
        ExaminationSeatAllocation(examination_id=exam.id, student_id=student_profile_1.id, room_number="C-101", seat_number="A-01"),
        ExaminationSeatAllocation(examination_id=exam.id, student_id=student_profile_2.id, room_number="C-101", seat_number="A-02"),
    ])

    db.session.commit()
    synchronize_curriculum()
    synchronize_official_class_timetable()
