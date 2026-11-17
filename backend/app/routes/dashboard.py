from datetime import date
from flask import Blueprint, jsonify, request
from app import db
from app.auth import auth_required, role_required
from app.models import Notice, Notification, User, StudentProfile, TeacherProfile, Department, StudentSubjectAllocation, Subject, AttendanceRecord, Assignment, Submission, TimetableEntry, Examination, TeacherSubjectAssignment, CommunicationThread, StudyMaterial, CommunicationMessage
from app.services.analytics import compute_attendance_summary, attendance_threshold_projection


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/dashboard", methods=["GET"])
@auth_required
def dashboard():
    user = request.current_user
    if user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        subjects = Subject.query.join(StudentSubjectAllocation, StudentSubjectAllocation.subject_id == Subject.id).filter(StudentSubjectAllocation.student_id == profile.id, Subject.is_active.is_(True)).all()
        subject_ids = [item.id for item in subjects]
        attendance = AttendanceRecord.query.filter(AttendanceRecord.student_id == profile.id, AttendanceRecord.subject_id.in_(subject_ids)).all() if subject_ids else []
        records = [{"subject_id": item.subject_id, "status": item.status} for item in attendance]
        summary = compute_attendance_summary(records)
        notices = Notice.query.filter(Notice.target_role.in_(["student", "all"])).order_by(Notice.published_at.desc()).all()
        visible_notices = []
        for notice in notices:
            if notice.subject_id and notice.subject_id not in subject_ids:
                continue
            if notice.department_id and notice.department_id != profile.department_id:
                continue
            if notice.semester and notice.semester != profile.semester:
                continue
            if notice.class_name and profile.section and not notice.class_name.endswith(f"-{profile.section}"):
                continue
            visible_notices.append(notice)
        assignments = Assignment.query.filter(Assignment.subject_id.in_(subject_ids)).order_by(Assignment.due_date.asc()).all() if subject_ids else []
        assignments = [item for item in assignments if not item.section or item.section == profile.section]
        assignment_data = []
        for assignment in assignments:
            submission = Submission.query.filter_by(assignment_id=assignment.id, student_id=profile.id).first()
            is_submitted = bool(submission and submission.status.lower() != "pending")
            subject = Subject.query.get(assignment.subject_id)
            assignment_data.append({
                "id": assignment.id,
                "title": assignment.title,
                "subject": subject.name if subject else "General",
                "description": assignment.description or "",
                "due_date": str(assignment.due_date),
                "max_marks": assignment.max_marks,
                "submitted": is_submitted,
                "status": "Submitted" if is_submitted else "Pending",
                "marks_obtained": submission.marks_obtained if submission else None,
                "feedback": submission.feedback if submission else None,
            })
        department = Department.query.get(profile.department_id)
        class_name = f"{department.code}-{profile.section}" if department and profile.section else None
        timetable_query = TimetableEntry.query.filter(TimetableEntry.subject_id.in_(subject_ids)) if subject_ids else TimetableEntry.query.filter(db.false())
        if class_name:
            timetable_query = timetable_query.filter_by(class_name=class_name)
        agenda = timetable_query.order_by(TimetableEntry.period).all()
        today = date.today().strftime("%A")
        today_agenda = [item for item in agenda if item.day.lower() == today.lower()]
        upcoming_exams = Examination.query.filter(Examination.subject_id.in_(subject_ids), Examination.exam_date >= date.today()).order_by(Examination.exam_date.asc()).limit(5).all() if subject_ids else []
        subject_names = {item.id: item.name for item in Subject.query.all()}
        summary_by_subject = {item["subject_id"]: item for item in summary}
        attendance_summary = [{
            "subject_id": subject.id,
            "subject_name": subject.name,
            "percentage": summary_by_subject.get(subject.id, {}).get("percentage", 0),
            "present": summary_by_subject.get(subject.id, {}).get("present", 0),
            "total": summary_by_subject.get(subject.id, {}).get("total", 0),
            "absent": max(
                0,
                summary_by_subject.get(subject.id, {}).get("total", 0)
                - summary_by_subject.get(subject.id, {}).get("present", 0),
            ),
        } for subject in subjects]
        return jsonify({
            "role": "student",
            "profile": {"name": user.name, "semester": profile.semester, "section": profile.section, "usn": profile.roll_number, "batch": profile.batch},
            "attendance_summary": attendance_summary,
            "attendance_projection": attendance_threshold_projection(records),
            "notices": [{"id": item.id, "title": item.title, "content": item.content, "type": item.type, "published_at": item.published_at.isoformat() if item.published_at else None} for item in visible_notices[:5]],
            "assignments": assignment_data,
            "pending_assignments": [item for item in assignment_data if not item["submitted"]],
            "today_timetable": [{"id": item.id, "day": item.day, "room": item.room, "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "period": item.period} for item in today_agenda],
            "upcoming_examinations": [{"id": item.id, "name": item.name, "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject", "date": item.exam_date.isoformat(), "start_time": item.start_time, "room": item.room} for item in upcoming_exams],
            "subjects": [{"id": item.id, "name": item.name, "code": item.code} for item in subjects],
        })

    if user.role == "teacher":
        profile = TeacherProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return jsonify({"error": "Teacher profile not found"}), 404
        assignments = TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == profile.id, Subject.is_active.is_(True)).all()
        subject_ids = [item.subject_id for item in assignments]
        subjects = Subject.query.filter(Subject.id.in_(subject_ids)).all() if subject_ids else []
        agenda = TimetableEntry.query.filter(TimetableEntry.teacher_id == profile.id, TimetableEntry.subject_id.in_(subject_ids)).all() if subject_ids else []
        today = date.today().strftime("%A")
        today_agenda = [item for item in agenda if item.day.lower() == today.lower()]
        timetable = []
        for item in agenda:
            subject = Subject.query.get(item.subject_id)
            timetable.append({"id": item.id, "day": item.day, "room": item.room, "period": item.period, "class_name": item.class_name, "subject": subject.name if subject else f"Subject {item.subject_id}", "subject_code": subject.code if subject else ""})
        queries = CommunicationThread.query.filter_by(teacher_id=profile.id).all()
        unread_queries = CommunicationMessage.query.join(CommunicationThread, CommunicationMessage.thread_id == CommunicationThread.id).filter(CommunicationThread.teacher_id == profile.id, CommunicationMessage.sender_id != user.id, CommunicationMessage.read_at.is_(None)).count()
        materials = StudyMaterial.query.filter_by(teacher_id=profile.id).all()
        notices = Notice.query.filter_by(teacher_id=profile.id).order_by(Notice.published_at.desc()).limit(5).all()
        enrolled_profiles = StudentProfile.query.join(User, User.id == StudentProfile.user_id).join(StudentSubjectAllocation, StudentSubjectAllocation.student_id == StudentProfile.id).filter(StudentSubjectAllocation.subject_id.in_(subject_ids), User.is_active.is_(True)).all() if subject_ids else []
        section_by_subject = {item.subject_id: item.section for item in assignments}
        assigned_student_ids = set()
        for student in enrolled_profiles:
            student_subjects = StudentSubjectAllocation.query.filter_by(student_id=student.id).all()
            if any(subject_id in section_by_subject and (not section_by_subject[subject_id] or section_by_subject[subject_id] == student.section) for subject_id in [row.subject_id for row in student_subjects]):
                assigned_student_ids.add(student.id)
        assigned_attendance = AttendanceRecord.query.filter(AttendanceRecord.student_id.in_(assigned_student_ids), AttendanceRecord.subject_id.in_(subject_ids)).all() if assigned_student_ids and subject_ids else []
        attendance_percentage = round(sum(1 for item in assigned_attendance if item.status in {"present", "late"}) * 100 / len(assigned_attendance), 2) if assigned_attendance else 0
        attendance_overview = []
        demo_subjects_enabled = any(item.code == "BRMK557" for item in subjects)
        if demo_subjects_enabled:
            for subject in Subject.query.filter_by(is_active=True).order_by(Subject.name).all():
                if subject.id in subject_ids:
                    section = section_by_subject.get(subject.id)
                    enrolled_query = StudentProfile.query.join(
                        User, User.id == StudentProfile.user_id
                    ).join(
                        StudentSubjectAllocation,
                        StudentSubjectAllocation.student_id == StudentProfile.id,
                    ).filter(
                        StudentSubjectAllocation.subject_id == subject.id,
                        User.is_active.is_(True),
                    )
                    enrolled_ids = {
                        student.id for student in enrolled_query.all()
                        if not section or student.section == section
                    }
                    records = AttendanceRecord.query.filter(
                        AttendanceRecord.subject_id == subject.id,
                        AttendanceRecord.student_id.in_(enrolled_ids),
                    ).all() if enrolled_ids else []
                    present = sum(1 for record in records if record.status in {"present", "late"})
                    attendance_overview.append({
                        "subject_id": subject.id,
                        "subject_code": subject.code,
                        "subject_name": subject.name,
                        "kind": "actual",
                        "present": present,
                        "absent": len(records) - present,
                        "total": len(records),
                        "percentage": round(present * 100 / len(records), 2) if records else None,
                    })
                else:
                    attendance_overview.append({
                        "subject_id": subject.id,
                        "subject_code": subject.code,
                        "subject_name": subject.name,
                        "kind": "demo",
                    })
        pending_evaluations = Submission.query.join(Assignment, Submission.assignment_id == Assignment.id).filter(Assignment.teacher_id == profile.id, Assignment.subject_id.in_(subject_ids), Submission.status == "submitted").count() if subject_ids else 0
        upcoming_exams = Examination.query.filter(Examination.subject_id.in_(subject_ids), Examination.exam_date >= date.today()).order_by(Examination.exam_date).limit(5).all() if subject_ids else []
        recent_messages = []
        for thread in sorted(queries, key=lambda item: item.updated_at or item.created_at, reverse=True)[:5]:
            student = StudentProfile.query.get(thread.student_id)
            student_user = User.query.get(student.user_id) if student else None
            last_message = CommunicationMessage.query.filter_by(thread_id=thread.id).order_by(CommunicationMessage.created_at.desc()).first()
            recent_messages.append({"thread_id": thread.id, "student_name": student_user.name if student_user else "Student", "subject": thread.subject, "updated_at": thread.updated_at.isoformat() if thread.updated_at else None, "message": last_message.message[:140] if last_message else ""})
        recent_notifications = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(5).all()
        return jsonify({
            "role": "teacher",
            "profile": {"name": user.name, "email": user.email, "employee_id": profile.employee_id, "department_id": profile.department_id, "designation": profile.designation},
            "summary": {
                "assigned_subjects": len(subjects),
                "assigned_classes": len({item.class_name for item in agenda}),
                "students": len(assigned_student_ids),
                "today_classes": len(today_agenda),
                "unread_queries": unread_queries,
                "pending_evaluations": pending_evaluations,
                "attendance_percentage": attendance_percentage,
                "assignments": Assignment.query.filter_by(teacher_id=profile.id).count(),
                "materials": len(materials),
                "draft_materials": sum(1 for item in materials if not item.published),
            },
            "subjects": [{"id": item.id, "name": item.name, "code": item.code, "sections": [entry.section for entry in assignments if entry.subject_id == item.id and entry.section]} for item in subjects],
            "attendance_overview": attendance_overview,
            "today_timetable": [item for item in timetable if item["day"].lower() == today.lower()],
            "timetable": timetable,
            "upcoming_examinations": [{"id": item.id, "name": item.name, "date": item.exam_date.isoformat(), "subject": Subject.query.get(item.subject_id).name if Subject.query.get(item.subject_id) else "Unknown subject"} for item in upcoming_exams],
            "recent_messages": recent_messages,
            "recent_notifications": [{"id": item.id, "message": item.message, "type": item.type, "created_at": item.created_at.isoformat()} for item in recent_notifications],
            "unread_queries": unread_queries,
            "notices": [{"id": item.id, "title": item.title, "type": item.type} for item in notices],
        })

    if user.role == "admin":
        counts = {
            "students": User.query.filter_by(role="student", is_active=True).count(),
            "teachers": User.query.filter_by(role="teacher").count(),
            "departments": Department.query.count(),
            "notices": Notice.query.count(),
        }
        notices = Notice.query.limit(5).all()
        exams = Examination.query.limit(5).all()
        return jsonify({
            "role": "admin",
            "summary": counts,
            "notices": [{"id": item.id, "title": item.title, "type": item.type} for item in notices],
            "examinations": [{"id": item.id, "name": item.name, "date": str(item.exam_date)} for item in exams],
        })

    return jsonify({"error": "Unsupported role"}), 400


@dashboard_bp.route("/notifications", methods=["GET"])
@auth_required
def get_notifications():
    user = request.current_user
    notifications = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()
    return jsonify({
        "notifications": [{"id": item.id, "message": item.message, "type": item.type} for item in notifications]
    })


@dashboard_bp.route("/notices", methods=["GET"])
@auth_required
def get_notices():
    user = request.current_user
    if user.role == "admin":
        notices = Notice.query.order_by(Notice.published_at.desc()).all()
    elif user.role == "teacher":
        profile = TeacherProfile.query.filter_by(user_id=user.id).first()
        notices = Notice.query.filter((Notice.teacher_id == profile.id) | (Notice.target_role == "all")).order_by(Notice.published_at.desc()).all() if profile else []
    elif user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            notices = []
        else:
            subject_ids = [item.subject_id for item in StudentSubjectAllocation.query.filter_by(student_id=profile.id).all()]
            candidates = Notice.query.filter(Notice.target_role.in_(["student", "all"])).order_by(Notice.published_at.desc()).all()
            notices = [item for item in candidates if (not item.subject_id or item.subject_id in subject_ids) and (not item.department_id or item.department_id == profile.department_id) and (not item.semester or item.semester == profile.semester) and (not item.class_name or not profile.section or item.class_name.endswith(f"-{profile.section}"))]
    else:
        return jsonify({"error": "Forbidden"}), 403
    return jsonify({
        "notices": [{"id": item.id, "title": item.title, "content": item.content, "type": item.type, "semester": item.semester} for item in notices]
    })
