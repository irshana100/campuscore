import os
from datetime import date, datetime

from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from app import db
from app.auth import auth_required
from app.models import (
    Assessment,
    Assignment,
    AttendanceRecord,
    ClassScheduleEntry,
    CommunicationThread,
    Examination,
    Mark,
    MentoringRecord,
    Notice,
    Notification,
    StudentProfile,
    StudentSubjectAllocation,
    Submission,
    StudentFeedback,
    Subject,
    TeacherProfile,
    TeacherSubjectAssignment,
    TimetableEntry,
    User,
)

teacher_bp = Blueprint("teacher", __name__)
SUBMISSION_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "submissions"))
ALLOWED_SUBMISSION_TYPES = {"pdf", "doc", "docx", "ppt", "pptx", "txt", "zip", "png", "jpg", "jpeg"}
MAX_SUBMISSION_SIZE = 25 * 1024 * 1024


@teacher_bp.route("/teacher/profile", methods=["PATCH"])
@auth_required
def update_teacher_profile():
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    payload = request.get_json(silent=True) or {}
    user = request.current_user
    name = (payload.get("name") or user.name).strip()
    email = (payload.get("email") or user.email).strip().lower()
    if not name or not email or "@" not in email:
        return jsonify({"error": "A valid name and email are required"}), 400
    existing = User.query.filter(User.email == email, User.id != user.id).first()
    if existing:
        return jsonify({"error": "That email address is already in use"}), 409
    new_password = payload.get("new_password") or ""
    if new_password:
        if not user.check_password(payload.get("current_password") or ""):
            return jsonify({"error": "Current password is incorrect"}), 403
        if len(new_password) < 8:
            return jsonify({"error": "New password must contain at least 8 characters"}), 400
        user.set_password(new_password)
    user.name = name
    user.email = email
    db.session.commit()
    return jsonify({"message": "Profile updated", "profile": {"name": user.name, "email": user.email}})


def _teacher():
    if request.current_user.role != "teacher":
        return None
    return TeacherProfile.query.filter_by(user_id=request.current_user.id).first()


def _assignment(teacher, subject_id):
    return TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, TeacherSubjectAssignment.subject_id == subject_id, Subject.is_active.is_(True)).first()


def _assigned_subject_ids(teacher):
    if not teacher:
        return []
    return [item.subject_id for item in TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()]


def _enrolled_students(subject_id, section=None):
    rows = (
        db.session.query(StudentProfile, User)
        .join(User, User.id == StudentProfile.user_id)
        .join(StudentSubjectAllocation, StudentSubjectAllocation.student_id == StudentProfile.id)
        .filter(StudentSubjectAllocation.subject_id == subject_id, User.is_active.is_(True))
        .order_by(StudentProfile.roll_number)
        .all()
    )
    return [(student, user) for student, user in rows if not section or student.section == section]


def _student_ids(teacher, subject_id):
    assignment = _assignment(teacher, subject_id)
    if not assignment:
        return set()
    return {student.id for student, _ in _enrolled_students(subject_id, assignment.section)}


def _date(value):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _subject_payload(subject, assignment):
    students = _enrolled_students(subject.id, assignment.section)
    return {
        "id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "section": assignment.section,
        "students": [{
            "id": student.id,
            "name": user.name,
            "roll_number": student.roll_number,
            "section": student.section,
            "semester": student.semester,
        } for student, user in students],
        "student_count": len(students),
    }


def _teacher_subject_or_error(teacher, subject_id):
    try:
        subject_id = int(subject_id)
    except (TypeError, ValueError):
        subject_id = 0
    if not teacher or not subject_id:
        return None, (jsonify({"error": "A valid assigned subject is required"}), 400)
    assignment = _assignment(teacher, subject_id)
    if not assignment:
        return None, (jsonify({"error": "You are not assigned to this subject"}), 403)
    subject = Subject.query.get(subject_id)
    if not subject:
        return None, (jsonify({"error": "Subject not found"}), 404)
    return (assignment, subject), None


@teacher_bp.route("/teacher/subjects", methods=["GET"])
@auth_required
def _teacher_subjects():
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    assignments = TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()
    subjects = []
    for assignment in assignments:
        subject = Subject.query.get(assignment.subject_id)
        if subject:
            subjects.append(_subject_payload(subject, assignment))
    return jsonify({"subjects": subjects})


@teacher_bp.route("/teacher/attendance", methods=["GET", "PUT"])
@auth_required
def teacher_attendance():
    user = getattr(request, "current_user", None)
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    teacher = _teacher()
    subject_id = request.args.get("subject_id", type=int) if request.method == "GET" else (request.get_json(silent=True) or {}).get("subject_id")
    subject_data, error = _teacher_subject_or_error(teacher, subject_id)
    if error:
        return error
    assignment, subject = subject_data
    students = _enrolled_students(subject.id, assignment.section)

    if request.method == "GET":
        attendance_date = _date(request.args.get("date")) or date.today()
        records = AttendanceRecord.query.filter_by(subject_id=subject.id).all()
        payload = []
        for student, student_user in students:
            own_records = [row for row in records if row.student_id == student.id]
            requested_period = request.args.get("period", type=int)
            today_record = next((row for row in own_records if row.date == attendance_date and (requested_period is None or row.period == requested_period)), None)
            present = sum(1 for row in own_records if row.status in {"present", "late"})
            percentage = round((present / len(own_records)) * 100, 2) if own_records else 0
            payload.append({
                "id": student.id,
                "name": student_user.name,
                "roll_number": student.roll_number,
                "section": student.section,
                "present": present,
                "total": len(own_records),
                "percentage": percentage,
                "status": today_record.status if today_record else "",
                "period": today_record.period if today_record else None,
            })
        sections = {student.section for student, _ in students if student.section}
        schedule_query = ClassScheduleEntry.query.filter(ClassScheduleEntry.day == attendance_date.strftime("%A"), ClassScheduleEntry.section.in_(sections), ClassScheduleEntry.subject_id == subject.id) if sections else ClassScheduleEntry.query.filter(db.false())
        requested_period = request.args.get("period", type=int)
        schedule_entries = schedule_query.order_by(ClassScheduleEntry.section, ClassScheduleEntry.period).all()
        if requested_period is not None:
            schedule_entries = [item for item in schedule_entries if item.period <= requested_period < item.period + item.duration_periods]
        schedule = [{"section": item.section, "period": item.period, "duration_periods": item.duration_periods, "label": item.label} for item in schedule_entries]
        return jsonify({"subject": {"id": subject.id, "name": subject.name, "code": subject.code}, "date": attendance_date.isoformat(), "schedule": schedule, "students": payload})

    payload = request.get_json(silent=True) or {}
    attendance_date = _date(payload.get("date"))
    rows = payload.get("records")
    if not attendance_date or not isinstance(rows, list) or not rows:
        return jsonify({"error": "A valid date and at least one attendance record are required"}), 400
    valid_students = _student_ids(teacher, subject.id)
    period = payload.get("period")
    for row in rows:
        student_id = row.get("student_id")
        status = (row.get("status") or "").lower()
        if student_id not in valid_students or status not in {"present", "absent", "late"}:
            return jsonify({"error": "Attendance contains an invalid student or status"}), 400
    for row in rows:
        student_id = row["student_id"]
        status = row["status"].lower()
        record = AttendanceRecord.query.filter_by(student_id=student_id, subject_id=subject.id, date=attendance_date, period=period).first()
        if record:
            record.status = status
        else:
            db.session.add(AttendanceRecord(student_id=student_id, subject_id=subject.id, date=attendance_date, period=period, status=status))
        if status == "absent":
            student = StudentProfile.query.get(student_id)
            db.session.add(Notification(user_id=student.user_id, message=f"You were marked absent for {subject.name} on {attendance_date.isoformat()}.", type="attendance"))
    db.session.commit()
    return jsonify({"message": "Attendance saved", "updated": len(rows)})


@teacher_bp.route("/teacher/assignments", methods=["GET", "POST"])
@auth_required
def teacher_assignments():
    user = getattr(request, "current_user", None)
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        subject_data, error = _teacher_subject_or_error(teacher, payload.get("subject_id"))
        if error:
            return error
        assignment, subject = subject_data
        title = (payload.get("title") or "").strip()
        due_date = _date(payload.get("due_date"))
        try:
            max_marks = float(payload.get("max_marks", 100))
        except (TypeError, ValueError):
            max_marks = 0
        if not title or not due_date or max_marks <= 0:
            return jsonify({"error": "Title, valid deadline, and positive maximum marks are required"}), 400
        item = Assignment(title=title, description=(payload.get("description") or "").strip(), subject_id=subject.id, teacher_id=teacher.id, section=assignment.section, due_date=due_date, max_marks=max_marks)
        db.session.add(item)
        for student, _ in _enrolled_students(subject.id, assignment.section):
            db.session.add(Notification(user_id=student.user_id, message=f"New assignment: {title} ({subject.name})", type="assignment"))
        db.session.commit()
        return jsonify({"message": "Assignment published", "assignment": {"id": item.id, "title": item.title}}), 201

    assigned_ids = _assigned_subject_ids(teacher)
    assignments = Assignment.query.filter(Assignment.teacher_id == teacher.id, Assignment.subject_id.in_(assigned_ids)).order_by(Assignment.due_date.asc()).all() if assigned_ids else []
    result = []
    for item in assignments:
        subject = Subject.query.get(item.subject_id)
        submissions = Submission.query.filter_by(assignment_id=item.id).order_by(Submission.submitted_at.desc()).all()
        if item.section:
            submissions = [submission for submission in submissions if (StudentProfile.query.get(submission.student_id) and StudentProfile.query.get(submission.student_id).section == item.section)]
        result.append({
            "id": item.id,
            "title": item.title,
            "description": item.description or "",
            "subject_id": item.subject_id,
            "subject": subject.name if subject else "Unknown subject",
            "due_date": item.due_date.isoformat(),
            "max_marks": item.max_marks,
            "submissions": [{
                "id": submission.id,
                "student_id": submission.student_id,
                "student_name": (User.query.get(StudentProfile.query.get(submission.student_id).user_id).name if StudentProfile.query.get(submission.student_id) else "Unknown student"),
                "roll_number": StudentProfile.query.get(submission.student_id).roll_number if StudentProfile.query.get(submission.student_id) else "",
                "status": submission.status,
                "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                "marks_obtained": submission.marks_obtained,
                "feedback": submission.feedback,
                "download_url": f"/api/teacher/submissions/{submission.id}/download" if submission.file_url else None,
            } for submission in submissions],
        })
    return jsonify({"assignments": result})


@teacher_bp.route("/teacher/examinations", methods=["GET", "POST"])
@auth_required
def teacher_examinations():
    user = request.current_user
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    assigned_ids = _assigned_subject_ids(teacher)
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        subject_data, error = _teacher_subject_or_error(teacher, payload.get("subject_id"))
        if error:
            return error
        assignment, subject = subject_data
        exam_date = _date(payload.get("exam_date"))
        name = (payload.get("name") or "").strip()
        start_time = (payload.get("start_time") or "").strip()
        duration = (payload.get("duration") or "").strip()
        room = (payload.get("room") or "").strip()
        if not exam_date or not name or not start_time or not duration or not room:
            return jsonify({"error": "Exam name, date, time, duration, and room are required"}), 400
        item = Examination(name=name, subject_id=subject.id, exam_date=exam_date, start_time=start_time, duration=duration, room=room)
        db.session.add(item)
        for student, _ in _enrolled_students(subject.id, assignment.section):
            db.session.add(Notification(user_id=student.user_id, message=f"Examination scheduled: {name} ({subject.name}) on {exam_date.isoformat()}.", type="examination"))
        db.session.commit()
        return jsonify({"message": "Examination scheduled", "id": item.id}), 201
    exams = Examination.query.filter(Examination.subject_id.in_(assigned_ids)).order_by(Examination.exam_date.asc()).all() if assigned_ids else []
    return jsonify({"examinations": [{"id": item.id, "name": item.name, "subject_id": item.subject_id, "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "exam_date": item.exam_date.isoformat(), "start_time": item.start_time, "duration": item.duration, "room": item.room} for item in exams]})


@teacher_bp.route("/student/examinations", methods=["GET"])
@auth_required
def student_examinations():
    user = request.current_user
    if user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    student = StudentProfile.query.filter_by(user_id=user.id).first()
    subject_ids = [item.id for item in Subject.query.join(StudentSubjectAllocation, StudentSubjectAllocation.subject_id == Subject.id).filter(StudentSubjectAllocation.student_id == student.id, Subject.is_active.is_(True)).all()] if student else []
    exams = Examination.query.filter(Examination.subject_id.in_(subject_ids), Examination.exam_date >= date.today()).order_by(Examination.exam_date.asc()).all() if subject_ids else []
    return jsonify({"examinations": [{"id": item.id, "name": item.name, "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "exam_date": item.exam_date.isoformat(), "start_time": item.start_time, "duration": item.duration, "room": item.room} for item in exams]})


@teacher_bp.route("/student/assignments/<int:assignment_id>/submissions", methods=["POST"])
@auth_required
def submit_assignment(assignment_id):
    user = getattr(request, "current_user", None)
    if not user or user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    student = StudentProfile.query.filter_by(user_id=user.id).first()
    assignment = Assignment.query.get_or_404(assignment_id)
    subject = Subject.query.filter_by(id=assignment.subject_id, is_active=True).first()
    if not subject or not student or (assignment.section and assignment.section != student.section) or not StudentSubjectAllocation.query.filter_by(student_id=student.id, subject_id=assignment.subject_id).first():
        return jsonify({"error": "You are not enrolled in this assignment subject"}), 403
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Choose a file to submit"}), 400
    extension = uploaded.filename.rsplit(".", 1)[-1].lower() if "." in uploaded.filename else ""
    if extension not in ALLOWED_SUBMISSION_TYPES:
        return jsonify({"error": "Unsupported submission file type"}), 400
    uploaded.stream.seek(0, os.SEEK_END)
    if uploaded.stream.tell() > MAX_SUBMISSION_SIZE:
        return jsonify({"error": "Submission exceeds 25 MB"}), 400
    uploaded.stream.seek(0)
    os.makedirs(SUBMISSION_FOLDER, exist_ok=True)
    filename = secure_filename(uploaded.filename)
    stored_path = os.path.join(SUBMISSION_FOLDER, f"{student.id}_{assignment.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{filename}")
    uploaded.save(stored_path)
    submission = Submission.query.filter_by(assignment_id=assignment.id, student_id=student.id).first()
    if not submission:
        submission = Submission(assignment_id=assignment.id, student_id=student.id)
        db.session.add(submission)
    submission.file_url = stored_path
    submission.submitted_at = datetime.utcnow()
    submission.status = "submitted"
    submission.marks_obtained = None
    submission.feedback = None
    teacher = TeacherProfile.query.get(assignment.teacher_id)
    if teacher:
        db.session.add(Notification(user_id=teacher.user_id, message=f"A submission was received for {assignment.title}.", type="assignment_submission"))
    db.session.commit()
    return jsonify({"message": "Assignment submitted successfully"}), 201


@teacher_bp.route("/teacher/submissions/<int:submission_id>/download", methods=["GET"])
@auth_required
def download_submission(submission_id):
    user = getattr(request, "current_user", None)
    teacher = _teacher()
    submission = Submission.query.get_or_404(submission_id)
    assignment = Assignment.query.get_or_404(submission.assignment_id)
    if not user or not teacher or assignment.teacher_id != teacher.id or not _assignment(teacher, assignment.subject_id):
        return jsonify({"error": "You are not authorized to download this submission"}), 403
    if not submission.file_url or not os.path.isfile(submission.file_url):
        return jsonify({"error": "Submission file not found"}), 404
    return send_file(submission.file_url, as_attachment=True, download_name=os.path.basename(submission.file_url))


@teacher_bp.route("/teacher/submissions/<int:submission_id>/evaluate", methods=["POST"])
@auth_required
def evaluate_submission(submission_id):
    user = getattr(request, "current_user", None)
    teacher = _teacher()
    submission = Submission.query.get_or_404(submission_id)
    assignment = Assignment.query.get_or_404(submission.assignment_id)
    if not user or not teacher or assignment.teacher_id != teacher.id or not _assignment(teacher, assignment.subject_id):
        return jsonify({"error": "You are not authorized to evaluate this submission"}), 403
    payload = request.get_json(silent=True) or {}
    try:
        marks = float(payload.get("marks_obtained"))
    except (TypeError, ValueError):
        return jsonify({"error": "A valid mark is required"}), 400
    if marks < 0 or marks > assignment.max_marks:
        return jsonify({"error": f"Marks must be between 0 and {assignment.max_marks:g}"}), 400
    submission.marks_obtained = marks
    submission.feedback = (payload.get("feedback") or "").strip()
    submission.status = "evaluated"
    student = StudentProfile.query.get(submission.student_id)
    if student:
        db.session.add(Notification(user_id=student.user_id, message=f"Your assignment '{assignment.title}' has been evaluated.", type="assignment_result"))
    db.session.commit()
    return jsonify({"message": "Evaluation saved"})


@teacher_bp.route("/teacher/assessments", methods=["GET", "POST"])
@auth_required
def teacher_assessments():
    user = getattr(request, "current_user", None)
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    assigned_ids = _assigned_subject_ids(teacher)
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        subject_data, error = _teacher_subject_or_error(teacher, payload.get("subject_id"))
        if error:
            return error
        _, subject = subject_data
        due_date = _date(payload.get("due_date"))
        title = (payload.get("title") or "").strip()
        assessment_type = (payload.get("type") or "Internal Assessment").strip()
        try:
            max_marks = float(payload.get("max_marks"))
        except (TypeError, ValueError):
            max_marks = 0
        if not title or not due_date or max_marks <= 0:
            return jsonify({"error": "Title, due date, and positive maximum marks are required"}), 400
        item = Assessment(title=title, subject_id=subject.id, type=assessment_type, max_marks=max_marks, due_date=due_date)
        db.session.add(item)
        db.session.commit()
        return jsonify({"message": "Assessment created", "assessment_id": item.id}), 201

    assessments = Assessment.query.filter(Assessment.subject_id.in_(assigned_ids)).order_by(Assessment.due_date.desc()).all() if assigned_ids else []
    return jsonify({"assessments": [{
        "id": item.id,
        "title": item.title,
        "subject_id": item.subject_id,
        "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject",
        "type": item.type,
        "max_marks": item.max_marks,
        "due_date": item.due_date.isoformat(),
        "published": item.published,
        "marks": [{"student_id": mark.student_id, "marks_obtained": mark.marks_obtained} for mark in Mark.query.filter_by(assessment_id=item.id).all()],
    } for item in assessments]})


@teacher_bp.route("/teacher/assessments/<int:assessment_id>/marks", methods=["PUT"])
@auth_required
def save_assessment_marks(assessment_id):
    user = getattr(request, "current_user", None)
    teacher = _teacher()
    assessment = Assessment.query.get_or_404(assessment_id)
    if not user or not teacher or not _assignment(teacher, assessment.subject_id):
        return jsonify({"error": "You are not authorized to update these marks"}), 403
    payload = request.get_json(silent=True) or {}
    rows = payload.get("records", [])
    allowed_students = _student_ids(teacher, assessment.subject_id)
    for row in rows:
        try:
            marks = float(row.get("marks_obtained"))
            student_id = int(row.get("student_id"))
        except (TypeError, ValueError):
            return jsonify({"error": "Each mark must be numeric"}), 400
        if student_id not in allowed_students or marks < 0 or marks > assessment.max_marks:
            return jsonify({"error": "Marks include an unauthorized student or exceed the maximum"}), 400
    for row in rows:
        student_id = int(row["student_id"])
        mark = Mark.query.filter_by(assessment_id=assessment.id, student_id=student_id).first()
        if not mark:
            mark = Mark(student_id=student_id, subject_id=assessment.subject_id, assessment_id=assessment.id, exam_type=assessment.type)
            db.session.add(mark)
        mark.marks_obtained = float(row["marks_obtained"])
    should_publish = bool(payload.get("published", assessment.published))
    if should_publish and not assessment.published:
        for student_id in allowed_students:
            student = StudentProfile.query.get(student_id)
            if student:
                db.session.add(Notification(user_id=student.user_id, message=f"Marks published for {assessment.title}.", type="marks"))
    assessment.published = should_publish
    db.session.commit()
    return jsonify({"message": "Marks saved", "published": assessment.published})


@teacher_bp.route("/student/results", methods=["GET"])
@auth_required
def student_results():
    user = getattr(request, "current_user", None)
    if not user or user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    student = StudentProfile.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({"results": []})
    marks = Mark.query.filter_by(student_id=student.id).all()
    results = []
    for mark in marks:
        assessment = Assessment.query.get(mark.assessment_id)
        if not assessment or not assessment.published:
            continue
        subject = Subject.query.get(mark.subject_id)
        results.append({"id": mark.id, "title": assessment.title, "type": assessment.type, "subject": subject.name if subject else "Unknown subject", "marks_obtained": mark.marks_obtained, "max_marks": assessment.max_marks, "due_date": assessment.due_date.isoformat()})
    return jsonify({"results": results})


@teacher_bp.route("/teacher/notices", methods=["GET", "POST"])
@auth_required
def teacher_notices():
    user = getattr(request, "current_user", None)
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        subject_data, error = _teacher_subject_or_error(teacher, payload.get("subject_id"))
        if error:
            return error
        assignment, subject = subject_data
        title = (payload.get("title") or "").strip()
        content = (payload.get("content") or "").strip()
        if not title or not content:
            return jsonify({"error": "Notice title and description are required"}), 400
        item = Notice(title=title, content=content, type=(payload.get("type") or "Announcement").strip(), department_id=subject.department_id, semester=payload.get("semester"), class_name=assignment.section, subject_id=subject.id, teacher_id=teacher.id, target_role="student")
        db.session.add(item)
        for student, _ in _enrolled_students(subject.id, assignment.section):
            db.session.add(Notification(user_id=student.user_id, message=f"New notice: {title}", type="notice"))
        db.session.commit()
        return jsonify({"message": "Notice published", "id": item.id}), 201
    notices = [item for item in Notice.query.filter_by(teacher_id=teacher.id).order_by(Notice.published_at.desc()).all() if not item.subject_id or Subject.query.filter_by(id=item.subject_id, is_active=True).first()]
    return jsonify({"notices": [{"id": item.id, "title": item.title, "content": item.content, "type": item.type, "subject_id": item.subject_id, "subject": Subject.query.get(item.subject_id).name if item.subject_id and Subject.query.get(item.subject_id) else "General", "published_at": item.published_at.isoformat()} for item in notices]})


@teacher_bp.route("/student/notices", methods=["GET"])
@auth_required
def student_notices():
    user = getattr(request, "current_user", None)
    if not user or user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    student = StudentProfile.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({"notices": []})
    enrolled_ids = {item.id for item in Subject.query.join(StudentSubjectAllocation, StudentSubjectAllocation.subject_id == Subject.id).filter(StudentSubjectAllocation.student_id == student.id, Subject.is_active.is_(True)).all()}
    notices = Notice.query.filter(Notice.target_role.in_(["student", "all"])).order_by(Notice.published_at.desc()).all()
    visible = []
    for item in notices:
        if item.subject_id:
            if item.subject_id not in enrolled_ids:
                continue
            if item.class_name and student.section and not item.class_name.endswith(f"-{student.section}"):
                continue
        elif item.department_id and item.department_id != student.department_id:
            continue
        elif item.semester and item.semester != student.semester:
            continue
        elif item.class_name and student.section and not item.class_name.endswith(f"-{student.section}"):
            continue
        visible.append({"id": item.id, "title": item.title, "content": item.content, "type": item.type, "published_at": item.published_at.isoformat(), "subject_id": item.subject_id})
    return jsonify({"notices": visible})


@teacher_bp.route("/teacher/timetable", methods=["GET", "POST"])
@auth_required
def teacher_timetable():
    user = getattr(request, "current_user", None)
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        subject_data, error = _teacher_subject_or_error(teacher, payload.get("subject_id"))
        if error:
            return error
        assignment, subject = subject_data
        day = (payload.get("day") or "").strip()
        room = (payload.get("room") or "").strip()
        class_name = (payload.get("class_name") or "").strip()
        try:
            period = int(payload.get("period"))
        except (TypeError, ValueError):
            period = 0
        if not day or not room or not class_name or period < 1:
            return jsonify({"error": "Day, period, classroom, and class are required"}), 400
        if assignment.section and not class_name.endswith(f"-{assignment.section}"):
            return jsonify({"error": "Class does not match your assigned section"}), 403
        item = TimetableEntry(subject_id=subject.id, teacher_id=teacher.id, day=day, period=period, room=room, class_name=class_name)
        db.session.add(item)
        db.session.commit()
        return jsonify({"message": "Timetable entry added", "id": item.id}), 201
    active_subject_ids = _assigned_subject_ids(teacher)
    entries = TimetableEntry.query.filter(TimetableEntry.teacher_id == teacher.id, TimetableEntry.subject_id.in_(active_subject_ids)).order_by(TimetableEntry.day, TimetableEntry.period).all() if active_subject_ids else []
    return jsonify({"timetable": [{"id": item.id, "subject_id": item.subject_id, "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "day": item.day, "period": item.period, "room": item.room, "class_name": item.class_name} for item in entries]})


@teacher_bp.route("/teacher/timetable/<int:entry_id>", methods=["PATCH", "DELETE"])
@auth_required
def update_teacher_timetable(entry_id):
    teacher = _teacher()
    entry = TimetableEntry.query.get_or_404(entry_id)
    if not teacher or entry.teacher_id != teacher.id:
        return jsonify({"error": "You are not authorized to update this timetable entry"}), 403
    if request.method == "DELETE":
        db.session.delete(entry)
        db.session.commit()
        return jsonify({"message": "Timetable entry removed"})
    payload = request.get_json(silent=True) or {}
    try:
        subject_id = int(payload.get("subject_id", entry.subject_id))
        period = int(payload.get("period", entry.period))
    except (TypeError, ValueError):
        return jsonify({"error": "Choose a valid subject and period"}), 400
    subject_data, error = _teacher_subject_or_error(teacher, subject_id)
    if error:
        return error
    assignment, subject = subject_data
    day = (payload.get("day", entry.day) or "").strip()
    room = (payload.get("room", entry.room) or "").strip()
    class_name = (payload.get("class_name", entry.class_name) or "").strip()
    if period < 1 or not day or not room or not class_name:
        return jsonify({"error": "Day, period, classroom, and class are required"}), 400
    if assignment.section and not class_name.endswith(f"-{assignment.section}"):
        return jsonify({"error": "Class does not match your assigned section"}), 403
    entry.subject_id = subject.id
    entry.day = day
    entry.period = period
    entry.room = room
    entry.class_name = class_name
    db.session.commit()
    return jsonify({"message": "Timetable entry updated"})


@teacher_bp.route("/student/timetable", methods=["GET"])
@auth_required
def student_timetable():
    user = getattr(request, "current_user", None)
    if not user or user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    student = StudentProfile.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({"timetable": []})
    entries = ClassScheduleEntry.query.filter_by(section=student.section).order_by(ClassScheduleEntry.day, ClassScheduleEntry.period).all()
    return jsonify({"timetable": [{"id": item.id, "subject_id": item.subject_id, "subject": item.label, "day": item.day, "period": item.period, "duration_periods": item.duration_periods, "room": item.room or "", "section": item.section, "class_name": f"CSE-{item.section}"} for item in entries]})


@teacher_bp.route("/student/feedback", methods=["GET", "POST"])
@auth_required
def student_feedback():
    user = request.current_user
    if user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    student = StudentProfile.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({"feedback": []})
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        try:
            subject_id = int(payload.get("subject_id"))
        except (TypeError, ValueError):
            subject_id = 0
        content = (payload.get("content") or "").strip()
        category = (payload.get("category") or "Academic").strip()
        subject = Subject.query.filter_by(id=subject_id, is_active=True).first()
        enrolled = StudentSubjectAllocation.query.filter_by(student_id=student.id, subject_id=subject_id).first()
        assignment = TeacherSubjectAssignment.query.filter_by(subject_id=subject_id).order_by(TeacherSubjectAssignment.teacher_id).first() if subject else None
        if not content or not enrolled or not assignment:
            return jsonify({"error": "Choose an enrolled subject and enter feedback"}), 400
        item = StudentFeedback(student_id=student.id, teacher_id=assignment.teacher_id, subject_id=subject_id, category=category, content=content)
        db.session.add(item)
        teacher = TeacherProfile.query.get(assignment.teacher_id)
        if teacher:
            db.session.add(Notification(user_id=teacher.user_id, message=f"New student feedback for {subject.name}.", type="student_feedback"))
        db.session.commit()
        return jsonify({"message": "Feedback submitted"}), 201
    items = StudentFeedback.query.filter_by(student_id=student.id).order_by(StudentFeedback.created_at.desc()).all()
    return jsonify({"feedback": [{"id": item.id, "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "category": item.category, "content": item.content, "teacher_reply": item.teacher_reply, "created_at": item.created_at.isoformat(), "replied_at": item.replied_at.isoformat() if item.replied_at else None} for item in items]})


@teacher_bp.route("/teacher/feedback", methods=["GET"])
@auth_required
def teacher_feedback():
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    items = StudentFeedback.query.filter_by(teacher_id=teacher.id).order_by(StudentFeedback.created_at.desc()).all()
    result = []
    for item in items:
        student = StudentProfile.query.get(item.student_id)
        student_user = User.query.get(student.user_id) if student else None
        result.append({"id": item.id, "student_name": student_user.name if student_user else "Unknown student", "roll_number": student.roll_number if student else "", "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "category": item.category, "content": item.content, "teacher_reply": item.teacher_reply, "created_at": item.created_at.isoformat()})
    return jsonify({"feedback": result})


@teacher_bp.route("/teacher/feedback/<int:feedback_id>/reply", methods=["PATCH"])
@auth_required
def reply_to_feedback(feedback_id):
    teacher = _teacher()
    item = StudentFeedback.query.get_or_404(feedback_id)
    if not teacher or item.teacher_id != teacher.id:
        return jsonify({"error": "You are not authorized to reply to this feedback"}), 403
    reply = ((request.get_json(silent=True) or {}).get("reply") or "").strip()
    if not reply:
        return jsonify({"error": "A reply is required"}), 400
    item.teacher_reply = reply
    item.replied_at = datetime.utcnow()
    student = StudentProfile.query.get(item.student_id)
    if student:
        db.session.add(Notification(user_id=student.user_id, message="Your teacher replied to your feedback.", type="feedback_reply"))
    db.session.commit()
    return jsonify({"message": "Reply sent"})


@teacher_bp.route("/teacher/mentoring", methods=["GET", "POST"])
@auth_required
def teacher_mentoring():
    teacher = _teacher()
    if not teacher:
        return jsonify({"error": "Teacher profile required"}), 403
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        subject_data, error = _teacher_subject_or_error(teacher, payload.get("subject_id"))
        if error:
            return error
        assignment, subject = subject_data
        try:
            student_id = int(payload.get("student_id"))
        except (TypeError, ValueError):
            student_id = 0
        if student_id not in _student_ids(teacher, subject.id):
            return jsonify({"error": "Student is not enrolled in your assigned subject"}), 403
        notes = (payload.get("notes") or "").strip()
        session_value = (payload.get("session_at") or "").strip()
        try:
            session_at = datetime.fromisoformat(session_value) if session_value else None
        except ValueError:
            return jsonify({"error": "Enter a valid mentoring session date and time"}), 400
        if not notes and not session_at:
            return jsonify({"error": "Add a private note or schedule a session"}), 400
        item = MentoringRecord(teacher_id=teacher.id, student_id=student_id, subject_id=subject.id, notes=notes, session_at=session_at)
        db.session.add(item)
        if session_at:
            student = StudentProfile.query.get(student_id)
            db.session.add(Notification(user_id=student.user_id, message=f"A mentoring session for {subject.name} was scheduled.", type="mentoring"))
        db.session.commit()
        return jsonify({"message": "Mentoring record saved"}), 201
    records = MentoringRecord.query.filter_by(teacher_id=teacher.id).order_by(MentoringRecord.session_at.desc(), MentoringRecord.created_at.desc()).all()
    result = []
    for item in records:
        student = StudentProfile.query.get(item.student_id)
        student_user = User.query.get(student.user_id) if student else None
        result.append({"id": item.id, "student_id": item.student_id, "student_name": student_user.name if student_user else "Unknown student", "roll_number": student.roll_number if student else "", "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "notes": item.notes or "", "session_at": item.session_at.isoformat() if item.session_at else None})
    return jsonify({"mentoring": result})


@teacher_bp.route("/student/mentoring", methods=["GET"])
@auth_required
def student_mentoring():
    user = request.current_user
    if user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    student = StudentProfile.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({"sessions": []})
    records = MentoringRecord.query.filter_by(student_id=student.id).filter(MentoringRecord.session_at.isnot(None)).order_by(MentoringRecord.session_at.asc()).all()
    result = []
    for item in records:
        teacher = TeacherProfile.query.get(item.teacher_id)
        teacher_user = User.query.get(teacher.user_id) if teacher else None
        result.append({"id": item.id, "teacher": teacher_user.name if teacher_user else "Faculty", "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "session_at": item.session_at.isoformat()})
    return jsonify({"sessions": result})