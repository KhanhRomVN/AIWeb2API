#!/bin/bash
# =============================================================================
# Test script: Gemini Web provider
# Usage: bash test-gemini.sh
#
# Credential: thienbaovn2468@gmail.com
# Lấy ACCOUNT_ID từ DB sau khi đăng nhập, hoặc query /v1/accounts
# =============================================================================

BASE_URL="http://localhost:8888"
PROVIDER_ID="gemini"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================="
echo "  Gemini Web Provider Test"
echo "  Account: thienbaovn2468@gmail.com"
echo "============================================="
echo ""

# -----------------------------------------------------------------------------
# 1. Health check
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1] Health check...${NC}"
HEALTH=$(curl -s "${BASE_URL}/v1/health")
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo ""

# -----------------------------------------------------------------------------
# 2. Kiểm tra gemini trong danh sách providers
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2] Kiểm tra gemini trong danh sách providers...${NC}"
PROVIDERS=$(curl -s "${BASE_URL}/v1/providers")
echo "$PROVIDERS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
providers = d.get('data', d) if isinstance(d.get('data'), list) else d.get('providers', [])
for p in providers:
    if 'gemini' == p.get('provider_id','').lower():
        print(json.dumps(p, indent=2))
" 2>/dev/null || echo "$PROVIDERS"
echo ""

# -----------------------------------------------------------------------------
# 3. Lấy danh sách accounts của gemini
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3] Lấy danh sách accounts của gemini...${NC}"
ACCOUNTS=$(curl -s "${BASE_URL}/v1/accounts?providerId=${PROVIDER_ID}")
echo "$ACCOUNTS" | python3 -m json.tool 2>/dev/null || echo "$ACCOUNTS"
echo ""

# Lấy accountId đầu tiên của gemini (thienbaovn2468@gmail.com)
ACCOUNT_ID=$(echo "$ACCOUNTS" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    accounts = d.get('data', d) if isinstance(d, dict) else d
    if isinstance(accounts, list):
        for a in accounts:
            if 'gemini' in a.get('provider_id','').lower() or 'thienbaovn' in a.get('email','').lower():
                print(a.get('id') or a.get('account_id') or a.get('accountId', ''))
                break
        if not accounts:
            pass
except Exception as e:
    pass
" 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
  echo -e "${RED}[!] Không tìm được accountId tự động. Nhập thủ công:${NC}"
  read -p "ACCOUNT_ID: " ACCOUNT_ID
fi

echo -e "${CYAN}    → Dùng ACCOUNT_ID: ${ACCOUNT_ID}${NC}"
echo ""

# -----------------------------------------------------------------------------
# 4. Lấy danh sách models của account
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4] Lấy danh sách models (accountId=${ACCOUNT_ID})...${NC}"
MODELS=$(curl -s "${BASE_URL}/v1/providers/${PROVIDER_ID}/models?accountId=${ACCOUNT_ID}")
echo "$MODELS" | python3 -m json.tool 2>/dev/null || echo "$MODELS"
echo ""

# -----------------------------------------------------------------------------
# 5. Test từng model
# -----------------------------------------------------------------------------
MODELS_LIST=("gemini-3.5-flash" "gemini-3.5-flash-thinking" "gemini-3.5-flash-thinking-lite" "gemini-3.1-pro" "gemini-auto" "gemini-flash-lite")

for MODEL in "${MODELS_LIST[@]}"; do
  echo -e "${YELLOW}[5.${MODEL}] Chat với model: ${MODEL}...${NC}"
  RESPONSE=$(curl -s -X POST "${BASE_URL}/v1/chat/accounts/${ACCOUNT_ID}/messages" \
    -H "Content-Type: application/json" \
    -d "{
      \"modelId\": \"${MODEL}\",
      \"messages\": [
        {\"role\": \"user\", \"content\": \"Xin chào! Bạn là model gì? Trả lời ngắn gọn 1 câu.\"}
      ]
    }")

  # Kiểm tra lỗi
  HAS_ERROR=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    err = d.get('error') or d.get('message') or ''
    if err or d.get('statusCode', 200) >= 400:
        print('ERROR: ' + str(err or d))
    else:
        content = d.get('content') or d.get('message') or d.get('data', {}).get('content', '')
        print('OK: ' + str(content)[:120])
except:
    raw = sys.stdin.read() if not sys.stdin.closed else ''
    print('RAW: ' + str(sys.stdin))
" 2>/dev/null || echo "$RESPONSE" | head -c 200)

  if echo "$HAS_ERROR" | grep -q "^ERROR"; then
    echo -e "  ${RED}✗ ${HAS_ERROR}${NC}"
  elif echo "$HAS_ERROR" | grep -q "^OK"; then
    echo -e "  ${GREEN}✓ ${HAS_ERROR}${NC}"
  else
    echo -e "  ${YELLOW}? ${HAS_ERROR}${NC}"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -30
  fi
  echo ""

  # Delay nhỏ giữa các request để tránh rate limit
  sleep 1
done

# -----------------------------------------------------------------------------
# 6. Test multi-turn conversation với gemini-3.5-flash
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[6] Test multi-turn conversation (gemini-3.5-flash)...${NC}"
CHAT1=$(curl -s -X POST "${BASE_URL}/v1/chat/accounts/${ACCOUNT_ID}/messages" \
  -H "Content-Type: application/json" \
  -d "{
    \"modelId\": \"gemini-3.5-flash\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Tên tôi là Bảo. Nhớ tên tôi nhé.\"}
    ]
  }")

CONV_ID=$(echo "$CHAT1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cid = d.get('conversationId') or d.get('conversation_id') or \
          d.get('data', {}).get('conversationId') or ''
    print(cid)
except:
    print('')
" 2>/dev/null)

echo -e "  Turn 1: $(echo "$CHAT1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    c = d.get('content') or d.get('message') or ''
    print(str(c)[:100])
except: print('parse error')
" 2>/dev/null)"
echo ""

if [ -n "$CONV_ID" ]; then
  CHAT2=$(curl -s -X POST "${BASE_URL}/v1/chat/accounts/${ACCOUNT_ID}/messages" \
    -H "Content-Type: application/json" \
    -d "{
      \"modelId\": \"gemini-3.5-flash\",
      \"conversationId\": \"${CONV_ID}\",
      \"messages\": [
        {\"role\": \"user\", \"content\": \"Tên tôi là Bảo. Nhớ tên tôi nhé.\"},
        {\"role\": \"assistant\", \"content\": \"Được rồi, tôi sẽ nhớ tên bạn là Bảo!\"},
        {\"role\": \"user\", \"content\": \"Tên tôi là gì vậy?\"}
      ]
    }")
  echo -e "  Turn 2: $(echo "$CHAT2" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    c = d.get('content') or d.get('message') or ''
    print(str(c)[:100])
except: print('parse error')
" 2>/dev/null)"
else
  echo -e "  ${YELLOW}Bỏ qua turn 2 (không có conversationId)${NC}"
fi
echo ""

echo "============================================="
echo "  Done"
echo "============================================="
