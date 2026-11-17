import os
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from app import db
from app.auth import auth_required
from app.models import Notification, StudentProfile, StudentSubjectAllocation, StudyMaterial, Subject, TeacherProfile, TeacherSubjectAssignment, User

materials_bp = Blueprint("materials", __name__)
UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "materials"))
ALLOWED_EXTENSIONS = {"pdf", "ppt", "pptx", "doc", "docx", "txt", "zip", "png", "jpg", "jpeg"}
MAX_FILE_SIZE = 25 * 1024 * 1024


def safe_file_name(name):
    return secure_filename(name or "resource")


def authorized_teacher_subject(teacher, subject_id):
    if not teacher:
        return False
    subject = Subject.query.filter_by(id=subject_id, is_active=True).first()
    return bool(subject and TeacherSubjectAssignment.query.filter_by(teacher_id=teacher.id, subject_id=subject_id).first())


def material_payload(material):
    subject = Subject.query.get(material.subject_id)
    teacher = TeacherProfile.query.get(material.teacher_id)
    teacher_user = User.query.get(teacher.user_id) if teacher else None
    return {
        "id": material.id,
        "title": material.title,
        "description": material.description,
        "category": material.category,
        "module_number": material.module_number,
        "semester": material.semester,
        "academic_year": material.academic_year,
        "examination_type": material.examination_type,
        "file_name": material.file_name,
        "file_type": material.file_type,
        "file_size": material.file_size,
        "published": material.published,
        "uploaded_at": material.uploaded_at.isoformat(),
        "subject_id": material.subject_id,
        "subject_name": subject.name if subject else "Unknown subject",
        "subject_code": subject.code if subject else "",
        "teacher_name": teacher_user.name if teacher_user else "Unknown teacher",
        "download_url": f"/api/materials/{material.id}/download",
        "preview_url": f"/api/materials/{material.id}/preview" if material.file_type in {"pdf", "png", "jpg", "jpeg"} else None,
    }


@materials_bp.route("/subjects", methods=["GET"])
@auth_required
def authorized_subjects():
    if request.current_user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=request.current_user.id).first()
        if not profile:
            return jsonify({"subjects": []})
        allocations = StudentSubjectAllocation.query.filter_by(student_id=profile.id).all()
        subject_ids = [item.subject_id for item in allocations]
        subjects = Subject.query.filter(Subject.id.in_(subject_ids), Subject.is_active.is_(True)).order_by(Subject.name).all() if subject_ids else []
    elif request.current_user.role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
        if not teacher:
            return jsonify({"subjects": []})
        assignments = TeacherSubjectAssignment.query.filter_by(teacher_id=teacher.id).all()
        subject_ids = [item.subject_id for item in assignments]
        subjects = Subject.query.filter(Subject.id.in_(subject_ids), Subject.is_active.is_(True)).order_by(Subject.name).all() if subject_ids else []
    elif request.current_user.role == "admin":
        subjects = Subject.query.filter_by(is_active=True).order_by(Subject.name).all()
    else:
        return jsonify({"subjects": []})
    return jsonify({"subjects": [{"id": item.id, "name": item.name, "code": item.code} for item in subjects]})


@materials_bp.route("", methods=["GET"])
@auth_required
def list_materials():
    query = StudyMaterial.query
    if request.current_user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=request.current_user.id).first()
        enrolled_ids = [item.subject_id for item in StudentSubjectAllocation.query.filter_by(student_id=profile.id).all()] if profile else []
        query = query.join(Subject, Subject.id == StudyMaterial.subject_id).filter(Subject.is_active.is_(True), StudyMaterial.subject_id.in_(enrolled_ids), StudyMaterial.published.is_(True)) if enrolled_ids else query.filter(db.false())
        semester = request.args.get("semester", type=int)
        if semester:
            query = query.filter(StudyMaterial.semester == semester)
    elif request.current_user.role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
        assigned_ids = [item.subject_id for item in TeacherSubjectAssignment.query.join(Subject, Subject.id == TeacherSubjectAssignment.subject_id).filter(TeacherSubjectAssignment.teacher_id == teacher.id, Subject.is_active.is_(True)).all()] if teacher else []
        query = query.filter(StudyMaterial.teacher_id == teacher.id, StudyMaterial.subject_id.in_(assigned_ids)) if teacher else query.filter(db.false())
    elif request.current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    subject_id = request.args.get("subject_id", type=int)
    module_number = request.args.get("module", type=int)
    category = request.args.get("category")
    academic_year = request.args.get("academic_year")
    search = request.args.get("search", "").strip()
    if subject_id:
        query = query.filter_by(subject_id=subject_id)
    if module_number:
        query = query.filter_by(module_number=module_number)
    if category:
        query = query.filter_by(category=category)
    if academic_year:
        query = query.filter_by(academic_year=academic_year)
    if search:
        query = query.filter(StudyMaterial.title.ilike(f"%{search}%"))

    query = query.order_by(StudyMaterial.uploaded_at.desc() if request.args.get("sort", "newest") != "oldest" else StudyMaterial.uploaded_at.asc())
    materials = query.all()
    return jsonify({"materials": [material_payload(item) for item in materials]})


@materials_bp.route("", methods=["POST"])
@auth_required
def upload_material():
    if request.current_user.role != "teacher":
        return jsonify({"error": "Only teachers can upload study materials"}), 403

    teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
    subject_id = request.form.get("subject_id", type=int)
    if not teacher or not subject_id or not authorized_teacher_subject(teacher, subject_id):
        return jsonify({"error": "You are not authorized to upload for this subject"}), 403

    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "A file is required"}), 400
    extension = uploaded.filename.rsplit(".", 1)[-1].lower() if "." in uploaded.filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported file type"}), 400
    uploaded.stream.seek(0, os.SEEK_END)
    file_size = uploaded.stream.tell()
    uploaded.stream.seek(0)
    if file_size > MAX_FILE_SIZE:
        return jsonify({"error": "File size exceeds 25 MB"}), 400

    title = request.form.get("title", "").strip()
    if not title:
        return jsonify({"error": "Resource title is required"}), 400
    category = request.form.get("category", "Other")
    module_number = request.form.get("module_number", type=int)
    semester = request.form.get("semester", type=int) or 5
    academic_year = request.form.get("academic_year", "").strip()
    examination_type = request.form.get("examination_type") or None

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    original_name = safe_file_name(uploaded.filename)
    stored_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{original_name}"
    stored_path = os.path.join(UPLOAD_FOLDER, stored_name)
    uploaded.save(stored_path)

    material = StudyMaterial(
        teacher_id=teacher.id,
        subject_id=subject_id,
        title=title,
        description=request.form.get("description", "").strip(),
        category=category,
        module_number=module_number,
        semester=semester,
        academic_year=academic_year,
        examination_type=examination_type,
        file_name=original_name,
        stored_name=stored_name,
        file_path=stored_path,
        file_type=extension,
        file_size=file_size,
        published=request.form.get("published", "true").lower() != "false",
    )
    db.session.add(material)
    db.session.flush()
    if material.published:
        student_profiles = StudentProfile.query.join(StudentSubjectAllocation, StudentSubjectAllocation.student_id == StudentProfile.id).filter(StudentSubjectAllocation.subject_id == subject_id).all()
        for student in student_profiles:
            db.session.add(Notification(user_id=student.user_id, message=f"New study material published: {title}", type="study_material"))
    db.session.commit()
    return jsonify({"message": "Study material uploaded successfully.", "material": material_payload(material)}), 201


@materials_bp.route("/<int:material_id>", methods=["PATCH"])
@auth_required
def edit_material(material_id):
    if request.current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403
    teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
    material = StudyMaterial.query.get_or_404(material_id)
    if not teacher or material.teacher_id != teacher.id:
        return jsonify({"error": "You can only edit your own resources"}), 403

    payload = request.form if request.files else request.get_json(silent=True) or {}
    for field in ("title", "description", "category", "academic_year", "examination_type"):
        if field in payload:
            setattr(material, field, payload[field].strip() if isinstance(payload[field], str) else payload[field])
    for field in ("module_number", "semester"):
        if field in payload and payload[field] not in (None, ""):
            setattr(material, field, int(payload[field]))
    if "published" in payload:
        value = payload["published"]
        material.published = str(value).lower() in {"true", "1", "yes"}

    uploaded = request.files.get("file")
    if uploaded and uploaded.filename:
        extension = uploaded.filename.rsplit(".", 1)[-1].lower() if "." in uploaded.filename else ""
        if extension not in ALLOWED_EXTENSIONS:
            return jsonify({"error": "Unsupported file type"}), 400
        uploaded.stream.seek(0, os.SEEK_END)
        replacement_size = uploaded.stream.tell()
        uploaded.stream.seek(0)
        if replacement_size > MAX_FILE_SIZE:
            return jsonify({"error": "File size exceeds 25 MB"}), 400
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        original_name = safe_file_name(uploaded.filename)
        stored_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{original_name}"
        stored_path = os.path.join(UPLOAD_FOLDER, stored_name)
        uploaded.save(stored_path)
        if material.file_path and os.path.exists(material.file_path):
            os.remove(material.file_path)
        material.file_name = original_name
        material.stored_name = stored_name
        material.file_path = stored_path
        material.file_type = extension
        material.file_size = os.path.getsize(stored_path)

    material.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "Study material updated successfully.", "material": material_payload(material)})


@materials_bp.route("/<int:material_id>", methods=["DELETE"])
@auth_required
def delete_material(material_id):
    if request.current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403
    teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
    material = StudyMaterial.query.get_or_404(material_id)
    if not teacher or material.teacher_id != teacher.id:
        return jsonify({"error": "You can only delete your own resources"}), 403
    if material.file_path and os.path.exists(material.file_path):
        os.remove(material.file_path)
    db.session.delete(material)
    db.session.commit()
    return jsonify({"message": "Study material deleted successfully."})


def _can_access_material(material):
    subject = Subject.query.get(material.subject_id)
    if not subject or not subject.is_active:
        return False
    if request.current_user.role == "admin":
        return True
    if request.current_user.role == "teacher":
        teacher = TeacherProfile.query.filter_by(user_id=request.current_user.id).first()
        return bool(teacher and material.teacher_id == teacher.id)
    if request.current_user.role == "student":
        student = StudentProfile.query.filter_by(user_id=request.current_user.id).first()
        if not student or not material.published:
            return False
        return bool(StudentSubjectAllocation.query.filter_by(student_id=student.id, subject_id=material.subject_id).first())
    return False


@materials_bp.route("/<int:material_id>/download", methods=["GET"])
@auth_required
def download_material(material_id):
    material = StudyMaterial.query.get_or_404(material_id)
    if not _can_access_material(material):
        return jsonify({"error": "You are not authorized to access this resource"}), 403
    if not os.path.exists(material.file_path):
        return jsonify({"error": "File not found"}), 404
    return send_file(material.file_path, as_attachment=True, download_name=material.file_name)


@materials_bp.route("/<int:material_id>/preview", methods=["GET"])
@auth_required
def preview_material(material_id):
    material = StudyMaterial.query.get_or_404(material_id)
    if not _can_access_material(material):
        return jsonify({"error": "You are not authorized to access this resource"}), 403
    if material.file_type not in {"pdf", "png", "jpg", "jpeg"}:
        return jsonify({"error": "Preview is not supported for this file type"}), 415
    if not os.path.exists(material.file_path):
        return jsonify({"error": "File not found"}), 404
    return send_file(material.file_path, as_attachment=False, download_name=material.file_name)
