import os
from datetime import datetime
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from app import db
from app.auth import auth_required
from app.faculty_rules import assigned_roll_number_faculty
from app.models import (
    CommunicationMessage,
    CommunicationThread,
    Notification,
    StudentProfile,
    StudentSubjectAllocation,
    Subject,
    TeacherProfile,
    TeacherSubjectAssignment,
    User,
)

communication_bp = Blueprint("communication", __name__)
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx", "txt", "zip"}
UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "communication"))


def _extension_allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _user_name(user_id):
    user = User.query.get(user_id)
    return user.name if user else "Unknown user"


def _thread_payload(thread, current_user):
    student = StudentProfile.query.get(thread.student_id)
    teacher = TeacherProfile.query.get(thread.teacher_id)
    subject = Subject.query.get(thread.subject_id) if thread.subject_id else None
    student_user = User.query.get(student.user_id) if student else None
    teacher_user = User.query.get(teacher.user_id) if teacher else None
    messages = CommunicationMessage.query.filter_by(thread_id=thread.id).order_by(CommunicationMessage.created_at.asc()).all()
    unread = sum(1 for message in messages if message.sender_id != current_user.id and message.read_at is None)

    return {
        "id": thread.id,
        "subject": thread.subject,
        "category": thread.category,
        "status": thread.status,
        "created_at": thread.created_at.isoformat(),
        "updated_at": thread.updated_at.isoformat(),
        "unread_count": unread,
        "student": {"id": student.id, "name": student_user.name if student_user else "Unknown", "department_id": student.department_id, "semester": student.semester} if student else None,
        "teacher": {"id": teacher.id, "name": teacher_user.name if teacher_user else "Unknown"} if teacher else None,
        "subject_name": subject.name if subject else "General query",
        "messages": [{
            "id": message.id,
            "sender_id": message.sender_id,
            "sender_name": _user_name(message.sender_id),
            "sender_role": "teacher" if User.query.get(message.sender_id).role == "teacher" else "student",
            "message": message.message,
            "attachment_name": message.attachment_name,
            "attachment_url": f"/api/communication/attachments/{message.id}" if message.attachment_name else None,
            "created_at": message.created_at.isoformat(),
        } for message in messages],
    }


@communication_bp.route("/contacts", methods=["GET"])
@auth_required
def get_contacts():
    student = StudentProfile.query.filter_by(user_id=request.current_user.id).first()
    if request.current_user.role != "student" or not student:
        return jsonify({"error": "Student profile required"}), 403

    subject_ids = [subject.id for subject in Subject.query.join(StudentSubjectAllocation, StudentSubjectAllocation.subject_id == Subject.id).filter(StudentSubjectAllocation.student_id == student.id, Subject.is_active.is_(True)).all()]
    contacts = []
    roll_assignment = assigned_roll_number_faculty(student.roll_number)
    assignments = TeacherSubjectAssignment.query.filter(TeacherSubjectAssignment.subject_id.in_(subject_ids)).all() if subject_ids else []
    for assignment in assignments:
        teacher = TeacherProfile.query.get(assignment.teacher_id)
        subject = Subject.query.get(assignment.subject_id)
        teacher_user = User.query.get(teacher.user_id) if teacher else None
        if teacher and subject and teacher_user:
            is_roll_assigned = subject.code == "BCS501" and roll_assignment
            if is_roll_assigned and teacher_user.name != roll_assignment["teacher_name"]:
                continue
            contacts.append({
                "teacher_id": teacher.id,
                "teacher_name": teacher_user.name,
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "assignment_locked": bool(is_roll_assigned),
                "assignment_rule": "roll_number" if is_roll_assigned else None,
            })
    return jsonify({"contacts": contacts})


@communication_bp.route("/threads", methods=["GET"])
@auth_required
def get_threads():
    user = request.current_user
    if user.role == "student":
        student = StudentProfile.query.filter_by(user_id=user.id).first()
        if not student:
            return jsonify({"threads": []})
        threads = CommunicationThread.query.filter_by(student_id=student.id).order_by(CommunicationThread.updated_at.desc()).all()
    elif user.role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
        if not teacher:
            return jsonify({"threads": []})
        threads = CommunicationThread.query.filter_by(teacher_id=teacher.id).order_by(CommunicationThread.updated_at.desc()).all()
    elif user.role == "admin":
        threads = CommunicationThread.query.order_by(CommunicationThread.updated_at.desc()).all()
    else:
        return jsonify({"error": "Unsupported role"}), 403

    return jsonify({"threads": [_thread_payload(thread, user) for thread in threads]})


@communication_bp.route("/threads", methods=["POST"])
@auth_required
def create_thread():
    if request.current_user.role != "student":
        return jsonify({"error": "Only students can start a conversation"}), 403

    student = StudentProfile.query.filter_by(user_id=request.current_user.id).first()
    if not student:
        return jsonify({"error": "Student profile required"}), 403

    json_payload = request.get_json(silent=True) or {}
    teacher_id = request.form.get("teacher_id", type=int) or json_payload.get("teacher_id", 0)
    subject_id = request.form.get("subject_id", type=int) or json_payload.get("subject_id", 0)
    title = (request.form.get("subject") or json_payload.get("subject") or "Student query").strip()
    category = (request.form.get("category") or json_payload.get("category") or "Other").strip()
    message_text = (request.form.get("message") or json_payload.get("message") or "").strip()

    if not teacher_id or not message_text:
        return jsonify({"error": "Teacher and message are required"}), 400

    teacher = TeacherProfile.query.get(teacher_id)
    assigned = TeacherSubjectAssignment.query.filter_by(teacher_id=teacher_id, subject_id=subject_id).first() if subject_id else None
    enrolled = StudentSubjectAllocation.query.filter_by(student_id=student.id, subject_id=subject_id).first() if subject_id else None
    if subject_id and (not teacher or not assigned or not enrolled):
        return jsonify({"error": "Teacher is not assigned to this enrolled subject"}), 403

    subject = Subject.query.get(subject_id) if subject_id else None
    if subject_id and (not subject or not subject.is_active):
        return jsonify({"error": "This subject is not active"}), 403
    if subject and subject.code == "BCS501":
        required_assignment = assigned_roll_number_faculty(student.roll_number, subject.code)
        teacher_user = User.query.get(teacher.user_id) if teacher else None
        if required_assignment and (not teacher_user or teacher_user.name != required_assignment["teacher_name"]):
            return jsonify({"error": "Your roll number is assigned to a different faculty member for this subject"}), 403

    thread = CommunicationThread(student_id=student.id, teacher_id=teacher_id, subject_id=subject_id or None, subject=title, category=category, status="sent")
    db.session.add(thread)
    db.session.flush()

    attachment_name = None
    attachment_path = None
    uploaded = request.files.get("attachment")
    if uploaded and uploaded.filename:
        if not _extension_allowed(uploaded.filename):
            return jsonify({"error": "This attachment type is not allowed"}), 400
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        attachment_name = secure_filename(uploaded.filename)
        attachment_path = os.path.join(UPLOAD_FOLDER, f"{datetime.utcnow().timestamp()}_{attachment_name}")
        uploaded.save(attachment_path)

    db.session.add(CommunicationMessage(thread_id=thread.id, sender_id=request.current_user.id, message=message_text, attachment_name=attachment_name, attachment_path=attachment_path))
    db.session.commit()
    return jsonify({"thread": _thread_payload(thread, request.current_user)}), 201


@communication_bp.route("/threads/<int:thread_id>/messages", methods=["POST"])
@auth_required
def reply_to_thread(thread_id):
    thread = CommunicationThread.query.get_or_404(thread_id)
    teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
    student = StudentProfile.query.filter_by(user_id=request.current_user.id).first()

    if request.current_user.role == "student" and (not student or student.id != thread.student_id):
        return jsonify({"error": "Not allowed to access this conversation"}), 403
    if request.current_user.role == "teacher" and (not teacher or teacher.id != thread.teacher_id):
        return jsonify({"error": "Not allowed to access this conversation"}), 403

    payload = request.get_json(silent=True) or {}
    message_text = (payload.get("message") or "").strip()
    if not message_text:
        return jsonify({"error": "Message is required"}), 400

    db.session.add(CommunicationMessage(thread_id=thread.id, sender_id=request.current_user.id, message=message_text))
    student = StudentProfile.query.get(thread.student_id)
    teacher = TeacherProfile.query.get(thread.teacher_id)
    if student and request.current_user.role == "teacher":
        db.session.add(Notification(user_id=student.user_id, message="Your teacher replied to a Contact Teacher query.", type="student_query_reply"))
    elif teacher and request.current_user.role == "student":
        db.session.add(Notification(user_id=teacher.user_id, message="A new student query was received.", type="student_query"))
    thread.status = "replied"
    thread.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"thread": _thread_payload(thread, request.current_user)}), 201


@communication_bp.route("/threads/<int:thread_id>/read", methods=["POST"])
@auth_required
def mark_thread_read(thread_id):
    thread = CommunicationThread.query.get_or_404(thread_id)
    teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
    student = StudentProfile.query.filter_by(user_id=request.current_user.id).first()
    allowed = (request.current_user.role == "teacher" and teacher and teacher.id == thread.teacher_id) or (request.current_user.role == "student" and student and student.id == thread.student_id)
    if not allowed:
        return jsonify({"error": "Not allowed to access this conversation"}), 403
    for message in CommunicationMessage.query.filter_by(thread_id=thread.id).all():
        if message.sender_id != request.current_user.id and message.read_at is None:
            message.read_at = datetime.utcnow()
    if thread.status == "sent":
        thread.status = "delivered"
    db.session.commit()
    return jsonify({"thread": _thread_payload(thread, request.current_user)})


@communication_bp.route("/attachments/<int:message_id>", methods=["GET"])
@auth_required
def download_attachment(message_id):
    message = CommunicationMessage.query.get_or_404(message_id)
    thread = CommunicationThread.query.get_or_404(message.thread_id)
    teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
    student = StudentProfile.query.filter_by(user_id=request.current_user.id).first()
    allowed = (teacher and teacher.id == thread.teacher_id) or (student and student.id == thread.student_id) or request.current_user.role == "admin"
    if not allowed:
        return jsonify({"error": "Not allowed to access this attachment"}), 403
    if not message.attachment_path or not os.path.exists(message.attachment_path):
        return jsonify({"error": "Attachment not found"}), 404
    from flask import send_file
    return send_file(message.attachment_path, as_attachment=True, download_name=message.attachment_name)
