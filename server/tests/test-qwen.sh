#!/bin/bash
# =============================================================================
# Test script: Qwen — parent_id context test (NO history in turn 2)
#
# Strategy:
#   Turn 1: send single message, capture conversationId + parent_id from stream
#   Turn 2: send ONLY the new message (no history array), rely entirely on
#           server-side tree via conversationId + parent_message_id
#   If Qwen remembers context → parent_id mechanism works
#
# Usage: bash test-qwen.sh
# =============================================================================

BASE_URL="http://localhost:8888"
ACCOUNT_ID="009bcb3b-6e64-46d1-8506-179637254f79"
MODEL="qwen3.7-plus"
ENDPOINT="$BASE_URL/v1/chat/accounts/messages"

RAND_NUM=$(( RANDOM % 9000 + 1000 ))

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TMPSSE=$(mktemp /tmp/qwen-sse-XXXXXX)
TMPTOK=$(mktemp /tmp/qwen-tok-XXXXXX)
PYPARSER=$(mktemp /tmp/qwen-py-XXXXXX.py)

trap 'rm -f "$TMPSSE" "$TMPTOK" "$PYPARSER"' EXIT

# Write the Python SSE parser to a real file (avoids heredoc-in-subshell issues)
cat > "$PYPARSER" << 'PYEOF'
import sys, json, re

path = sys.argv[1]
with open(path, 'rb') as f:
    raw = f.read().decode('utf-8', errors='replace')

# SSE: blank line = event boundary; multiple consecutive data: lines = join
events = []
parts = []
for line in raw.splitlines():
    if line.startswith('data: '):
        parts.append(line[6:])
    elif line in ('', '\r'):
        if parts:
            events.append('\n'.join(parts))
            parts = []
if parts:
    events.append('\n'.join(parts))

for payload in events:
    payload = payload.strip()
    if not payload or payload == '[DONE]':
        continue
    # bare UUID line (raw conversation id)
    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', payload):
        print('CONV:' + payload)
        continue
    try:
        d = json.loads(payload)
        if 'error' in d:
            print('ERROR:' + str(d['error']))
        if 'content' in d:
            print('CONTENT:' + d['content'])
        meta = d.get('meta') or d.get('metadata') or {}
        if meta.get('conversation_id'):
            print('CONV:' + meta['conversation_id'])
        if meta.get('parent_id'):
            print('PARENT:' + meta['parent_id'])
    except Exception:
        pass
PYEOF

echo "============================================="
echo "  Qwen parent_id Context Test"
echo "  account : $ACCOUNT_ID"
echo "  model   : $MODEL"
echo "  secret  : $RAND_NUM  (random each run)"
echo "============================================="
echo ""

# =============================================================================
# Helper: parse SSE file → token file, then read tokens into caller vars
# Usage: do_turn <sse_file> <tok_file> <request_body>
# =============================================================================
do_turn() {
  local sse="$1" tok="$2" body="$3"
  curl -s --no-buffer -N -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$body" > "$sse" 2>&1
  python3 "$PYPARSER" "$sse" > "$tok" 2>&1
}

# =============================================================================
# Turn 1 — new conversation
# =============================================================================
echo -e "${YELLOW}[Turn 1] Planting secret number: $RAND_NUM${NC}"
echo ""

T1_BODY="{\"modelId\":\"$MODEL\",\"accountId\":\"$ACCOUNT_ID\",\"stream\":true,\"messages\":[{\"role\":\"user\",\"content\":\"Secret number: $RAND_NUM. Remember it. Reply: Got it $RAND_NUM\"}]}"

do_turn "$TMPSSE" "$TMPTOK" "$T1_BODY"

CONV_ID="" PARENT_ID="" RESPONSE1="" ERROR1=""

while IFS= read -r token; do
  case "$token" in
    ERROR:*)  ERROR1="${token#ERROR:}" ;;
    CONV:*)   CONV_ID="${token#CONV:}" ;;
    PARENT:*) PARENT_ID="${token#PARENT:}" ;;
    CONTENT:*) t="${token#CONTENT:}"; RESPONSE1+="$t"; echo -n "$t" ;;
  esac
done < "$TMPTOK"

echo ""
echo ""

if [[ -n "$ERROR1" ]]; then
  echo -e "${RED}[FAIL] Turn 1 error: $ERROR1${NC}"
  cat "$TMPSSE"; exit 1
elif [[ -z "$RESPONSE1" ]]; then
  echo -e "${RED}[FAIL] Turn 1 — no content received${NC}"
  echo "--- tokens ---"; cat "$TMPTOK"
  echo "--- raw SSE ---"; cat "$TMPSSE"
  exit 1
else
  echo -e "${GREEN}[PASS] Turn 1 — ${#RESPONSE1} chars${NC}"
fi

echo -e "${CYAN}  conversationId : ${CONV_ID:-<not received>}${NC}"
echo -e "${CYAN}  parent_id      : ${PARENT_ID:-<not received>}${NC}"
echo ""

if [[ -z "$CONV_ID" ]]; then
  echo -e "${RED}[ABORT] No conversationId — cannot test parent_id context${NC}"
  exit 1
fi

[[ -z "$PARENT_ID" ]] && echo -e "${YELLOW}[WARN] No parent_id in stream — server fallback will be used${NC}"

# =============================================================================
# Turn 2 — NO history array, context via conversationId + parent_message_id only
# =============================================================================
echo -e "${YELLOW}[Turn 2] Asking for secret — NO history sent${NC}"
echo ""

if [[ -n "$PARENT_ID" ]]; then
  T2_BODY="{\"modelId\":\"$MODEL\",\"accountId\":\"$ACCOUNT_ID\",\"stream\":true,\"conversationId\":\"$CONV_ID\",\"parent_message_id\":\"$PARENT_ID\",\"messages\":[{\"role\":\"user\",\"content\":\"What was the secret number? Reply with the number only.\"}]}"
else
  T2_BODY="{\"modelId\":\"$MODEL\",\"accountId\":\"$ACCOUNT_ID\",\"stream\":true,\"conversationId\":\"$CONV_ID\",\"messages\":[{\"role\":\"user\",\"content\":\"What was the secret number? Reply with the number only.\"}]}"
fi

do_turn "$TMPSSE" "$TMPTOK" "$T2_BODY"

RESPONSE2="" ERROR2=""

while IFS= read -r token; do
  case "$token" in
    ERROR:*)   ERROR2="${token#ERROR:}" ;;
    CONTENT:*) t="${token#CONTENT:}"; RESPONSE2+="$t"; echo -n "$t" ;;
  esac
done < "$TMPTOK"

echo ""
echo ""

if [[ -n "$ERROR2" ]]; then
  echo -e "${RED}[FAIL] Turn 2 error: $ERROR2${NC}"
  cat "$TMPSSE"; exit 1
elif [[ -z "$RESPONSE2" ]]; then
  echo -e "${RED}[FAIL] Turn 2 — no content received${NC}"
  echo "--- tokens ---"; cat "$TMPTOK"
  echo "--- raw SSE ---"; cat "$TMPSSE"
  exit 1
fi

echo -e "${GREEN}[PASS] Turn 2 — ${#RESPONSE2} chars${NC}"
echo ""

# =============================================================================
# Verdict
# =============================================================================
echo "============================================="
echo "  Secret planted : $RAND_NUM"
echo "  Qwen recalled  : $RESPONSE2"
echo "============================================="

if echo "$RESPONSE2" | grep -q "$RAND_NUM"; then
  echo -e "${GREEN}  [PASS] Context preserved — parent_id works correctly${NC}"
  exit 0
else
  echo -e "${RED}  [FAIL] Context lost — Qwen did not recall $RAND_NUM${NC}"
  if [[ -z "$PARENT_ID" ]]; then
    echo -e "${RED}         parent_id not received in stream${NC}"
  else
    echo -e "${RED}         parent_id '$PARENT_ID' sent but context still lost${NC}"
  fi
  exit 1
fi
