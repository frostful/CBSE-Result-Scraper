import os
import csv
import tempfile

from config import PREFIX_MAP_FILE
from storage.results_store import ensure_data_dir


def load_prefix_map() -> dict[int, tuple[str, str]]:
    mapping = {}
    if os.path.exists(PREFIX_MAP_FILE):
        try:
            with open(PREFIX_MAP_FILE, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    roll = int(row['Roll'].strip())
                    mapping[roll] = (row['Prefix'].strip().upper(), row['AdmitCardID'].strip().upper())
        except Exception:
            pass
    return mapping


def save_prefix_map(mapping: dict[int, tuple[str, str]]) -> None:
    ensure_data_dir()
    # Write to a temp file in the same directory, then atomically rename.
    # This prevents corruption if the process crashes mid-write.
    dir_name = os.path.dirname(PREFIX_MAP_FILE)
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix='.tmp', prefix='prefix_map_')
    try:
        with os.fdopen(fd, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Roll', 'Prefix', 'AdmitCardID'])
            for roll in sorted(mapping.keys()):
                writer.writerow([roll, mapping[roll][0], mapping[roll][1]])
        os.replace(tmp_path, PREFIX_MAP_FILE)
    except Exception:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
