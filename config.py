"""
Central configuration: paths and runtime tunables.

This file lives at the PROJECT ROOT on purpose. All paths are resolved relative
to this file so that moving modules into subpackages (cbse/, engine/, etc.) never
changes where `data/` is found.
"""
import os

# --- Paths -------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
PREFIX_MAP_FILE = os.path.join(DATA_DIR, 'prefix_map.csv')

# --- Runtime tunables --------------------------------------------------------
DEMO_MODE = False      # masks sensitive data in the UI for video recording
MAX_WORKERS = 20       # hard cap on concurrent browser contexts
MAX_LOG_LINES = 10000  # log buffer size before truncation
