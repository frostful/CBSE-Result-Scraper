import os
import csv

from config import PREFIX_MAP_FILE
from storage.results_store import ensure_data_dir


def load_prefix_map():
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


def save_prefix_map(mapping):
    ensure_data_dir()
    with open(PREFIX_MAP_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Roll', 'Prefix', 'AdmitCardID'])
        for roll in sorted(mapping.keys()):
            writer.writerow([roll, mapping[roll][0], mapping[roll][1]])
