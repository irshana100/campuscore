import os
import re
from collections import defaultdict
from datetime import date, timedelta

from app.services.academic_calendar import ACADEMIC_CALENDAR_EVENTS
from app.models import (
    AdmissionApplication,
    Assignment,
    Assessment,
    AttendanceRecord,
    ClassScheduleEntry,
    CommunicationMessage,
    CommunicationThread,
    Examination,
    Mark,
    Notification,
    Notice,
    StudyMaterial,
    Submission,
    Department,
    StudentProfile,
    Subject,
    StudentSubjectAllocation,
    TeacherProfile,
    TeacherSubjectAssignment,
    TimetableEntry,
    User,
)
from app.services.analytics import compute_attendance_summary
from app import db


def _clean_text(value):
    return (value or "").strip().lower()


def _format_subject_name(subject_id):
    subject = Subject.query.get(subject_id)
    return subject.name if subject else f"Subject {subject_id}"


def _student_subjects(student_profile):
    return Subject.query.join(StudentSubjectAllocation, StudentSubjectAllocation.subject_id == Subject.id).filter(
        StudentSubjectAllocation.student_id == student_profile.id,
        Subject.is_active.is_(True),
    ).order_by(Subject.name).all()


def _visible_student_notices(student_profile):
    subject_ids = [item.id for item in _student_subjects(student_profile)]
    return [
        item for item in Notice.query.order_by(Notice.published_at.desc()).all()
        if item.target_role in {"student", "all"}
        and (not item.subject_id or item.subject_id in subject_ids)
        and (not item.department_id or item.department_id == student_profile.department_id)
        and (not item.semester or item.semester == student_profile.semester)
        and (not item.class_name or not student_profile.section or item.class_name.endswith(f"-{student_profile.section}"))
    ]


def _build_student_context(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return {"profile": None, "attendance": [], "upcoming": [], "assignments": [], "notices": [], "exams": []}

    subject_ids = [item.id for item in _student_subjects(profile)]
    attendance_records = AttendanceRecord.query.filter(AttendanceRecord.student_id == profile.id, AttendanceRecord.subject_id.in_(subject_ids)).all() if subject_ids else []
    summary = compute_attendance_summary([
        {"subject_id": item.subject_id, "status": item.status}
        for item in attendance_records
    ])

    subject_ids = [item.id for item in _student_subjects(profile)]
    department = Department.query.get(profile.department_id)
    class_name = f"{department.code}-{profile.section}" if department and profile.section else None
    timetable_query = TimetableEntry.query.filter(TimetableEntry.subject_id.in_(subject_ids)) if subject_ids else TimetableEntry.query.filter(db.false())
    if class_name:
        timetable_query = timetable_query.filter_by(class_name=class_name)
    timetable = timetable_query.all()
    assignments = Assignment.query.filter(Assignment.subject_id.in_(subject_ids)).order_by(Assignment.due_date.asc()).all() if subject_ids else []
    assignments = [item for item in assignments if not item.section or item.section == profile.section][:5]
    notices = [item for item in Notice.query.order_by(Notice.published_at.desc()).all() if item.target_role in {"student", "all"} and (not item.subject_id or item.subject_id in subject_ids) and (not item.department_id or item.department_id == profile.department_id) and (not item.semester or item.semester == profile.semester) and (not item.class_name or not profile.section or item.class_name.endswith(f"-{profile.section}"))][:5]
    exams = Examination.query.filter(Examination.subject_id.in_(subject_ids), Examination.exam_date >= date.today()).order_by(Examination.exam_date.asc()).limit(5).all() if subject_ids else []

    return {
        "profile": profile,
        "attendance": summary,
        "timetable": timetable,
        "assignments": assignments,
        "notices": notices,
        "exams": exams,
    }


def _build_teacher_context(user):
    profile = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return {"profile": None, "timetable": [], "assignments": [], "notices": [], "attendance": []}

    timetable = TimetableEntry.query.filter_by(teacher_id=profile.id).all()
    assignments = Assignment.query.filter_by(teacher_id=profile.id).order_by(Assignment.due_date.asc()).all()[:5]
    subject_ids = [item.subject_id for item in TeacherSubjectAssignment.query.filter_by(teacher_id=profile.id).all()]
    notices = Notice.query.filter_by(teacher_id=profile.id).order_by(Notice.published_at.desc()).all()[:5]
    attendance = AttendanceRecord.query.filter(AttendanceRecord.subject_id.in_(subject_ids)).all()[:50] if subject_ids else []

    return {
        "profile": profile,
        "timetable": timetable,
        "assignments": assignments,
        "notices": notices,
        "attendance": attendance,
    }


def _build_admin_context(user):
    students = User.query.filter_by(role="student", is_active=True).count()
    teachers = User.query.filter_by(role="teacher").count()
    departments = db.session.query(User).filter(User.role == "student").count()
    notices = Notice.query.count()
    examinations = Examination.query.count()
    return {
        "students": students,
        "teachers": teachers,
        "departments": departments,
        "notices": notices,
        "examinations": examinations,
    }


def _attendance_reply(student_profile, message="", requested_subject=None):
    subject_ids = [item.id for item in _student_subjects(student_profile)]
    records = AttendanceRecord.query.filter(AttendanceRecord.student_id == student_profile.id, AttendanceRecord.subject_id.in_(subject_ids)).all() if subject_ids else []
    if not records:
        if requested_subject:
            return f"No attendance has been recorded for {requested_subject.name} yet."
        return "No attendance has been recorded in your student profile yet, so I can’t calculate an attendance percentage."

    summary = compute_attendance_summary([
        {"subject_id": item.subject_id, "status": item.status}
        for item in records
    ])

    if "today" in message.lower():
        today_records = [item for item in records if item.date == date.today()]
        if not today_records:
            return "No attendance has been recorded for you today."
        today_summary = compute_attendance_summary([
            {"subject_id": item.subject_id, "status": item.status}
            for item in today_records
            if not requested_subject or item.subject_id == requested_subject.id
        ])
        if not today_summary:
            return f"No attendance has been recorded for {requested_subject.name} today."
        return "Your attendance recorded today:\n" + "\n".join(
            f"- {_format_subject_name(item['subject_id'])}: {item['percentage']}% "
            f"({item['present']} present, {item['total'] - item['present']} absent of {item['total']})"
            for item in today_summary
        )

    if requested_subject:
        summary = [item for item in summary if item["subject_id"] == requested_subject.id]
        if not summary:
            return f"No attendance has been recorded for {requested_subject.name} yet."

    target_match = re.search(r"(?:for|to|at|reach)\s+(\d{1,3})\s*(?:%|percent)", message.lower())
    if not target_match:
        target_match = re.search(r"(\d{1,3})\s*(?:%|percent)", message.lower())
    target = int(target_match.group(1)) if target_match else 75
    target = max(1, min(target, 100))

    total_attended = sum(item["present"] for item in summary)
    total_classes = sum(item["total"] for item in summary)
    if any(term in message.lower() for term in ("missed", "classes absent", "how many absent")):
        missed = total_classes - total_attended
        return f"You have missed {missed} of {total_classes} recorded classes across {len(summary)} subject(s)."

    if requested_subject:
        item = summary[0]
        absent = item["total"] - item["present"]
        target = 75
        needed = max(0, (target * item["total"] - 100 * item["present"] + (100 - target) - 1) // (100 - target))
        eligibility = (
            f"You need to attend the next {needed} consecutive classes to reach 75%."
            if needed > 0 else "You currently meet the 75% attendance threshold."
        )
        return (
            f"Your attendance in {requested_subject.name} is {item['percentage']}% "
            f"({item['present']} present, {absent} absent of {item['total']} classes). {eligibility}"
        )

    overall = round(total_attended * 100 / total_classes, 1) if total_classes else 0
    overall_absent = total_classes - total_attended
    lines = [f"Your overall attendance is {overall}% ({total_attended} present, {overall_absent} absent of {total_classes} recorded classes). Subject-wise:"]
    for item in summary:
        subject_name = _format_subject_name(item["subject_id"])
        lines.append(f"- {subject_name}: {item['percentage']}% ({item['present']}/{item['total']} classes)")

        if target < 100:
            required = max(0, (target * item["total"] - 100 * item["present"] + (100 - target) - 1) // (100 - target))
        else:
            required = None

        if item["percentage"] >= target:
            lines.append(f"  You currently meet the {target}% attendance threshold.")
        elif required is not None:
            lines.append(f"  Attend the next {required} consecutive classes to reach {target}% attendance." if required > 1 else f"  Attend the next class to reach {target}% attendance.")
        else:
            lines.append("  Reaching 100% requires attending every remaining scheduled class.")

    lines.append("The minimum required attendance threshold is 75%.")
    return "\n".join(lines)


def _find_attendance_subject(message, student_profile):
    aliases = {
        "BCS501": ["sepm", "software engineering", "project management"],
        "BCS502": ["cn", "computer network", "computational network"],
        "BCS503": ["toc", "theory of computation"],
        "BCSL504": ["web technology", "web lab"],
        "BCS515B": ["ai", "artificial intelligence"],
        "BCS586": ["mini project", "project"],
        "BRMK557": ["rm", "research methodology", "research management"],
        "BCS508": ["evs", "environmental studies", "environmental science"],
        "BCS502-LAB": ["cn lab", "computer networks lab", "network lab"],
        "ESP": ["employability skills", "employability skill program"],
    }
    text = message.lower()
    matched = []
    for subject in _student_subjects(student_profile):
        terms = [subject.name.lower(), subject.code.lower(), *aliases.get(subject.code, [])]
        if any(re.search(rf"\b{re.escape(term)}\b", text) for term in terms if term):
            matched.append((max(len(term) for term in terms if term and re.search(rf"\b{re.escape(term)}\b", text)), subject))
    return max(matched, key=lambda item: item[0])[1] if matched else None


def _student_assignments_reply(user, message, context_message=""):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I can’t find a student profile linked to your account."
    subject_ids = [item.id for item in _student_subjects(profile)]
    assignments = Assignment.query.filter(Assignment.subject_id.in_(subject_ids)).order_by(Assignment.due_date.asc()).all() if subject_ids else []
    assignments = [item for item in assignments if not item.section or item.section == profile.section]
    search_text = f"{message} {context_message}".lower()
    requested_subject = _find_attendance_subject(search_text, profile)
    if requested_subject:
        assignments = [item for item in assignments if item.subject_id == requested_subject.id]
    rows = []
    for assignment in assignments:
        submission = Submission.query.filter_by(assignment_id=assignment.id, student_id=profile.id).first()
        submission_status = (submission.status if submission else "").lower()
        submitted = bool(submission and submission_status not in {"pending", "not submitted", "missing"})
        overdue = not submitted and assignment.due_date < date.today()
        submitted_late = bool(
            submitted
            and submission.submitted_at
            and submission.submitted_at.date() > assignment.due_date
        )
        rows.append((assignment, submission, submitted, overdue, submitted_late))

    text = message.lower()
    if "submitted" in text and not any(term in text for term in ("not submitted", "haven’t submitted", "haven't submitted")):
        rows = [row for row in rows if row[2]]
        heading = "Your submitted assignments"
    elif "overdue" in text or "late assignment" in text:
        rows = [row for row in rows if row[3] or row[4]]
        heading = "Your overdue assignments"
    elif any(term in text for term in ("pending", "not submitted", "haven’t submitted", "haven't submitted", "upcoming", "deadline", "due")):
        rows = [row for row in rows if not row[2]]
        heading = "Your pending assignments"
    else:
        heading = "Your assignments"

    if "this week" in text or "week" in text:
        week_end = date.today() + timedelta(days=7)
        rows = [row for row in rows if date.today() <= row[0].due_date <= week_end or row[3]]

    if not rows:
        if assignments:
            return f"You have no {heading.lower()} in the requested date range."
        return "No assignments are published for your enrolled subjects yet."

    lines = [f"{heading} ({len(rows)}):"]
    for assignment, submission, submitted, overdue, submitted_late in rows:
        subject = Subject.query.get(assignment.subject_id)
        status = "Submitted late" if submitted_late else "Submitted" if submitted else "Overdue" if overdue else "Pending"
        detail = f"- {assignment.title} · {subject.name if subject else 'Subject'} · due {assignment.due_date} · {status}"
        if assignment.description:
            detail += f"\n  Instructions: {assignment.description}"
        if submission and submission.marks_obtained is not None:
            detail += f" · {submission.marks_obtained:g}/{assignment.max_marks:g} marks"
        lines.append(detail)
    return "\n".join(lines)


def _student_marks_reply(user, message):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I can’t find a student profile linked to your account."
    subject_ids = [item.id for item in _student_subjects(profile)]
    query = Mark.query.join(Assessment, Assessment.id == Mark.assessment_id).filter(
        Mark.student_id == profile.id,
        Mark.subject_id.in_(subject_ids),
        Assessment.published.is_(True),
    ) if subject_ids else Mark.query.filter(db.false())
    requested_subject = _find_attendance_subject(message, profile)
    if requested_subject:
        query = query.filter(Mark.subject_id == requested_subject.id)
    marks = query.order_by(Assessment.due_date.desc()).all()
    if not marks:
        if requested_subject:
            return f"No marks have been published for {requested_subject.name} yet."
        unpublished = Assessment.query.filter(Assessment.subject_id.in_(subject_ids), Assessment.published.is_(False)).count() if subject_ids else 0
        suffix = f" {unpublished} assessment(s) are not published yet." if unpublished else ""
        return "No marks have been published to your profile yet." + suffix

    total_earned = 0.0
    total_possible = 0.0
    lines = ["Your published marks:"]
    for mark in marks:
        assessment = Assessment.query.get(mark.assessment_id)
        subject = Subject.query.get(mark.subject_id)
        total_earned += mark.marks_obtained
        total_possible += assessment.max_marks if assessment else 0
        if assessment:
            lines.append(f"- {assessment.title} · {subject.name if subject else 'Subject'} · {mark.marks_obtained:g}/{assessment.max_marks:g}")
    if total_possible:
        overall = round(total_earned * 100 / total_possible, 1)
        lines.insert(1, f"Overall published assessment percentage: {overall}% ({total_earned:g}/{total_possible:g}).")
    return "\n".join(lines)


def _student_notifications_reply(user):
    notifications = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(10).all()
    if not notifications:
        return "There are no notifications recorded for your account yet."
    lines = [f"Your recent notifications ({len(notifications)}):"]
    for item in notifications:
        lines.append(f"- {item.message} · {item.created_at.strftime('%Y-%m-%d')}")
    return "\n".join(lines)


def _student_subjects_reply(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I could not find a student profile linked to your account."
    subjects = _student_subjects(profile)
    if not subjects:
        return "No active subjects are linked to your student profile."
    return f"Your enrolled subjects for semester {profile.semester}:\n" + "\n".join(
        f"- {subject.name} ({subject.code})" for subject in subjects
    )


def _calendar_events():
    return [
        {**event, "event_date": date.fromisoformat(event["date"])}
        for event in ACADEMIC_CALENDAR_EVENTS
    ]


def _student_calendar_reply(user, message):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I could not find a student profile linked to your account."

    text = message.lower()
    events = _calendar_events()
    is_holiday_query = "holiday" in text or "holidays" in text
    if is_holiday_query:
        events = [item for item in events if "holiday" in item["category"].lower()]
        if "month" in text:
            events = [
                item for item in events
                if item["event_date"].year == date.today().year
                and item["event_date"].month == date.today().month
            ]
            if any(term in text for term in ("next", "nearest")):
                events = [item for item in events if item["event_date"] >= date.today()][:1]
            heading = "Holidays listed in the academic calendar this month:"
        else:
            events = [item for item in events if item["event_date"] >= date.today()]
            events = events[:1] if any(term in text for term in ("next", "nearest")) else events[:8]
            heading = "The next holiday listed in the academic calendar is:" if any(
                term in text for term in ("next", "nearest")
            ) else "Upcoming holidays listed in the academic calendar:"
    elif any(term in text for term in ("semester examination", "semester exam", "theory exam")):
        events = [
            item for item in events
            if "semester examination" in item["category"].lower()
            and item["event_date"] >= date.today()
        ][:5]
        heading = "Upcoming semester examinations in the academic calendar:"
    else:
        events = [item for item in events if item["event_date"] >= date.today()]
        if "event" in text:
            events = [item for item in events if "event" in item["category"].lower()]
        events = events[:8]
        heading = "Upcoming events and academic-calendar dates:"

    lines = [heading] if events else []
    lines.extend(
        f"- {item['display_date']} · {item['title']} ({item['category']})"
        for item in events
    )

    notice_terms = (
        ("holiday",) if is_holiday_query else
        ("exam", "examination") if any(term in text for term in ("exam", "examination")) else
        ("event", "academic", "schedule") if any(term in text for term in ("event", "calendar", "schedule")) else ()
    )
    notices = [
        notice for notice in _visible_student_notices(profile)
        if notice_terms and any(
            term in f"{notice.title} {notice.content}".lower()
            for term in notice_terms
        )
    ]
    if is_holiday_query and "month" in text:
        month_name = date.today().strftime("%B").lower()
        month_names = (
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december",
        )
        notices = [
            notice for notice in notices
            if re.search(rf"\b{month_name}\b", f"{notice.title} {notice.content}".lower())
            or not any(
                re.search(rf"\b{name}\b", f"{notice.title} {notice.content}".lower())
                for name in month_names
            )
        ]
    notices = notices[:5]
    if notices:
        lines.append("Relevant published announcements (publication dates are not event dates):")
        lines.extend(
            f"- {notice.title}: {notice.content} "
            f"(published {notice.published_at.date().isoformat() if notice.published_at else 'date unavailable'})"
            for notice in notices
        )

    if not lines:
        if is_holiday_query:
            return "No matching holiday date is listed in the academic calendar, and no relevant dated announcement is available."
        return "No matching upcoming date is available in the academic calendar."
    return "\n".join(lines)


def _student_week_reply(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I could not find a student profile linked to your account."
    end_date = date.today() + timedelta(days=7)
    subject_ids = [item.id for item in _student_subjects(profile)]
    assignments = Assignment.query.filter(
        Assignment.subject_id.in_(subject_ids),
        Assignment.due_date <= end_date,
    ).order_by(Assignment.due_date.asc()).all() if subject_ids else []
    assignments = [item for item in assignments if not item.section or item.section == profile.section]
    lines = ["Here is what your CampusCore records show for this week:"]
    assignment_lines = []
    for assignment in assignments:
        submission = Submission.query.filter_by(assignment_id=assignment.id, student_id=profile.id).first()
        submitted = bool(submission and submission.status.lower() not in {"pending", "not submitted", "missing"})
        if not submitted:
            subject = Subject.query.get(assignment.subject_id)
            status = "Overdue" if assignment.due_date < date.today() else "Due"
            assignment_lines.append(
                f"- Assignment: {assignment.title} · {subject.name if subject else 'Subject'} · "
                f"{status} {assignment.due_date}"
            )
    lines.extend(assignment_lines or ["- No pending assignments are due within the next seven days."])

    calendar_items = [
        item for item in _calendar_events()
        if date.today() <= item["event_date"] <= end_date
    ]
    lines.extend(
        f"- Calendar: {item['display_date']} · {item['title']}"
        for item in calendar_items
    )
    return "\n".join(lines)


def _extract_module_number(message):
    if not message:
        return None
    match = re.search(
        r"\bmodule\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b"
        r"|\bmod\s*(\d+)\b|\bm(\d+)\b",
        message.lower(),
    )
    if not match:
        return None
    value = next(group for group in match.groups() if group is not None)
    if value.isdigit():
        return int(value)
    return {
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
    }[value]


def _student_material_aliases(subject):
    aliases = {subject.name.lower(), subject.code.lower()}
    code = subject.code.lower()
    if code in {"bcs501", "sepm"}:
        aliases.update({"software engineering", "software engineering and project management", "software engineering & project management", "software engineering project management", "sepm"})
    if code in {"bcs502", "cn"}:
        aliases.update({"computer networks", "computational networks", "networks", "computer network", "cn"})
    if code in {"bcs503", "toc"}:
        aliases.update({"theory of computation", "toc", "theory of computations"})
    if code in {"bcsl504", "wtl"}:
        aliases.update({"web technology lab", "web technology", "wtl"})
    if code in {"bcs515b", "ai"}:
        aliases.update({"artificial intelligence", "ai"})
    if code in {"bcs586", "mp"}:
        aliases.update({"mini project", "mp", "mini project work"})
    if code in {"brmk557", "rm"}:
        aliases.update({"research methodology", "research methodology and ipr", "ipr", "research methodology and intellectual property rights", "rm"})
    if code in {"bcs508", "evs"}:
        aliases.update({"environmental studies", "environmental science", "evs"})
    if code in {"esp"}:
        aliases.update({"employability skill program", "employability skills", "esp"})
    return {alias.strip().lower() for alias in aliases if alias}


def _resolve_subject_for_question(profile, message):
    normalized = re.sub(r"[^a-z0-9\s]", " ", message.lower())
    for subject in _student_subjects(profile):
        if any(alias in normalized for alias in _student_material_aliases(subject)):
            return subject
    return _find_attendance_subject(message, profile)


def _material_payload_for_chat(material):
    subject = Subject.query.get(material.subject_id)
    return {
        "id": material.id,
        "title": material.title,
        "category": material.category,
        "module_number": material.module_number,
        "subject_name": subject.name if subject else "Unknown subject",
        "subject_code": subject.code if subject else "",
        "file_name": material.file_name,
        "file_type": material.file_type,
        "uploaded_at": material.uploaded_at.isoformat() if material.uploaded_at else None,
        "download_url": f"/api/materials/{material.id}/download",
        "preview_url": f"/api/materials/{material.id}/preview" if material.file_type in {"pdf", "png", "jpg", "jpeg"} else None,
    }


def _student_materials_reply(user, message, context_message=""):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I could not find your student profile for the study materials lookup.", [], None

    subject = _resolve_subject_for_question(profile, f"{message} {context_message}")
    module_number = _extract_module_number(message)
    if module_number is None:
        module_number = _extract_module_number(context_message)
    query = StudyMaterial.query.filter(StudyMaterial.published.is_(True))
    enrolled_ids = [item.subject_id for item in StudentSubjectAllocation.query.filter_by(student_id=profile.id).all()]
    if enrolled_ids:
        query = query.filter(StudyMaterial.subject_id.in_(enrolled_ids))
    else:
        query = query.filter(db.false())

    if subject:
        query = query.filter(StudyMaterial.subject_id == subject.id)
    if module_number is not None:
        query = query.filter(StudyMaterial.module_number == module_number)

    materials = query.order_by(StudyMaterial.uploaded_at.desc()).all()
    if not materials:
        if module_number is not None:
            return "No study materials have been uploaded for this module yet. Please specify another subject or module.", [], subject
        if subject:
            return f"No published study materials are available for {subject.name} yet. Please specify another subject or module.", [], subject
        return "No published study materials are available for your enrolled subjects yet. Please specify another subject or module.", [], None

    subject_label = subject.name if subject else "the selected subject"
    reply_lines = [f"I found {len(materials)} published study material(s) for {subject_label}."]
    for material in materials:
        subject_name = Subject.query.get(material.subject_id).name if Subject.query.get(material.subject_id) else "Subject"
        module_label = f"Module {material.module_number}" if material.module_number is not None else "General resource"
        reply_lines.append(f"- {material.title} ({material.category}) · {subject_name} · {module_label} · {material.file_name}")
        if material.file_type in {"pdf", "png", "jpg", "jpeg"}:
            reply_lines.append(f"  View: http://localhost:5000/api/materials/{material.id}/preview")
        reply_lines.append(f"  Download: http://localhost:5000/api/materials/{material.id}/download")

    return "\n".join(reply_lines), [_material_payload_for_chat(material) for material in materials], subject


def _student_fee_reply(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I can’t find a student profile linked to your account."
    application = AdmissionApplication.query.filter(
        db.or_(AdmissionApplication.student_profile_id == profile.id, AdmissionApplication.roll_number == profile.roll_number)
    ).order_by(AdmissionApplication.updated_at.desc()).first()
    if not application:
        return "I can’t find a fee record linked to your student profile. The system currently has no fee amounts or payment ledger to check."
    return f"Your admission record lists fee status as '{application.fee_status}'. Fee amounts, due dates, and payment transactions are not available in the current database."


def _student_timetable_reply(user, message="", context_message=""):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return "I can’t find a student profile linked to your account."
    entries = ClassScheduleEntry.query.filter_by(section=profile.section).order_by(ClassScheduleEntry.day, ClassScheduleEntry.period).all()
    if not entries:
        return "No timetable entries are recorded for your section yet."
    text = f"{message} {context_message}".lower()
    current_text = message.lower()
    today = date.today()
    day_names = {name.lower(): name for name in (
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    )}
    requested_day = next(
        (name for token, name in day_names.items() if re.search(rf"\b{token}\b", current_text)),
        None,
    )
    if "tomorrow" in current_text:
        requested_day = (today + timedelta(days=1)).strftime("%A")
    elif "today" in current_text:
        requested_day = today.strftime("%A")
    elif requested_day is None:
        requested_day = next(
            (name for token, name in day_names.items() if re.search(rf"\b{token}\b", text)),
            None,
        )
        if "tomorrow" in context_message.lower():
            requested_day = (today + timedelta(days=1)).strftime("%A")
        elif "today" in context_message.lower():
            requested_day = today.strftime("%A")
    if requested_day:
        entries = [item for item in entries if item.day.lower() == requested_day.lower()]
        heading = f"Your classes for {requested_day}"
    else:
        heading = f"Your Section {profile.section} weekly timetable"
        if "next class" in text or "upcoming class" in text:
            for offset in range(7):
                candidate_day = (today + timedelta(days=offset)).strftime("%A")
                next_entries = [item for item in entries if item.day.lower() == candidate_day.lower()]
                if next_entries:
                    entries = next_entries
                    heading = f"Your next scheduled classes ({candidate_day})"
                    break
    lines = [heading + ":"]
    for item in entries[:20]:
        end_period = item.period + item.duration_periods - 1
        period_label = f"Period {item.period}" if end_period == item.period else f"Periods {item.period}-{end_period}"
        lines.append(f"- {item.day} · {period_label} · {item.label}")
    return "\n".join(lines) if len(lines) > 1 else f"No classes are scheduled for your section on {requested_day or today.strftime('%A')}."


def _timetable_reply(user, role):
    if role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return "I could not find your student profile."
        subject_ids = [item.subject_id for item in StudentSubjectAllocation.query.filter_by(student_id=profile.id).all()]
        department = Department.query.get(profile.department_id)
        class_name = f"{department.code}-{profile.section}" if department and profile.section else None
        query = TimetableEntry.query.filter(TimetableEntry.subject_id.in_(subject_ids)) if subject_ids else TimetableEntry.query.filter(db.false())
        if class_name:
            query = query.filter_by(class_name=class_name)
        timetable = query.order_by(TimetableEntry.day, TimetableEntry.period).all()
        if not timetable:
            return "No timetable entries are available yet."
        lines = ["Your timetable entries are:"]
        for item in timetable:
            lines.append(f"- {item.day}: {_format_subject_name(item.subject_id)} in {item.room}, period {item.period}")
        return "\n".join(lines)

    if role == "teacher":
        profile = TeacherProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return "I could not find your assigned timetable."
        timetable = TimetableEntry.query.filter_by(teacher_id=profile.id).all()
        if not timetable:
            return "You do not currently have any assigned classes in the timetable."
        lines = ["Your teaching timetable is:"]
        for item in timetable:
            lines.append(f"- {item.day}: {_format_subject_name(item.subject_id)} in {item.room}, period {item.period}")
        return "\n".join(lines)

    return "I can provide timetable summaries for departments and scheduled classes when you ask for them."


def _assignment_reply(user, role):
    if role == "student":
        student = StudentProfile.query.filter_by(user_id=user.id).first()
        if not student:
            return "I could not find your student profile."
        subject_ids = [item.subject_id for item in StudentSubjectAllocation.query.filter_by(student_id=student.id).all()]
        assignments = Assignment.query.filter(Assignment.subject_id.in_(subject_ids)).order_by(Assignment.due_date.asc()).all() if subject_ids else []
        assignments = [item for item in assignments if not item.section or item.section == student.section][:5]
        if not assignments:
            return "No active assignments are currently published."
        lines = ["Your assignment list is:"]
        for item in assignments:
            lines.append(f"- {item.title}: due on {item.due_date}")
        return "\n".join(lines)

    if role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
        if not teacher:
            return "I could not find your teacher profile."
        subject_ids = [item.subject_id for item in TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()]
        assignments = Assignment.query.filter(Assignment.teacher_id == teacher.id, Assignment.subject_id.in_(subject_ids)).order_by(Assignment.due_date.asc()).all()[:5] if subject_ids else []
        if not assignments:
            return "You have no published assignments yet."
        lines = ["Your published assignments are:"]
        for item in assignments:
            lines.append(f"- {item.title}: due on {item.due_date}")
        return "\n".join(lines)

    return "I can help review assignment records for students and faculty when needed."


def _notice_reply(user, role):
    query = Notice.query.order_by(Notice.published_at.desc())
    if role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
        query = query.filter_by(teacher_id=teacher.id) if teacher else query.filter(db.false())
    elif role == "student":
        student = StudentProfile.query.filter_by(user_id=user.id).first()
        if not student:
            return "I could not find your student profile."
        notices = _visible_student_notices(student)[:5]
    else:
        notices = query.limit(5).all()
    if role == "teacher":
        notices = query.limit(5).all()
    if not notices:
        return "No official notices are available right now."
    lines = ["Recent notices:"]
    for item in notices:
        lines.append(f"- {item.title}: {item.content[:120]}...")
    return "\n".join(lines)


def _exam_reply(user, role):
    query = Examination.query.order_by(Examination.exam_date.asc())
    if role == "student":
        student = StudentProfile.query.filter_by(user_id=user.id).first()
        subject_ids = [item.id for item in _student_subjects(student)] if student else []
        query = query.filter(Examination.subject_id.in_(subject_ids), Examination.exam_date >= date.today()) if subject_ids else query.filter(db.false())
    elif role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
        subject_ids = [item.subject_id for item in TeacherSubjectAssignment.query.filter_by(teacher_id=teacher.id).all()] if teacher else []
        query = query.filter(Examination.subject_id.in_(subject_ids)) if subject_ids else query.filter(db.false())
    exams = query.limit(5).all()
    if not exams:
        return "No examination schedules are available yet."
    lines = ["Upcoming examination schedule:"]
    for item in exams:
        subject = Subject.query.get(item.subject_id)
        lines.append(f"- {item.name} · {subject.name if subject else 'Subject'} · {item.exam_date} at {item.start_time} in {item.room}")
    return "\n".join(lines)


def _teacher_summary_reply(user):
    teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not teacher:
        return "I could not find your teacher profile."
    assignments = TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()
    subject_ids = {item.subject_id for item in assignments}
    student_ids = set()
    for allocation in StudentSubjectAllocation.query.filter(StudentSubjectAllocation.subject_id.in_(subject_ids)).all() if subject_ids else []:
        student = StudentProfile.query.get(allocation.student_id)
        matching = [item for item in assignments if item.subject_id == allocation.subject_id]
        if student and any(not item.section or item.section == student.section for item in matching):
            student_ids.add(student.id)
    timetable = TimetableEntry.query.filter(TimetableEntry.teacher_id == teacher.id, TimetableEntry.subject_id.in_(subject_ids)).count() if subject_ids else 0
    assignment_count = Assignment.query.filter(Assignment.teacher_id == teacher.id, Assignment.subject_id.in_(subject_ids)).count() if subject_ids else 0
    pending = Submission.query.join(Assignment, Submission.assignment_id == Assignment.id).filter(Assignment.teacher_id == teacher.id, Assignment.subject_id.in_(subject_ids), Submission.status == "submitted").count() if subject_ids else 0
    unread = CommunicationMessage.query.join(CommunicationThread, CommunicationMessage.thread_id == CommunicationThread.id).filter(CommunicationThread.teacher_id == teacher.id, CommunicationMessage.sender_id != user.id, CommunicationMessage.read_at.is_(None)).count()
    return f"You have {len(student_ids)} students across {len(subject_ids)} assigned subjects, {timetable} timetable entries, {assignment_count} assignments, {pending} submissions to evaluate, and {unread} unread student queries."


def _teacher_attendance_reply(user):
    teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not teacher:
        return "I could not find your teacher profile."
    assignments = TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()
    at_risk = []
    for assignment in assignments:
        allocations = StudentSubjectAllocation.query.filter_by(subject_id=assignment.subject_id).all()
        for allocation in allocations:
            student = StudentProfile.query.get(allocation.student_id)
            if not student or (assignment.section and assignment.section != student.section):
                continue
            records = AttendanceRecord.query.filter_by(student_id=student.id, subject_id=assignment.subject_id).all()
            if not records:
                continue
            attended = sum(1 for item in records if item.status in {"present", "late"})
            percentage = round(attended * 100 / len(records), 2)
            if percentage < 75:
                student_user = User.query.get(student.user_id)
                at_risk.append(f"{student_user.name if student_user else student.roll_number} ({student.roll_number}) · {_format_subject_name(assignment.subject_id)}: {percentage}%")
    if not at_risk:
        return "No enrolled students with recorded attendance are currently below 75% in your assigned classes."
    return "Students below 75% attendance:\n" + "\n".join(f"- {item}" for item in at_risk[:15])


def _teacher_submission_reply(user, missing=False):
    teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not teacher:
        return "I could not find your teacher profile."
    subject_ids = [item.subject_id for item in TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()]
    assignments = Assignment.query.filter(Assignment.teacher_id == teacher.id, Assignment.subject_id.in_(subject_ids)).order_by(Assignment.due_date.asc()).all() if subject_ids else []
    items = []
    for assignment in assignments:
        students = StudentSubjectAllocation.query.filter_by(subject_id=assignment.subject_id).all()
        enrolled = {row.student_id for row in students if not assignment.section or (StudentProfile.query.get(row.student_id) and StudentProfile.query.get(row.student_id).section == assignment.section)}
        submissions = Submission.query.filter_by(assignment_id=assignment.id).all()
        if missing:
            submitted = {item.student_id for item in submissions if item.status != "pending"}
            for student_id in enrolled - submitted:
                student = StudentProfile.query.get(student_id)
                student_user = User.query.get(student.user_id) if student else None
                if student:
                    items.append(f"{assignment.title}: {student_user.name if student_user else student.roll_number} ({student.roll_number})")
        else:
            count = sum(1 for item in submissions if item.status == "submitted")
            if count:
                items.append(f"{assignment.title}: {count} submission(s) need evaluation")
    if not items:
        return "No missing submissions were found." if missing else "No submissions are waiting for evaluation."
    title = "Students with no submission:" if missing else "Submissions awaiting evaluation:"
    return title + "\n" + "\n".join(f"- {item}" for item in items[:20])


def _teacher_messages_reply(user):
    teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not teacher:
        return "I could not find your teacher profile."
    thread_ids = db.session.query(CommunicationMessage.thread_id).join(CommunicationThread, CommunicationMessage.thread_id == CommunicationThread.id).filter(CommunicationThread.teacher_id == teacher.id, CommunicationMessage.sender_id != user.id, CommunicationMessage.read_at.is_(None)).distinct()
    threads = CommunicationThread.query.filter(CommunicationThread.id.in_(thread_ids)).order_by(CommunicationThread.updated_at.desc()).all()
    if not threads:
        return "You have no unread student messages."
    lines = [f"You have {len(threads)} unread student message(s):"]
    for thread in threads[:10]:
        student = StudentProfile.query.get(thread.student_id)
        student_user = User.query.get(student.user_id) if student else None
        lines.append(f"- {student_user.name if student_user else 'Student'} · {thread.subject}")
    return "\n".join(lines)


def _teacher_marks_reply(user, below_average=False):
    teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not teacher:
        return "I could not find your teacher profile."
    subject_ids = [item.subject_id for item in TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()]
    assessments = Assessment.query.filter(Assessment.subject_id.in_(subject_ids)).order_by(Assessment.due_date.desc()).all() if subject_ids else []
    if not assessments:
        return "No assessments have been created for your assigned subjects yet."
    if not below_average:
        lines = ["Assessment publication status:"]
        lines.extend(f"- {item.title} ({_format_subject_name(item.subject_id)}): {'published' if item.published else 'not published'}" for item in assessments[:10])
        return "\n".join(lines)
    below = []
    for assessment in assessments:
        records = Mark.query.filter_by(assessment_id=assessment.id).all()
        if not records:
            continue
        average = sum(item.marks_obtained for item in records) / len(records)
        for mark in records:
            if mark.marks_obtained < average:
                student = StudentProfile.query.get(mark.student_id)
                student_user = User.query.get(student.user_id) if student else None
                below.append(f"{student_user.name if student_user else 'Student'} · {assessment.title}: {mark.marks_obtained:g}/{assessment.max_marks:g} (class average {average:.1f})")
    return "Students below their assessment average:\n" + "\n".join(f"- {item}" for item in below[:15]) if below else "No recorded marks are below their assessment averages."


def _admin_summary_reply():
    student_count = User.query.filter_by(role="student", is_active=True).count()
    teacher_count = User.query.filter_by(role="teacher").count()
    notice_count = Notice.query.count()
    examination_count = Examination.query.count()
    return (
        f"Institution summary: {student_count} students, {teacher_count} teachers, "
        f"{notice_count} published notices, and {examination_count} examination schedules."
    )


def _student_intent(text):
    if any(term in text for term in ("study material", "study materials", "notes", "module", "learning material", "material for", "download file")):
        return "materials"
    if any(term in text for term in ("what should i complete", "complete this week", "to do this week", "this week")):
        return "week"
    if any(term in text for term in ("holiday", "holidays", "academic calendar", "upcoming event", "college event")):
        return "calendar"
    if any(term in text for term in ("notification", "alert", "unread update")):
        return "notifications"
    if any(term in text for term in ("notice", "announcement", "college update")):
        return "notices"
    if any(term in text for term in ("assignment", "deadline", "submission", "due", "pending work", "overdue")):
        return "assignments"
    if any(term in text for term in ("exam", "examination", "seat", "exam room")):
        return "exams"
    if any(term in text for term in ("mark", "score", "result", "assessment", "grade", "academic performance", "overall performance", "academic percentage")):
        return "marks"
    if any(term in text for term in ("attendance", "percent", "present", "absent", "missed", "classes attended", "eligibility", "shortage", "need to attend", "classes to reach")) or re.search(
        r"\bhow many classes\b.*(?:\d+\s*%|attend|attendance|reach|eligible)",
        text,
    ):
        return "attendance"
    if any(term in text for term in ("subject list", "my subjects", "enrolled subjects", "subject details")):
        return "subjects"
    if any(term in text for term in ("timetable", "class schedule", "schedule", "period", "next class", "upcoming class", "class", "classes")):
        return "timetable"
    if any(term in text for term in ("fee", "fees", "payment", "tuition")):
        return "fees"
    return None


def generate_chatbot_reply(message, user, context_message=""):
    text = _clean_text(message)
    if not text:
        return "Please enter a valid question so I can help you.", ["My attendance", "My timetable", "Assignments", "Notices"], []

    if user.role == "student":
        context_text = _clean_text(context_message)
        intent = _student_intent(text) or _student_intent(context_text)
        entity_text = f"{message} {context_message}".strip()
        if intent == "materials":
            reply, materials, _ = _student_materials_reply(user, message, context_message)
            return reply, ["My attendance", "My marks", "Pending assignments", "My timetable"], materials

        if intent == "fees":
            return _student_fee_reply(user), ["Fee details", "Notifications", "My profile"], []

        if intent == "week":
            return _student_week_reply(user), ["Pending assignments", "My timetable", "Notifications"], []

        if intent == "calendar":
            reply = _student_calendar_reply(user, entity_text)
            if any(term in text for term in ("notice", "announcement", "update")):
                reply += "\n\n" + _notice_reply(user, "student")
            return reply, ["My timetable", "Exam schedule", "Notifications"], []

        if intent == "notifications":
            reply = _student_notifications_reply(user)
            if any(term in entity_text.lower() for term in ("notice", "announcement")):
                reply += "\n\n" + _notice_reply(user, "student")
            return reply, ["Notices", "My assignments", "Exam schedule"], []

        if intent == "notices":
            return _notice_reply(user, "student"), ["Exam schedule", "My timetable", "Assignments"], []

        if intent == "marks":
            return _student_marks_reply(user, entity_text), ["My results", "My attendance", "Assignments"], []

        if intent == "assignments":
            return _student_assignments_reply(user, message, context_message), ["My timetable", "My results", "Notices"], []

        if intent == "exams":
            reply = _exam_reply(user, "student")
            if any(term in entity_text.lower() for term in ("semester", "when does", "academic calendar")):
                reply += "\n\n" + _student_calendar_reply(user, entity_text)
            return reply, ["My results", "My timetable", "Notices"], []

        if intent == "attendance":
            profile = StudentProfile.query.filter_by(user_id=user.id).first()
            if profile:
                subject = _find_attendance_subject(entity_text, profile)
                return _attendance_reply(profile, entity_text, subject), ["My attendance", "My timetable", "My assignments"], []
            return "I can’t find a student profile linked to your account.", ["My profile", "My attendance"], []

        if intent == "subjects":
            return _student_subjects_reply(user), ["My timetable", "My marks", "My attendance"], []

        if intent == "timetable":
            return _student_timetable_reply(user, message, context_message), ["My attendance", "Assignments", "Exam schedule"], []

        if any(term in text for term in ("hello", "hi", "hey", "good morning", "good afternoon")):
            return "Hi! I can look up your own CampusCore attendance, assignments, timetable, exams, published marks, notices, holidays, and published study files. What would you like to check?", ["My attendance", "Pending assignments", "Next holiday", "My timetable"], []

        if any(term in text for term in ("thank you", "thanks", "that helps")):
            return "You’re welcome. Ask me about another item in your CampusCore records whenever you need.", ["My attendance", "Pending assignments", "Study materials", "Notifications"], []

        return (
            "I can answer questions using the records available to your account: attendance, assignment status and instructions, timetable, examination schedules, published marks, notices, holidays, and published study materials. I can’t verify information that isn’t recorded in CampusCore. What would you like me to look up?",
            ["My attendance", "Pending assignments", "Next holiday", "Study materials"],
            [],
        )

    if user.role == "teacher":
        if "unread" in text and any(k in text for k in ["message", "query", "student"]):
            return _teacher_messages_reply(user), ["Student messages", "My timetable", "Academic summary"], []

        if any(k in text for k in ["not submitted", "haven't submitted", "have not submitted", "missing submission"]):
            return _teacher_submission_reply(user, missing=True), ["Assignments", "Student attendance", "Student messages"], []

        if any(k in text for k in ["evaluate", "evaluation", "need grading", "to grade", "pending review"]):
            return _teacher_submission_reply(user), ["Assignments", "Marks and examinations", "Student messages"], []

        if any(k in text for k in ["how many students", "students assigned", "number of students", "academic summary"]):
            return _teacher_summary_reply(user), ["My subjects", "Student attendance", "Assignments"], []

        if any(k in text for k in ["low attendance", "attendance", "students at risk", "absent"]):
            return _teacher_attendance_reply(user), ["Student attendance", "Student messages", "Academic summary"], []

        if any(k in text for k in ["timetable", "class schedule", "teaching schedule", "classes"]):
            reply = _timetable_reply(user, "teacher")
            if "today" in text:
                today = date.today().strftime("%A").lower()
                lines = [line for line in reply.splitlines() if today in line.lower()]
                reply = "Today's classes:\n" + "\n".join(lines[1:]) if len(lines) > 1 else "You have no classes scheduled today."
            return reply, ["Low attendance", "Pending submissions", "Academic summary"], []

        if any(k in text for k in ["mark", "result", "score", "below average", "performance", "published"]):
            return _teacher_marks_reply(user, below_average=any(k in text for k in ["below average", "below-average", "low score", "underperform"])), ["Marks and examinations", "Assignments", "Low attendance"], []

        if any(k in text for k in ["notice", "announcement"]):
            return _notice_reply(user, "teacher"), ["Notices", "My timetable", "Pending submissions"], []

        if any(k in text for k in ["assignment", "submission", "pending"]):
            return _assignment_reply(user, "teacher"), ["My timetable", "Class summary", "Draft notice"], []

        if "student" in text and any(k in text for k in ["attention", "struggling", "support"]):
            return _teacher_attendance_reply(user), ["Marks and examinations", "Student attendance", "Mentoring"], []

        if any(k in text for k in ["timetable", "class schedule", "teaching schedule", "classes"]):
            return _timetable_reply(user, "teacher"), ["Low attendance", "Pending submissions", "Academic summary"], []

        return (
            "I can support your teaching tasks by checking timetable, attendance, assignment submissions, and notices. Ask me about any of those.",
            ["My timetable", "Low attendance", "Pending submissions"],
            [],
        )

    if user.role == "admin":
        if any(k in text for k in ["student count", "faculty count", "stats", "summary", "overview"]):
            return _admin_summary_reply(), ["Department stats", "Timetables", "Notice search"], []

        if any(k in text for k in ["department", "attendance", "academic"]):
            return "Department-level attendance and academic summaries are available from the administrator reports and analytics dashboard.", ["Student summary", "Timetable", "Academic reports"], []

        if any(k in text for k in ["timetable", "class schedule"]):
            return "Timetable data can be reviewed from the admin scheduling section, including faculty allocation and published changes.", ["Student summary", "Examination schedule", "Notice search"], []

        if any(k in text for k in ["exam", "seat", "room"]):
            return _exam_reply(user, "admin"), ["Student summary", "Timetables", "Notice search"], []

        if any(k in text for k in ["notice", "search"]):
            return _notice_reply(user, "admin"), ["Student summary", "Timetable", "Examination schedule"], []

        return (
            "I can help with institutional summaries, department statistics, timetable review, examination planning, and notice search.",
            ["Student summary", "Department stats", "Exam schedule"],
            [],
        )

    return "I can help with the college management dashboards once you log in as a student, teacher, or administrator.", ["Login", "Dashboard"], []
