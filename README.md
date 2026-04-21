# varietyjs.org — GitHub Pages redirect

This orphan branch (`gh-pages`) is the sole content served at
[www.varietyjs.org](https://www.varietyjs.org).

`index.html` performs an immediate redirect to the canonical project URL:
**<https://github.com/variety/variety>**

`CNAME` tells GitHub Pages to serve this branch under `www.varietyjs.org`
with a free Let's Encrypt TLS certificate.

## check-domain.sh

A diagnostic script that verifies the full domain stack:

- **DNS** — all four GitHub Pages A records and AAAA records are present on the apex domain; the `www` CNAME points to `variety.github.io`
- **DNSSEC** — DS record is published in the `.org` parent zone; KSK and ZSK DNSKEY records are present; the AD flag is set by a validating resolver
- **TLS** — curl confirms a valid certificate for `www.varietyjs.org`
- **Redirects** — all four entry points (`http://varietyjs.org`, `http://www.varietyjs.org`, `https://varietyjs.org`, `https://www.varietyjs.org`) resolve to `https://github.com/variety/variety`

### Usage

```sh
bash check-domain.sh
```

Requires `dig` and `curl`. Exits 0 if all checks pass, 1 otherwise.
