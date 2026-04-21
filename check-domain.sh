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
DS=$(dig +short @"$NS" DS "$DOMAIN")
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

# Validate the chain with AD flag
AD=$(dig +dnssec A "$DOMAIN" | grep -c 'flags:.*ad' || true)
if [ "$AD" -ge 1 ]; then
  ok "DNSSEC validation successful (AD flag set)"
else
  fail "AD flag not set — DNSSEC chain may be broken or resolver does not validate"
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
echo
echo "=== Redirects ==="

check_redirect() {
  local url="$1"
  local expected_dest="$2"
  local actual
  actual=$(curl -sI --max-time 10 -L "$url" -o /dev/null -w "%{url_effective}" 2>/dev/null || echo "error")
  if [ "$actual" = "$expected_dest" ]; then
    ok "$url → $expected_dest"
  else
    fail "$url expected '$expected_dest' got '${actual}'"
  fi
}

check_redirect "http://$DOMAIN/"  "$CANONICAL"
check_redirect "http://$WWW/"     "$CANONICAL"
check_redirect "https://$DOMAIN/" "$CANONICAL"
check_redirect "https://$WWW/"    "$CANONICAL"

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
