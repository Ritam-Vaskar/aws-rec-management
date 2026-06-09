#!/usr/bin/env python3
import os
import sys
import boto3
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
env_file = Path(__file__).parent / ".env"
load_dotenv(env_file)

print("Environment variables loaded:")
print(f"  AWS_ACCESS_KEY_ID: {os.getenv('AWS_ACCESS_KEY_ID', 'NOT SET')}")
print(f"  AWS_SECRET_ACCESS_KEY: {'*' * 20 if os.getenv('AWS_SECRET_ACCESS_KEY') else 'NOT SET'}")
print(f"  AWS_DEFAULT_REGION: {os.getenv('AWS_DEFAULT_REGION', 'NOT SET')}")

try:
    print("\nCreating boto3 session...")
    session = boto3.Session(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_DEFAULT_REGION', 'ap-south-1'),
    )
    print("✓ Session created")
    
    print("Getting S3 client...")
    client = session.client('s3')
    print("✓ S3 client created")
    
    print("Listing buckets (this might take a moment)...")
    response = client.list_buckets()
    buckets = response.get('Buckets', [])
    print(f"✓ Found {len(buckets)} buckets:")
    for bucket in buckets:
        print(f"  - {bucket['Name']}")
        
except Exception as e:
    print(f"✗ Error: {type(e).__name__}: {e}")
    sys.exit(1)
