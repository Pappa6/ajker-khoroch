#!/usr/bin/env python3
"""Copy the website (index.html + lib/) into the Android app and add the app-only parts.

The website stays the single source: every APK build takes the current index.html,
swaps the Google Fonts link for fonts bundled in the app (the app has no internet),
and adds app.js (scanner, UPI payment, purpose question, reminders) and jsQR.js.
Usage: python3 android/prep_web.py   (run from the repository root)
"""
import os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "android", "web")
OUT = os.path.join(ROOT, "android", "app", "src", "main", "assets", "www")

def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

    csp_old = re.search(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', html)
    if not csp_old:
        sys.exit("CSP meta not found")
    csp = ("default-src 'none'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; "
           "font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: mediastream:; connect-src 'self' blob: data:; "
           "worker-src 'self' blob:; form-action 'none'; base-uri 'none'")
    html = html.replace(csp_old.group(0), f'<meta http-equiv="Content-Security-Policy" content="{csp}">')

    n0 = len(html)
    html = re.sub(r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*', "", html)
    html, k = re.subn(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2[^"]*">',
                      '<link rel="stylesheet" href="fonts.css">', html)
    if k != 1:
        sys.exit("font link not found")
    html = re.sub(r'<link rel="manifest"[^>]*>\s*', "", html)

    if html.count("</body>") != 1:
        sys.exit("</body> not unique")
    html = html.replace("</body>", '<script src="jsQR.js"></script>\n<script src="app.js"></script>\n</body>')
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)

    shutil.copytree(os.path.join(ROOT, "lib"), os.path.join(OUT, "lib"))
    for f in ["app.js", "jsQR.js", "fonts.css", "LICENSE-jsQR.txt"]:
        shutil.copy(os.path.join(WEB, f), os.path.join(OUT, f))
    shutil.copytree(os.path.join(WEB, "fonts"), os.path.join(OUT, "fonts"))
    for f in ["icon-192.png"]:
        if os.path.exists(os.path.join(ROOT, f)):
            shutil.copy(os.path.join(ROOT, f), os.path.join(OUT, f))
    print("web files ready in", OUT)

if __name__ == "__main__":
    main()
