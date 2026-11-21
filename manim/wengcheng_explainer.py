from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RENDER_SCRIPT = ROOT / "render_all.sh"


def main() -> int:
    """Render every scene and join them into output/wengcheng.mp4."""
    result = subprocess.run(["bash", str(RENDER_SCRIPT)], cwd=ROOT, check=False)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
