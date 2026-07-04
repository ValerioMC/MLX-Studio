"""Test env setup. Must run before any mlxstudio import: several modules call
get_settings() at import time, and we want them pointed at a throwaway dir."""

import os
import tempfile

os.environ.setdefault("MLXSTUDIO_APP_DIR", tempfile.mkdtemp(prefix="mlxstudio-test-"))
