# deploy.py
import subprocess
import sys
import os

def run_command(command):
    process = subprocess.run(command, shell=True, capture_output=True, text=True)
    print(process.stdout)
    if process.stderr:
        print("Error:", process.stderr)
    return process.returncode == 0

def main():
    # Install Flet CLI
    print("Installing Flet CLI...")
    if not run_command(f"{sys.executable} -m pip install flet-cli"):
        print("Failed to install Flet CLI")
        return

    # Login to Flet (user will need to authenticate)
    print("Please login to Flet...")
    if not run_command("flet login"):
        print("Failed to login to Flet")
        return

    # Deploy the app
    print("Deploying the app...")
    if not run_command("flet publish main_web.py"):
        print("Failed to deploy app")
        return

    print("Deployment completed! Your app should now be available at your Flet URL")

if __name__ == "__main__":
    main()