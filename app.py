"""
Entry point.

Run with:  python app.py
The Flask app is assembled in web/app_factory.py; routes live in web/routes.py.
"""
from web.app_factory import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=False, port=5000, threaded=True)
