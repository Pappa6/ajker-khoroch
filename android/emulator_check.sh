#!/bin/bash
# Installs the test copy on the emulator, opens it and records what it shows.
set -x
OUT=out/emulator
mkdir -p $OUT
adb install -r test-signed.apk > $OUT/install.txt 2>&1
adb shell dumpsys package com.pappa6.ajkerkhoroch | grep -iE "permission|versionName" > $OUT/package.txt 2>&1
adb logcat -c
adb shell am start -W -n com.pappa6.ajkerkhoroch/.MainActivity > $OUT/start.txt 2>&1
sleep 25
adb exec-out screencap -p > $OUT/screen1.png
adb shell input swipe 500 1500 500 500 400
sleep 3
adb exec-out screencap -p > $OUT/screen2.png
adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 && adb pull /sdcard/ui.xml $OUT/ui.xml > /dev/null 2>&1
adb logcat -d -v brief > $OUT/logcat-all.txt 2>&1
grep -iE "chromium|console|ajker|AndroidRuntime|FATAL" $OUT/logcat-all.txt | tail -300 > $OUT/logcat.txt
rm -f $OUT/logcat-all.txt
echo done > $OUT/done.txt
exit 0
