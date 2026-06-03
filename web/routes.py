"""
HTTP routes and the background-scrape thread glue.

The module-level state (log_lines / scraping_in_progress / stop_event / log_lock)
mirrors the original single-process design: one scrape at a time, logs polled by
the front end.
"""
import os
import re
import glob
import threading

from flask import jsonify, request, send_file

from config import DATA_DIR, MAX_LOG_LINES, MAX_WORKERS
from engine.runner import run_scraper_generator as playwright_scraper
from analytics.analyzer import get_dashboard_data, delete_database, delete_record, generate_excel_bytes

log_lines = []
scraping_in_progress = False
stop_event = threading.Event()
log_lock = threading.Lock()


def _sanitize_identifier(value):
    """Strip a value to alphanumeric + underscore only. Prevents path traversal."""
    if not value or not isinstance(value, str):
        return None
    cleaned = re.sub(r'[^A-Za-z0-9_]', '', value)
    return cleaned if cleaned else None


def _validate_positive_int(value):
    """Return int if value is a positive integer string, else None."""
    try:
        n = int(value)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None


def scraping_task(school_no, centre_mid, roll_start, roll_end, state="default", workers=1):
    global scraping_in_progress
    try:
        for msg in playwright_scraper(school_no, centre_mid, roll_start, roll_end, stop_event, state, workers):
            if msg in ("STOPPED", "DONE", "__FINISHED__"):
                with log_lock:
                    log_lines.append(msg)
                if msg == "STOPPED":
                    break
                continue
            with log_lock:
                if len(log_lines) < MAX_LOG_LINES:
                    log_lines.append(msg)
                elif len(log_lines) == MAX_LOG_LINES:
                    log_lines.append("[!] Log buffer full. Further output truncated.")
    except Exception as e:
        with log_lock:
            log_lines.append(f"[X] Unhandled Exception: {str(e)}")
    finally:
        scraping_in_progress = False
        with log_lock:
            log_lines.append("__FINISHED__")


def init_routes(app):
    @app.route('/favicon.ico')
    def favicon():
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
            '<rect width="32" height="32" rx="6" fill="#4F46E5"/>'
            '<text x="16" y="22" text-anchor="middle" font-size="14" fill="white" font-family="sans-serif">C</text>'
            '</svg>'
        )
        return svg, 200, {'Content-Type': 'image/svg+xml'}

    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    @app.route('/api/list_schools')
    def list_schools():
        files = glob.glob(os.path.join(DATA_DIR, '*_results.csv'))
        schools = [os.path.basename(f).replace('_results.csv', '') for f in files]
        return jsonify({"schools": sorted(list(set(schools)))})

    @app.route('/api/dashboard_data')
    def dashboard_data():
        school_no = _sanitize_identifier(request.args.get('school_no'))
        if not school_no:
            return jsonify({"error": "No school selected"}), 400
        data = get_dashboard_data(school_no)
        return jsonify(data)

    @app.route('/api/status', methods=['GET'])
    def scraper_status():
        return jsonify({"scraping": scraping_in_progress})

    @app.route('/api/start_scrape', methods=['POST'])
    def start_scrape():
        global scraping_in_progress
        data = request.json or {}
        school_no  = _sanitize_identifier(data.get('school_no'))
        centre_mid = _sanitize_identifier(data.get('centre_mid'))
        roll_start = _validate_positive_int(data.get('roll_start'))
        roll_end   = _validate_positive_int(data.get('roll_end'))
        state      = _sanitize_identifier(data.get('state', 'default')) or 'default'
        workers    = max(1, min(int(data.get('workers', 1)), MAX_WORKERS))

        if not all([school_no, centre_mid, roll_start, roll_end]):
            return jsonify({"status": "error", "message": "Missing or invalid required fields."}), 400

        with log_lock:
            if scraping_in_progress:
                return jsonify({"status": "error", "message": "Scraping already in progress."}), 400
            scraping_in_progress = True
            log_lines.clear()

        stop_event.clear()
        thread = threading.Thread(
            target=scraping_task,
            args=(school_no, centre_mid, roll_start, roll_end, state, workers),
            daemon=True
        )
        thread.start()
        return jsonify({"status": "success", "message": "Scraping started."})

    @app.route('/api/stop_scrape', methods=['POST'])
    def stop_scrape():
        if scraping_in_progress:
            stop_event.set()
            return jsonify({"status": "success", "message": "Stopping scraper..."})
        return jsonify({"status": "error", "message": "No scraping in progress."}), 400

    @app.route('/api/poll_logs')
    def poll_logs():
        since = int(request.args.get('since', 0))
        with log_lock:
            new_lines = log_lines[since:]
            total = len(log_lines)
        return jsonify({
            "lines": new_lines,
            "total": total,
            "scraping": scraping_in_progress
        })

    @app.route('/api/delete_database', methods=['DELETE'])
    def api_delete_database():
        school_no = _sanitize_identifier(request.args.get('school_no'))
        if not school_no:
            return jsonify({"status": "error", "message": "Invalid school number."}), 400
        success = delete_database(school_no)
        if success:
            return jsonify({"status": "success", "message": "Database cleared."})
        return jsonify({"status": "error", "message": "Failed to clear database."}), 500

    @app.route('/api/export_excel', methods=['GET'])
    def export_excel():
        school_no = _sanitize_identifier(request.args.get('school_no'))
        if not school_no:
            return "Invalid school number.", 400
        excel_stream = generate_excel_bytes(school_no)
        if not excel_stream:
            return "No data found.", 404
        return send_file(
            excel_stream,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'{school_no}_class_results.xlsx'
        )

    @app.route('/api/delete_record/<roll>', methods=['DELETE'])
    def api_delete_record(roll):
        school_no = _sanitize_identifier(request.args.get('school_no'))
        validated_roll = _validate_positive_int(roll)
        if not school_no or not validated_roll:
            return jsonify({"status": "error", "message": "Invalid school number or roll."}), 400
        success = delete_record(str(validated_roll), school_no)
        if success:
            return jsonify({"status": "success", "message": f"Student {validated_roll} deleted."})
        return jsonify({"status": "error", "message": f"Failed to delete student {validated_roll}."}), 500
