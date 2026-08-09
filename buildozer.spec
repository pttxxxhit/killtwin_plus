[app]
# (str) Title of your application
title = MiApp

# (str) Package name
package.name = miapp

# (str) Package domain (reverse domain notation)
package.domain = org.example

# (list) Source files to include (let empty to include all .py files)
source.include_exts = py,png,jpg,kv,txt

# (list) Application requirements
# Add here the Python packages your app needs (e.g. kivy, pillow)
requirements = python3,kivy,pillow

# (str) Supported orientation (one of: landscape, portrait or all)
orientation = portrait

# (str) Path to the application entry point, default is main.py
# Change this if your entrypoint has a different name
source.dir = .
source.include_patterns = 

[buildozer]
# (int) log level (0, 1, 2, 3, 4)
log_level = 2

[android]
# (str) Android API to use
android.api = 33

# (bool) Indicate if we should build an AAB. If using `buildozer android aab` the
# command will already request bundle format. Keep defaults here.
android.release_artifact = aab

# (str) Android archs
android.arch = armeabi-v7a, arm64-v8a, x86, x86_64

# (int) min SDK version
android.minapi = 21

# (str) Android entrypoint, default is org.kivy.android.PythonActivity
android.entrypoint = org.kivy.android.PythonActivity
[app]

# (str) Title of your application
title = Automatización de Tareas

# (str) Package name
package.name = automatizacion_tareas

# (str) Package domain (needed for android/ios packaging)
package.domain = org.automatizacion

# (str) Source code where the main.py live
source.dir = .

# (list) Source files to include (let empty to include all the files)
source.include_exts = py,png,jpg,kv,atlas,json

# (list) List of inclusions using pattern matching
source.include_patterns = assets/*

# (str) Application versioning (method 1)
version = 0.1

# (list) Application requirements
requirements = python3,flet,pillow,kivy

# (str) Presplash of the application
#presplash.filename = %(source.dir)s/data/presplash.png

# (str) Icon of the application
#icon.filename = %(source.dir)s/data/icon.png

# (str) Supported orientation (one of landscape, sensorLandscape, portrait or all)
orientation = portrait

# (bool) Indicate if the application should be fullscreen or not
fullscreen = 0

#
# Android specific
#

# (list) Permissions
android.permissions = WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE

# (int) Target Android API, should be as high as possible.
android.api = 33

# (int) Minimum API your APK / AAB will support.
android.minapi = 21

# (str) Android NDK version to use
android.ndk = 25b

# (bool) If True, then skip trying to update the Android sdk
# This can be useful to avoid excess Internet downloads or save time
# when an update is due and you just want to test/build your package
android.skip_update = False

# (bool) If True, then automatically accept SDK license
# agreements. This is intended for automation only. If set to False,
# the default, you will be shown the license when first running
# buildozer.
android.accept_sdk_license = True

# (str) The Android arch to build for, choices: armeabi-v7a, arm64-v8a, x86, x86_64
android.arch = arm64-v8a

# (bool) enables Android auto backup feature (Android API >=23)
android.allow_backup = True

#
# Python for android (p4a) specific
#

# (str) python-for-android URL to use for checkout
#p4a.url =

# (str) python-for-android fork to use in case if p4a.url is not specified, defaults to upstream (kivy)
#p4a.fork = kivy

# (str) python-for-android branch to use, defaults to master
#p4a.branch = master

# (str) python-for-android specific commit to use, defaults to HEAD, must be within p4a.branch
#p4a.commit = HEAD

# (str) python-for-android git clone directory
#p4a.source_dir =

# (str) The directory in which python-for-android should look for your own build recipes (if any)
#p4a.local_recipes =

# (str) Filename to the hook for p4a
#p4a.hook =

# (str) Bootstrap to use for android builds
# p4a.bootstrap = sdl2

# (int) port number to specify an explicit --port= p4a argument (eg for bootstrap flask)
#p4a.port =

[buildozer]

# (int) Log level (0 = error only, 1 = info, 2 = debug (with command output))
log_level = 2

# (int) Display warning if buildozer is run as root (0 = False, 1 = True)
warn_on_root = 1

# (str) Path to build artifact storage, absolute or relative to spec file
build_dir = ./.buildozer

# (str) Path to build output (i.e. .apk, .aab, .ipa) storage
bin_dir = ./bin