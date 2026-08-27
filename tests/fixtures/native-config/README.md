# AX86U native configuration fixture

This fixture is derived from the user-supplied `config _15_.json` on 2026-08-27. It is a complete structural fixture, not a snapshot assertion.

- 4 inbounds
- 32 outbounds
- 44 routing rules
- 3 balancers
- Includes native `settings.users`, flat VLESS outbound fields, outbound Reverse, XHTTP, FinalMask, Hysteria settings, DNS, API, metrics, and unknown/native fields.
- Secret-bearing values are replaced with stable placeholders; no UUID, password, private key, token, long public key, or subscription credential is stored here.
- Tests must assert preservation relationships and patch scope, not current catalog values.

Source file SHA256 (before redaction): `d1189dc8f630e855cd1eb429c27fc4b653eeea00189de07e822070fdbdacf8b7`
Redaction counts: `{"auth": 1, "encryption": 26, "id": 32, "mldsa65Verify": 22, "password": 1, "privateKey": 2, "publicKey": 22, "shortId": 22}`
