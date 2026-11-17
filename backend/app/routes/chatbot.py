from flask import Blueprint, jsonify, request

from app.auth import auth_required
from app.services.chatbot_service import generate_chatbot_reply

chatbot_bp = Blueprint("chatbot", __name__)


@chatbot_bp.route("/chat", methods=["POST"])
@auth_required
def chat_with_assistant():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()

    if not message:
        return jsonify({"error": "Please enter a message for the assistant."}), 400

    raw_history = payload.get("history") if isinstance(payload.get("history"), list) else []
    history = [
        {"role": item.get("role"), "content": item.get("content", "")[:1000]}
        for item in raw_history[-12:]
        if isinstance(item, dict) and item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str)
    ]
    normalized_message = message.lower()
    follow_up = normalized_message.startswith((
        "and ", "what about", "how about", "for that", "tell me more",
        "which one", "same for", "those", "them", "why is that",
    ))
    previous_question = next(
        (item["content"] for item in reversed(history) if item["role"] == "user" and item["content"]),
        "",
    ) if follow_up else ""

    reply, suggestions, materials = generate_chatbot_reply(message, request.current_user, previous_question)
    return jsonify({
        "reply": reply,
        "suggestions": suggestions,
        "role": request.current_user.role,
        "materials": materials or [],
    })
