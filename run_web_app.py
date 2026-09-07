#!/usr/bin/env python3
"""Start the local Garage Research Desk. Build frontend with pnpm build first."""

import argparse
import os
from pathlib import Path

import uvicorn

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Garage Research · FinRobot")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    os.chdir(Path(__file__).resolve().parent)
    uvicorn.run(
        "finrobot_equity.research_desk.main:app",
        host="127.0.0.1",
        port=args.port,
        reload=args.reload,
    )
