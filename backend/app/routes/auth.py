from flask import Blueprint, request, jsonify
from app.auth import auth_required, generate_token
from app.models import User
from app.services.seed import seed_demo_data


auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "service": "college-management-api"})


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    seed_demo_data()
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.is_active:
        return jsonify({"error": "Account is inactive"}), 403

    token = generate_token(user)
    return jsonify({
        "token": token,
        "user": user.to_dict(),
    })


@auth_bp.route("/auth/profile", methods=["GET"])
@auth_required
def get_profile():
    user = request.current_user
    return jsonify({"user": user.to_dict()})
