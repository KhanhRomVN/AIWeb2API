#!/bin/bash
# =============================================================================
# Test script: Qwen — chat 2 messages in 1 conversation
# Usage: bash test-qwen.sh
# =============================================================================

BASE_URL="http://localhost:9999"
ACCOUNT_ID="009bcb3b-6e64-46d1-8506-179637254f79"
MODEL="qwen3.7-plus"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================="
echo "  Qwen Chat Test"
echo "  account : $ACCOUNT_ID"
echo "  model   : $MODEL"
echo "============================================="
echo ""

# =============================================================================
# Turn 1 — new conversation
# =============================================================================
echo -e "${YELLOW}[Turn 1] New conversation — 'Xin chao! Ban la AI gi?'${NC}"
echo ""

CONV_ID=""
RESPONSE1=""
ERROR1=""

while IFS= read -r line; do
  [[ "$line" != data:* ]] && continue
  json="${line#data: }"
  [[ "$json" == "[DONE]" ]] && break

  result=$(echo "$json" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'content' in d: print('CONTENT:'+d['content'],end='')
    elif 'error' in d: print('ERROR:'+str(d['error']),end='')
    elif 'meta' in d:
        cid=d['meta'].get('conversation_id','')
        if cid: print('CONV:'+cid,end='')
except: pass
" 2>/dev/null)

  if [[ "$result" == ERROR:* ]]; then
    ERROR1="${result#ERROR:}"
    echo -e "\n${RED}  Stream error: $ERROR1${NC}"
  elif [[ "$result" == CONV:* ]]; then
    CONV_ID="${result#CONV:}"
  elif [[ -n "$result" ]]; then
    RESPONSE1+="${result#CONTENT:}"
    echo -n "${result#CONTENT:}"
  fi
done < <(curl -s -N -X POST "$BASE_URL/v1/chat/accounts/$ACCOUNT_ID/messages" \
  -H "Content-Type: application/json" \
  -d "{\"modelId\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Xin chao! Ban la AI gi? Tra loi ngan gon 1 cau.\"}]}")

echo ""
echo ""

if [[ -n "$ERROR1" ]]; then
  echo -e "${RED}[FAIL] Turn 1 error: $ERROR1${NC}"
  exit 1
elif [[ -z "$RESPONSE1" ]]; then
  echo -e "${RED}[FAIL] Turn 1 — no content received${NC}"
  exit 1
else
  echo -e "${GREEN}[PASS] Turn 1 — ${#RESPONSE1} chars received${NC}"
fi

if [[ -n "$CONV_ID" ]]; then
  echo -e "${CYAN}conversationId: $CONV_ID${NC}"
else
  echo -e "${YELLOW}[WARN] No conversationId in metadata${NC}"
fi
echo ""

# =============================================================================
# Turn 2 — continue same conversation
# =============================================================================
echo -e "${YELLOW}[Turn 2] Continue — 'Ten toi la Khanh, ban co nho khong?'${NC}"
echo ""

RESPONSE1_JSON=$(echo "$RESPONSE1" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '"..."')

CONV_PARAM=""
[[ -n "$CONV_ID" ]] && CONV_PARAM=",\"conversationId\":\"$CONV_ID\""

RESPONSE2=""
ERROR2=""

while IFS= read -r line; do
  [[ "$line" != data:* ]] && continue
  json="${line#data: }"
  [[ "$json" == "[DONE]" ]] && break

  result=$(echo "$json" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'content' in d: print('CONTENT:'+d['content'],end='')
    elif 'error' in d: print('ERROR:'+str(d['error']),end='')
except: pass
" 2>/dev/null)

  if [[ "$result" == ERROR:* ]]; then
    ERROR2="${result#ERROR:}"
  elif [[ -n "$result" ]]; then
    RESPONSE2+="${result#CONTENT:}"
    echo -n "${result#CONTENT:}"
  fi
done < <(curl -s -N -X POST "$BASE_URL/v1/chat/accounts/$ACCOUNT_ID/messages" \
  -H "Content-Type: application/json" \
  -d "{\"modelId\":\"$MODEL\"$CONV_PARAM,\"messages\":[
    {\"role\":\"user\",\"content\":\"Xin chao! Ban la AI gi? Tra loi ngan gon 1 cau.\"},
    {\"role\":\"assistant\",\"content\":$RESPONSE1_JSON},
    {\"role\":\"user\",\"content\":\"Ten toi la Khanh, ban co nho khong?\"}
  ]}")

echo ""
echo ""

if [[ -n "$ERROR2" ]]; then
  echo -e "${RED}[FAIL] Turn 2 error: $ERROR2${NC}"
  exit 1
elif [[ -z "$RESPONSE2" ]]; then
  echo -e "${RED}[FAIL] Turn 2 — no content received${NC}"
  exit 1
else
  echo -e "${GREEN}[PASS] Turn 2 — ${#RESPONSE2} chars received${NC}"
fi

echo ""
echo "============================================="
echo -e "  Turn 1: ${GREEN}PASS${NC}"
echo -e "  Turn 2: ${GREEN}PASS${NC}"
echo "============================================="
