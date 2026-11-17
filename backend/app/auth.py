import os
import jwt
from functools import wraps
from flask import request, jsonify
from .models import User


def generate_token(user):
    payload = {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
    }
    return jwt.encode(payload, os.getenv("SECRET_KEY", "college-secret-key"), algorithm="HS256")


def decode_token(token):
    try:
        return jwt.decode(token, os.getenv("SECRET_KEY", "college-secret-key"), algorithms=["HS256"])
    except Exception:
        return None


def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401

        token = header.split(" ", 1)[1]
        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Token invalid or expired"}), 401

        user = User.query.get(payload["user_id"])
        if not user or not user.is_active:
            return jsonify({"error": "User not found"}), 401

        request.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not hasattr(request, "current_user"):
                return jsonify({"error": "Authentication required"}), 401

            user = request.current_user
            if user.role not in roles:
                return jsonify({"error": "Forbidden: insufficient role permissions"}), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator
