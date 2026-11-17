from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
from werkzeug.middleware.proxy_fix import ProxyFix
from .config import Config


db = SQLAlchemy()


def _upgrade_existing_schema():
    additions = {
        "assessments": {"published": "BOOLEAN NOT NULL DEFAULT 0"},
        "submissions": {"marks_obtained": "FLOAT", "feedback": "TEXT"},
        "assignments": {"max_marks": "FLOAT NOT NULL DEFAULT 100", "section": "VARCHAR(20)"},
        "notices": {"subject_id": "INTEGER", "teacher_id": "INTEGER"},
        "communication_messages": {"read_at": "DATETIME"},
        "subjects": {"is_active": "BOOLEAN NOT NULL DEFAULT 1"},
    }
    inspector = inspect(db.engine)
    for table, columns in additions.items():
        if not inspector.has_table(table):
            continue
        existing = {column["name"] for column in inspector.get_columns(table)}
        for name, definition in columns.items():
            if name not in existing:
                db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
    db.session.commit()


def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    app.config.from_object(Config)

    allowed_origins = app.config.get("FRONTEND_URLS", [app.config.get("FRONTEND_URL", "http://localhost:5173")])
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    db.init_app(app)

    from . import models  # noqa: F401
    from .routes.auth import auth_bp
    from .routes.dashboard import dashboard_bp
    from .routes.academics import academics_bp
    from .routes.chatbot import chatbot_bp
    from .routes.communication import communication_bp
    from .routes.materials import materials_bp
    from .routes.admissions import admissions_bp
    from .routes.teacher import teacher_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp, url_prefix="/api")
    app.register_blueprint(academics_bp, url_prefix="/api")
    app.register_blueprint(chatbot_bp, url_prefix="/api")
    app.register_blueprint(communication_bp, url_prefix="/api/communication")
    app.register_blueprint(materials_bp, url_prefix="/api/materials")
    app.register_blueprint(admissions_bp, url_prefix="/api/admissions")
    app.register_blueprint(teacher_bp, url_prefix="/api")

    with app.app_context():
        db.create_all()
        _upgrade_existing_schema()

    return app
