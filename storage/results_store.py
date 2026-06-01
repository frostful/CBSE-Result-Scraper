import os
import csv

from config import DATA_DIR


def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def get_existing_rolls(school_no):
    rolls = set()
    csv_file = os.path.join(DATA_DIR, f"{school_no}_results.csv")
    if os.path.exists(csv_file):
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    rolls.add(int(row['Roll'].strip()))
        except Exception:
            pass
    return rolls
