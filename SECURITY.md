# Security Policy

## Reporting Security Vulnerabilities

We take the security of `service-keepalive` seriously. If you believe you have discovered a vulnerability or security risk, please report it responsibly rather than opening a public issue.

### How to Report

- **Email**: Send vulnerability details to `devanshuparmar00@gmail.com` (or create a private GitHub Security Advisory).
- **Details to Include**:
  - A description of the vulnerability.
  - Steps to reproduce or a proof of concept.
  - Affected versions.
  - Potential impact and mitigations.

You will receive an acknowledgment within 48 hours, followed by updates on the fix and coordinated disclosure.

## Security Design & Best Practices

### 1. Secret & Header Redaction

When logging request metadata in `--verbose` mode or terminal output, `service-keepalive` automatically masks sensitive headers such as:

- `Authorization` (Bearer tokens, Basic Auth)
- `Cookie` and `Set-Cookie`
- `X-Api-Key`, `Api-Key`, `ApiKey`
- `X-Auth-Token`, `Token`, `Secret`, `Password`

Sensitive query string parameters (such as `?token=...`, `?key=...`, `?secret=...`) are also automatically redacted in console outputs.

### 2. External Execution Model & SSRF Considerations

- `service-keepalive` is designed to be executed on **your own client infrastructure** (e.g. personal computer, VPS, private Docker container, CI/CD runner).
- It is **not** intended to be deployed as an unauthenticated multi-tenant public web proxy or pinging SaaS where untrusted users can submit arbitrary target URLs.
- When running in an environment where configuration files or environment variables are sourced from third-party automation, ensure only authorized operators can define the target `url` to prevent unintended internal network requests (SSRF).
