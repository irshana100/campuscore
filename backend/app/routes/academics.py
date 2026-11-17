from flask import Blueprint, jsonify, request
from app.auth import auth_required, role_required
from app.models import AttendanceRecord, StudentProfile, Subject, User, Notice, StudentSubjectAllocation, Assessment, Mark, Assignment, TeacherProfile, TeacherSubjectAssignment
from app.services.analytics import compute_attendance_summary, attendance_threshold_projection, extract_notice_keywords


academics_bp = Blueprint("academics", __name__)


@academics_bp.route("/attendance", methods=["GET"])
@auth_required
def get_attendance():
    user = request.current_user
    if user.role != "student":
        return jsonify({"error": "Student authentication required"}), 403
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({"attendance": [], "projection": {"current_percentage": 0, "threshold": 75, "needed_classes": 0, "max_miss_allowed": 0, "warning": "No attendance records"}})
    active_subject_ids = [item.id for item in Subject.query.join(StudentSubjectAllocation, StudentSubjectAllocation.subject_id == Subject.id).filter(StudentSubjectAllocation.student_id == profile.id, Subject.is_active.is_(True)).all()]
    records = AttendanceRecord.query.filter(AttendanceRecord.student_id == profile.id, AttendanceRecord.subject_id.in_(active_subject_ids)).all() if active_subject_ids else []
    summary = compute_attendance_summary([{"subject_id": item.subject_id, "status": item.status} for item in records])
    threshold = attendance_threshold_projection([{"status": item.status} for item in records])
    return jsonify({"attendance": summary, "projection": threshold})


@academics_bp.route("/analytics/academic-support", methods=["GET"])
@auth_required
def academic_support():
    user = request.current_user
    if user.role == "admin":
        students = StudentProfile.query.join(User, User.id == StudentProfile.user_id).filter(User.is_active.is_(True)).all()
    elif user.role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
        assignments = TeacherSubjectAssignment.query.filter_by(teacher_id=teacher.id).all() if teacher else []
        students = []
        seen = set()
        for assignment in assignments:
            allocations = StudentSubjectAllocation.query.filter_by(subject_id=assignment.subject_id).all()
            for allocation in allocations:
                student = StudentProfile.query.get(allocation.student_id)
                student_user = User.query.get(student.user_id) if student else None
                if student and student_user and student_user.is_active and (not assignment.section or student.section == assignment.section) and student.id not in seen:
                    students.append(student)
                    seen.add(student.id)
    elif user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        students = [profile] if profile else []
    else:
        return jsonify({"error": "Forbidden"}), 403
    data = []
    for student in students:
        records = AttendanceRecord.query.filter_by(student_id=student.id).all()
        present = sum(1 for item in records if item.status == 'present')
        percentage = round((present / len(records)) * 100, 2) if records else 0
        data.append({
            "student": student.roll_number,
            "attendance_percentage": percentage,
            "status": "needs support" if percentage < 75 else "stable",
        })
    return jsonify({"support_summary": data})


@academics_bp.route("/notices/process", methods=["POST"])
@auth_required
@role_required("admin", "teacher")
def process_notice():
    payload = request.get_json(silent=True) or {}
    content = payload.get("content", "")
    if not content:
        return jsonify({"error": "Notice content is required"}), 400

    result = extract_notice_keywords(content)
    return jsonify({
        "keywords": result,
        "message": "Notice processed successfully and requires review before publishing",
    })


@academics_bp.route("/assessments", methods=["GET"])
@auth_required
def get_assessments():
    user = request.current_user
    if user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return jsonify({"assessments": []})
        marks = Mark.query.filter_by(student_id=profile.id).all()
        results = [item for item in marks if (Assessment.query.get(item.assessment_id) and Assessment.query.get(item.assessment_id).published)]
    elif user.role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=user.id).first()
        subject_ids = [item.subject_id for item in TeacherSubjectAssignment.query.filter_by(teacher_id=teacher.id).all()] if teacher else []
        results = Mark.query.filter(Mark.subject_id.in_(subject_ids)).all() if subject_ids else []
    elif user.role == "admin":
        results = Mark.query.all()
    else:
        return jsonify({"error": "Forbidden"}), 403
    return jsonify({
        "assessments": [{"id": item.id, "student_id": item.student_id, "subject_id": item.subject_id, "marks_obtained": item.marks_obtained, "exam_type": item.exam_type} for item in results]
    })
