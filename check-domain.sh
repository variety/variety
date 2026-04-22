#!/usr/bin/env bash
# Verifies DNS, DNSSEC, and redirect health for varietyjs.org.
set -euo pipefail

DOMAIN="varietyjs.org"
WWW="www.varietyjs.org"
CANONICAL="https://github.com/variety/variety"
NS="dns1.registrar-servers.com"

PASS=0
FAIL=0

ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
fail() { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1" >&2; exit 1; }
}

require_cmd dig
require_cmd curl

# ---------------------------------------------------------------------------
# DNS — A records (apex)
# ---------------------------------------------------------------------------
echo
echo "=== Apex A records ==="
EXPECTED_A="185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153"
ACTUAL_A=$(dig +short @"$NS" A "$DOMAIN" | sort | tr '\n' ' ' | sed 's/ $//')
EXPECTED_A_SORTED=$(echo "$EXPECTED_A" | tr ' ' '\n' | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$ACTUAL_A" = "$EXPECTED_A_SORTED" ]; then
  ok "All 4 A records present: $ACTUAL_A"
else
  MISSING=$(comm -23 <(echo "$EXPECTED_A_SORTED" | tr ' ' '\n') <(echo "$ACTUAL_A" | tr ' ' '\n'))
  EXTRA=$(comm -13 <(echo "$EXPECTED_A_SORTED" | tr ' ' '\n') <(echo "$ACTUAL_A" | tr ' ' '\n'))
  [ -n "$MISSING" ] && fail "Missing A records: $MISSING"
  [ -n "$EXTRA"   ] && fail "Unexpected A records: $EXTRA"
fi

# ---------------------------------------------------------------------------
# DNS — AAAA records (apex)
# ---------------------------------------------------------------------------
echo
echo "=== Apex AAAA records ==="
EXPECTED_AAAA="2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153"
ACTUAL_AAAA=$(dig +short @"$NS" AAAA "$DOMAIN" | sort | tr '\n' ' ' | sed 's/ $//')
EXPECTED_AAAA_SORTED=$(echo "$EXPECTED_AAAA" | tr ' ' '\n' | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$ACTUAL_AAAA" = "$EXPECTED_AAAA_SORTED" ]; then
  ok "All 4 AAAA records present: $ACTUAL_AAAA"
else
  MISSING=$(comm -23 <(echo "$EXPECTED_AAAA_SORTED" | tr ' ' '\n') <(echo "$ACTUAL_AAAA" | tr ' ' '\n'))
  EXTRA=$(comm -13 <(echo "$EXPECTED_AAAA_SORTED" | tr ' ' '\n') <(echo "$ACTUAL_AAAA" | tr ' ' '\n'))
  [ -n "$MISSING" ] && fail "Missing AAAA records: $MISSING"
  [ -n "$EXTRA"   ] && fail "Unexpected AAAA records: $EXTRA"
fi

# ---------------------------------------------------------------------------
# DNS — www CNAME
# ---------------------------------------------------------------------------
echo
echo "=== www CNAME ==="
ACTUAL_CNAME=$(dig +short @"$NS" CNAME "$WWW")
if [ "$ACTUAL_CNAME" = "variety.github.io." ]; then
  ok "www CNAME → variety.github.io."
else
  fail "www CNAME expected 'variety.github.io.' got '${ACTUAL_CNAME:-<empty>}'"
fi

# ---------------------------------------------------------------------------
# DNSSEC
# ---------------------------------------------------------------------------
echo
echo "=== DNSSEC ==="
# DS record lives in the parent (.org) zone — query recursively, not @domain-NS
DS=$(dig +short DS "$DOMAIN")
if [ -n "$DS" ]; then
  ok "DS record present in parent zone: $DS"
else
  fail "No DS record found — DNSSEC may not be active"
fi

DNSKEY=$(dig +short @"$NS" DNSKEY "$DOMAIN")
KSK_COUNT=$(echo "$DNSKEY" | grep -c '^257 ' || true)
ZSK_COUNT=$(echo "$DNSKEY" | grep -c '^256 ' || true)
if [ "$KSK_COUNT" -ge 1 ] && [ "$ZSK_COUNT" -ge 1 ]; then
  ok "DNSKEY records present (KSK: $KSK_COUNT, ZSK: $ZSK_COUNT)"
else
  fail "DNSKEY incomplete (KSK: $KSK_COUNT, ZSK: $ZSK_COUNT)"
fi

# Validate the chain using Cloudflare's DNSSEC-validating resolver (1.1.1.1)
AD=$(dig +dnssec @1.1.1.1 A "$DOMAIN" | grep -c 'flags:.*ad' || true)
if [ "$AD" -ge 1 ]; then
  ok "DNSSEC validation successful (AD flag set by 1.1.1.1)"
else
  fail "AD flag not set by 1.1.1.1 — DNSSEC chain may be broken"
fi

# ---------------------------------------------------------------------------
# GitHub org domain verification TXT record
# ---------------------------------------------------------------------------
echo
echo "=== GitHub org domain verification ==="
CHALLENGE_HOST="_github-pages-challenge-variety.$DOMAIN"
EXPECTED_TXT="d1846b7643914fe51e8c1199a563d6"
ACTUAL_TXT=$(dig +short TXT "$CHALLENGE_HOST" | tr -d '"')
if [ "$ACTUAL_TXT" = "$EXPECTED_TXT" ]; then
  ok "GitHub Pages challenge TXT record present: $CHALLENGE_HOST"
else
  fail "GitHub Pages challenge TXT missing or wrong (expected '$EXPECTED_TXT', got '${ACTUAL_TXT:-<empty>}')"
fi

# ---------------------------------------------------------------------------
# TLS
# ---------------------------------------------------------------------------
echo
echo "=== TLS ==="
TLS_INFO=$(curl -sI --max-time 10 "https://$WWW" -o /dev/null -w "%{http_code} %{ssl_verify_result}" 2>/dev/null || echo "error")
HTTP_CODE=$(echo "$TLS_INFO" | awk '{print $1}')
SSL_RESULT=$(echo "$TLS_INFO" | awk '{print $2}')
if [ "$SSL_RESULT" = "0" ] && [ "$HTTP_CODE" != "error" ]; then
  ok "TLS certificate valid for $WWW (HTTP $HTTP_CODE)"
else
  fail "TLS issue for $WWW (curl ssl_verify_result=$SSL_RESULT, http=$HTTP_CODE)"
fi

# ---------------------------------------------------------------------------
# Redirects
# ---------------------------------------------------------------------------
# HTTP redirects (curl -L) land on https://www.varietyjs.org/ (200) because
# the final hop to github.com is a meta-refresh, not an HTTP 3xx.  We verify:
#   1. http:// upgrades to https:// (Enforce HTTPS)
#   2. apex redirects to www
#   3. The served page contains the canonical destination URL
# ---------------------------------------------------------------------------
echo
echo "=== Redirects ==="

# $1=url  $2=expected final URL after HTTP redirects
check_http_redirect() {
  local url="$1" expected="$2"
  local actual
  actual=$(curl -sI --max-time 10 -L "$url" -o /dev/null -w "%{url_effective}" 2>/dev/null || echo "error")
  if [ "$actual" = "$expected" ]; then
    ok "$url →(HTTP) $expected"
  else
    fail "$url expected HTTP redirect to '$expected', got '${actual}'"
  fi
}

# GitHub Pages routes the HTTP apex to a 404 when www is the canonical custom
# domain — it only handles the apex→www redirect for HTTPS traffic.  Check that
# it at least responds (not a timeout), and accept any HTTP status code.
APEX_HTTP_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "http://$DOMAIN/" 2>/dev/null || echo "000")
if [ "$APEX_HTTP_CODE" != "000" ]; then
  ok "http://$DOMAIN/ responds (HTTP $APEX_HTTP_CODE — GitHub Pages limitation: apex HTTP not redirected when www is canonical)"
else
  fail "http://$DOMAIN/ timed out or unreachable"
fi

check_http_redirect "http://$WWW/"     "https://$WWW/"
check_http_redirect "https://$DOMAIN/" "https://$WWW/"
check_http_redirect "https://$WWW/"    "https://$WWW/"

# The served page must contain the meta-refresh target
echo
echo "=== Page content ==="
PAGE=$(curl -s --max-time 10 "https://$WWW/" 2>/dev/null || echo "")
if echo "$PAGE" | grep -qF "$CANONICAL"; then
  ok "Page contains meta-refresh target: $CANONICAL"
else
  fail "Page does not contain '$CANONICAL'"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo
[ "$FAIL" -eq 0 ] && echo "All checks passed." && exit 0
echo "Some checks failed." && exit 1
