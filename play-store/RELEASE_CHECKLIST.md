# BERUR TRADES — Google Play release checklist

## Completed in source
- Separate Android `play` and `direct` product flavors.
- Play flavor opens the website with `distribution=play`.
- Play edition does not mount the Deriv account execution desk, broker OAuth login, order submission, early close, automatic execution, Deriv Bot XML export, external Deriv Bot launch, or M-PESA membership checkout.
- Play edition retains market observation, charting and educational analysis surfaces.
- Android target SDK 36, package ID `com.berurtrades.app`, version code 4 / version name 1.3.
- Public privacy policy page created at `/privacy-policy.html`.
- Store listing draft saved in `play-store/STORE_LISTING.md`.

## Build outputs
- Direct APK: `assembleDirectDebug` (full direct-distribution edition).
- Play App Bundle: `bundlePlayRelease` (analysis-only Play edition).
- The Play App Bundle is unsigned until the upload keystore is configured in GitHub Actions secrets.

## Required secure signing secrets
Create or obtain an Android upload keystore and configure these repository Actions secrets. Never commit the keystore or passwords to source control:
- `BERUR_UPLOAD_KEYSTORE_BASE64` — base64-encoded JKS/PKCS12 upload keystore.
- `BERUR_UPLOAD_STORE_PASSWORD`
- `BERUR_UPLOAD_KEY_ALIAS`
- `BERUR_UPLOAD_KEY_PASSWORD`

If these secrets are absent, the workflow intentionally creates an unsigned AAB preparation artifact, not an upload-ready bundle.

## Before submission
- Install and test the Play flavor on a physical Android device; verify no broker login, purchase, trading, Deriv Bot or binary-options execution route is available.
- Verify the privacy policy URL publicly loads and matches the final app behavior.
- Capture genuine phone screenshots of the Play flavor.
- Upload a 512 x 512 PNG app icon and 1024 x 500 feature graphic.
- Complete the Play Console Financial features declaration accurately. The app includes financial-market analysis; do not declare that it has no financial features.
- Review Google's financial-services and binary-options policies for the final feature set and target countries.
- Complete Data safety, Ads, Target audience, Content rating, App access and regional declarations accurately.
- Provide any required business/regulatory disclosures for each country targeted.
- Upload the signed AAB to an internal testing track first. Review all Play Console pre-launch and policy feedback before production release.

## Important
Google Play approval is not guaranteed. The Play edition is deliberately read-only with respect to broker accounts and trade execution. A policy review may still assess its market signals, binary-options-related analysis and financial claims.
