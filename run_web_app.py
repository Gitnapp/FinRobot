#!/usr/bin/env python3
"""Start the local Garage Research Desk. Build frontend with pnpm build first."""

import argparse
import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Garage Research")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    os.chdir(Path(__file__).resolve().parent)
    # Parse credentials as data, never as shell commands. The project file is
    # authoritative over inherited values and is excluded from version control.
    load_dotenv(Path.cwd() / ".env", override=True, interpolate=False)
    uvicorn.run(
        "finrobot_equity.research_desk.main:app",
        host="127.0.0.1",
        port=args.port,
        reload=args.reload,
    )
