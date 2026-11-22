#!/usr/bin/env bash
# End-to-end smoke test against a running server.
# Usage: BASE=http://localhost:8787 TOKEN=pm_... bash scripts/smoke.sh
set -euo pipefail
BASE=${BASE:-http://localhost:8787}
: "${TOKEN:?set TOKEN to an API token}"
H=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')
fail() { echo "FAIL: $*"; exit 1; }
j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(eval('o'+process.argv[1]))})" "$1"; }

code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer pm_wrong' "$BASE/api/v1/projects")
[ "$code" = 401 ] || fail "bad token should be 401, got $code"

KEY="SMK$RANDOM"; KEY=${KEY:0:10}
curl -sf "${H[@]}" -X POST "$BASE/api/v1/projects" -d "{\"key\":\"$KEY\",\"name\":\"Smoke test\"}" >/dev/null || fail "create project"
id1=$(curl -sf "${H[@]}" -X POST "$BASE/api/v1/issues" -d "{\"project\":\"$KEY\",\"title\":\"First rss fix\",\"labels\":[\"bug\"],\"priority\":2}" | j .identifier)
[ "$id1" = "$KEY-1" ] || fail "first identifier $id1"
id2=$(curl -sf "${H[@]}" -X POST "$BASE/api/v1/issues" -d "{\"project\":\"$KEY\",\"title\":\"Second\",\"parent\":\"$id1\"}" | j .identifier)
[ "$id2" = "$KEY-2" ] || fail "second identifier $id2"
st=$(curl -sf "${H[@]}" -X PATCH "$BASE/api/v1/issues/$id1" -d '{"status":"done"}' | j .status)
[ "$st" = done ] || fail "status update"
curl -sf "${H[@]}" -X POST "$BASE/api/v1/issues/$id1/comments" -d '{"body":"hello"}' >/dev/null || fail comment
curl -sf "${H[@]}" -X POST "$BASE/api/v1/issues/$id1/github" -d '{"url":"https://github.com/timothyxlu/pm/pull/1"}' >/dev/null || fail link
detail=$(curl -sf "${H[@]}" "$BASE/api/v1/issues/$id1")
[ "$(echo "$detail" | j .github.length)" = 1 ] || fail "github link missing"
[ "$(echo "$detail" | j .children.length)" = 1 ] || fail "child missing"
[ "$(curl -sf "${H[@]}" "$BASE/api/v1/issues/$id2" | j .parent.identifier)" = "$id1" ] || fail "parent missing"
id3=$(curl -sf "${H[@]}" -X POST "$BASE/api/v1/issues" -d "{\"project\":\"$KEY\",\"title\":\"Grandchild\",\"parent\":\"$id2\"}" | j .identifier)
code=$(curl -s -o /dev/null -w '%{http_code}' "${H[@]}" -X PATCH "$BASE/api/v1/issues/$id1" -d "{\"parent\":\"$id3\"}")
[ "$code" = 400 ] || fail "parent cycle should be refused, got $code"
[ "$(curl -sf "${H[@]}" "$BASE/api/v1/issues?parent=$id1" | j .issues.length)" = 1 ] || fail "parent filter"
[ "$(curl -sf "${H[@]}" "$BASE/api/v1/issues?project=$KEY&status=done" | j .issues[0].sub_issues.total)" = 1 ] || fail "sub_issues count"
code=$(curl -s -o /dev/null -w '%{http_code}' "${H[@]}" -X PATCH "$BASE/api/v1/issues/$id3" -d '{"parent":null}')
[ "$code" = 200 ] || fail "clearing parent should work, got $code"
[ "$(echo "$detail" | j .activity[0].actor)" = claude ] || fail "actor should be claude"
found=$(curl -sf "${H[@]}" "$BASE/api/v1/issues?q=rss&project=$KEY" | j .issues.length)
[ "$found" = 1 ] || fail "search found $found"
prog=$(curl -sf "${H[@]}" "$BASE/api/v1/projects/$KEY" | j .progress)
[ "$prog" = 0.33 ] || fail "progress $prog"
code=$(curl -s -o /dev/null -w '%{http_code}' "${H[@]}" "$BASE/api/v1/tokens")
[ "$code" = 403 ] || fail "tokens must be refused for token auth, got $code"

# MCP over Streamable HTTP
M=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
init=$(curl -sf "${M[@]}" -X POST "$BASE/mcp" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}')
[ "$(echo "$init" | j .result.serverInfo.name)" = pm ] || fail "mcp initialize: $init"
tools=$(curl -sf "${M[@]}" -X POST "$BASE/mcp" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | j .result.tools.length)
[ "$tools" = 11 ] || fail "expected 11 tools, got $tools"
call=$(curl -sf "${M[@]}" -X POST "$BASE/mcp" -d "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"save_issue\",\"arguments\":{\"identifier\":\"$id2\",\"status\":\"in_progress\"}}}")
echo "$call" | j .result.content[0].text | grep -q '"in_progress"' || fail "mcp save_issue: $call"
imp=$(curl -sf "${M[@]}" -X POST "$BASE/mcp" -d "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"import_issues\",\"arguments\":{\"project\":\"$KEY\",\"issues\":[{\"identifier\":\"$KEY-91\",\"title\":\"Imported child\",\"status\":\"done\",\"parent\":\"$KEY-90\",\"created_at\":\"2026-01-01T00:00:00Z\",\"comments\":[{\"source_id\":\"smoke-1\",\"body\":\"old\",\"created_at\":\"2026-01-02T00:00:00Z\"}]},{\"identifier\":\"$KEY-90\",\"title\":\"Imported parent\",\"status\":\"todo\",\"created_at\":\"2026-01-01T00:00:00Z\"}]}}}")
echo "$imp" | j .result.content[0].text | grep -q '"created": 2' || fail "mcp import_issues: $imp"
[ "$(curl -sf "${H[@]}" "$BASE/api/v1/issues/$KEY-91" | j .parent.identifier)" = "$KEY-90" ] || fail "imported parent"
[ "$(curl -sf "${H[@]}" "$BASE/api/v1/issues/$KEY-91" | j .created_at)" = "2026-01-01T00:00:00Z" ] || fail "imported created_at"
nxt=$(curl -sf "${H[@]}" -X POST "$BASE/api/v1/issues" -d "{\"project\":\"$KEY\",\"title\":\"After import\"}" | j .identifier)
[ "$nxt" = "$KEY-92" ] || fail "next identifier after import: $nxt"
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/mcp" -H 'Authorization: Bearer pm_wrong' -d '{}')
[ "$code" = 401 ] || fail "mcp bad token should be 401"

echo "OK: all smoke checks passed ($KEY)"
