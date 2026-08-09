GitHub Actions: build AAB with Buildozer

This repository includes a GitHub Actions workflow that builds an Android App Bundle (AAB) using the official Buildozer Docker image.

How it works
- On push to `main` or when you trigger the workflow manually, Actions will run the `build-aab.yml` workflow.
- The workflow runs the `kivy/buildozer:latest` Docker image and executes:

  buildozer -v android aab

- The generated AAB is uploaded as an artifact named `android-aab`.

Before running
- Edit `buildozer.spec` to set `title`, `package.name`, `package.domain` and `requirements` correctly.
- Make sure any native resources (images, `.kv` files, etc.) are included in the repo and referenced in `buildozer.spec`.

Triggering a build
- Push your changes to `main` or go to the Actions tab on GitHub and run "Run workflow" for "Build AAB (Buildozer)".

Notes & troubleshooting
- The Docker image includes most dependencies; if the build fails, open the workflow run log to see missing system libs or Python packages and update `buildozer.spec` accordingly.
- If you prefer builds on your machine, consider installing WSL + Ubuntu and running Buildozer there.
