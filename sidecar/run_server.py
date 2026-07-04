"""PyInstaller entry point for the sidecar binary.

Imports the package with an absolute path so the relative imports inside
``mlxstudio`` resolve. Running ``mlxstudio/main.py`` directly would execute it as
``__main__`` with no parent package and break those imports.
"""

from mlxstudio.main import main

if __name__ == "__main__":
    main()
