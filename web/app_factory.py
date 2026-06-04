import os
from flask import Flask
from config import PROJECT_ROOT


def create_app() -> Flask:
    app = Flask(__name__, static_folder=os.path.join(PROJECT_ROOT, 'static'))

    from web.routes import init_routes
    init_routes(app)

    return app
