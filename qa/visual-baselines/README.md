# Staging visual baselines

Visual certification captures only public, non-sensitive screens. CI never updates this directory automatically.

The first real staging run intentionally returns `VISUAL REVIEW REQUIRED` because `manifest.json` starts without approved hashes. A human reviewer must inspect the captured screenshots, approve the exact release/run evidence, and then update the manifest through a normal reviewed pull request with the approved SHA-256 values.

Subsequent staging runs compare the captured PNG hashes with the approved manifest. A missing or changed hash is not a functional PASS: it requires explicit visual review. Authenticated, customer-data, token, cookie and payment-sensitive screenshots are not accepted as source-controlled visual baselines.
