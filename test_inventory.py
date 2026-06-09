#!/usr/bin/env python3
import sys
import os
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

# Load environment variables
from dotenv import load_dotenv
env_file = Path(__file__).parent / ".env"
load_dotenv(env_file)

print("Testing inventory service...")
from app.services.inventory import list_resources

try:
    print("Calling list_resources()...")
    resources = list_resources()
    print(f"✓ Got {len(resources)} resources")
    for resource in resources[:5]:
        print(f"  - {resource['name']} ({resource['type']})")
except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
