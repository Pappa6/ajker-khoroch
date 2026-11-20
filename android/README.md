# আজকের খরচ — Android app

The Android app is the same `index.html` as the website, packed inside the APK, plus `web/app.js`:

- **Scan & pay** button at the top: scan any UPI QR, type the amount, pay in the UPI app you choose
  (PhonePe, Google Pay, Paytm, BHIM, a bank app). The PIN is typed only inside that UPI app.
- When the UPI app reports success, the spend is saved at once with its 12-digit UPI reference, so a later
  bank statement recognises it and never counts it twice.
- "What was it for?" is asked right after, with big buttons. "Later" (or simply scanning again) leaves it on
  a to-do list with a gentle reminder. Shops are remembered and not asked again.
- Voice entry uses the phone's own voice typing.

**Privacy:** the app has no INTERNET permission (the build fails if it ever gets one), allows no cloud backup,
and serves its pages only from inside the APK. Everything stays on the phone.

**Build:** `.github/workflows/android.yml` builds an unsigned APK on every change and puts it on the
`apk-build` branch. It is then signed with the owner's private key, which is kept by the owner and never
stored in this repository or on GitHub.
