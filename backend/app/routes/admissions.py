from flask import Blueprint, jsonify, request
from datetime import datetime

from app import db
from app.auth import auth_required, role_required
from app.models import AdmissionApplication, AdmissionStatusHistory, AuditLog, Department, Notification, StudentProfile, User

admissions_bp = Blueprint("admissions", __name__)


@admissions_bp.route("", methods=["GET"])
@auth_required
@role_required("admin", "admission")
def list_applications():
    status = request.args.get("status")
    query = AdmissionApplication.query
    if status:
        query = query.filter_by(status=status)
    applications = query.order_by(AdmissionApplication.created_at.desc()).all()
    return jsonify({"applications": [{
        "id": item.id,
        "application_number": item.application_number,
        "applicant_name": item.applicant_name,
        "email": item.email,
        "phone": item.phone,
        "course": item.course,
        "semester": item.semester,
        "status": item.status,
        "fee_status": item.fee_status,
        "documents_verified": item.documents_verified,
        "student_profile_id": item.student_profile_id,
        "section": item.section,
        "roll_number": item.roll_number,
        "created_at": item.created_at.isoformat(),
    } for item in applications]})


@admissions_bp.route("/summary", methods=["GET"])
@auth_required
@role_required("admin", "admission")
def application_summary():
    applications = AdmissionApplication.query.all()
    return jsonify({"summary": {
        "total": len(applications),
        "pending_document_verification": sum(1 for item in applications if not item.documents_verified and item.status == "submitted"),
        "pending_approval": sum(1 for item in applications if item.documents_verified and item.status == "verified"),
        "approved": sum(1 for item in applications if item.status == "approved"),
        "rejected": sum(1 for item in applications if item.status == "rejected"),
    }})


@admissions_bp.route("", methods=["POST"])
def submit_application():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("applicant_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    course = (payload.get("course") or "B.E. Computer Science & Engineering").strip()
    if not name or not email:
        return jsonify({"error": "Applicant name and email are required"}), 400
    if AdmissionApplication.query.filter_by(email=email).first():
        return jsonify({"error": "An application already exists for this email"}), 409

    last = AdmissionApplication.query.order_by(AdmissionApplication.id.desc()).first()
    number = f"CAMP-{datetime.utcnow().year}-{((last.id + 1) if last else 1):05d}"
    application = AdmissionApplication(application_number=number, applicant_name=name, email=email, phone=(payload.get("phone") or "").strip(), course=course, semester=int(payload.get("semester") or 1))
    db.session.add(application)
    db.session.flush()
    db.session.add(AdmissionStatusHistory(application_id=application.id, status="submitted"))
    for admin in User.query.filter(User.role.in_(["admin", "admission"])).all():
        db.session.add(Notification(user_id=admin.id, message=f"New admission application {number} received.", type="admission"))
    db.session.commit()
    return jsonify({"message": "Application submitted successfully.", "application_number": number}), 201


@admissions_bp.route("/<int:application_id>/status", methods=["PATCH"])
@auth_required
@role_required("admin", "admission")
def update_application_status(application_id):
    application = AdmissionApplication.query.get_or_404(application_id)
    payload = request.get_json(silent=True) or {}
    status = (payload.get("status") or "").strip().lower()
    if status not in {"submitted", "verified", "approved", "rejected"}:
        return jsonify({"error": "Invalid application status"}), 400
    if status == "rejected" and not (payload.get("reason") or "").strip():
        return jsonify({"error": "A rejection reason is required"}), 400

    application.status = status
    application.documents_verified = bool(payload.get("documents_verified", status in {"verified", "approved"}))
    application.fee_status = (payload.get("fee_status") or application.fee_status).lower()
    application.decision_reason = payload.get("reason") or application.decision_reason
    application.updated_at = datetime.utcnow()
    db.session.add(AdmissionStatusHistory(application_id=application.id, status=status, reason=application.decision_reason, changed_by=request.current_user.id))
    db.session.add(AuditLog(user_id=request.current_user.id, action=f"admission_status_{status}", entity_type="admission_application", entity_id=application.id, details=application.decision_reason))
    db.session.commit()
    return jsonify({"message": "Application status updated successfully.", "application": application.application_number, "status": application.status})


@admissions_bp.route("/<int:application_id>/register", methods=["POST"])
@auth_required
@role_required("admin", "admission")
def register_approved_application(application_id):
    application = AdmissionApplication.query.get_or_404(application_id)
    if application.status != "approved":
        return jsonify({"error": "Only approved applications can be registered"}), 409
    if application.student_profile_id:
        return jsonify({"message": "Student record is already registered.", "student_profile_id": application.student_profile_id})

    payload = request.get_json(silent=True) or {}
    section = (payload.get("section") or "A").strip().upper()
    roll_number = (payload.get("roll_number") or "").strip()
    if section not in {"A", "B"} or not roll_number:
        return jsonify({"error": "Section and roll number are required"}), 400
    if StudentProfile.query.filter_by(roll_number=roll_number).first():
        return jsonify({"error": "This roll number is already assigned"}), 409

    user = User.query.filter_by(email=application.email.lower()).first()
    if not user:
        user = User(name=application.applicant_name, email=application.email.lower(), role="student", is_active=True)
        user.set_password(payload.get("password") or "student123")
        db.session.add(user)
        db.session.flush()
    elif user.role != "student":
        return jsonify({"error": "The email belongs to a non-student account"}), 409

    existing_profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if existing_profile:
        profile = existing_profile
        profile.semester = int(payload.get("semester") or application.semester)
        profile.section = section
        profile.roll_number = roll_number
    else:
        department = Department.query.filter_by(code="CSE").first()
        if not department:
            return jsonify({"error": "CSE department record is missing"}), 409
        profile = StudentProfile(user_id=user.id, roll_number=roll_number, department_id=department.id, semester=int(payload.get("semester") or application.semester), section=section, batch=str(datetime.utcnow().year))
        db.session.add(profile)
        db.session.flush()

    application.student_profile_id = profile.id
    application.section = section
    application.roll_number = roll_number
    application.status = "registered"
    db.session.add(AdmissionStatusHistory(application_id=application.id, status="registered", reason="Student record activated", changed_by=request.current_user.id))
    db.session.add(AuditLog(user_id=request.current_user.id, action="student_registered_from_application", entity_type="admission_application", entity_id=application.id, details=f"student_profile={profile.id}; roll={roll_number}; section={section}"))
    db.session.commit()
    return jsonify({"message": "Student registered successfully.", "student_profile_id": profile.id})
