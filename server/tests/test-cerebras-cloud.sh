#!/bin/bash
# =============================================================================
# Test script: Cerebras Cloud provider
# Usage: bash test-cerebras-cloud.sh
# =============================================================================

BASE_URL="http://localhost:8888"
PROVIDER_ID="cerebras-cloud"
ACCOUNT_ID="d102b280-d946-468f-b756-66147cb6e655"
MODEL="zai-glm-4.7"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================="
echo "  Cerebras Cloud Provider Test"
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
# 2. Lấy danh sách providers — kiểm tra cerebras-cloud có trong list
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2] Kiểm tra cerebras-cloud trong danh sách providers...${NC}"
PROVIDERS=$(curl -s "${BASE_URL}/v1/providers")
echo "$PROVIDERS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
providers = d.get('data', d) if isinstance(d.get('data'), list) else d.get('providers', [])
for p in providers:
    if 'cerebras' in p.get('provider_id','').lower():
        print(json.dumps(p, indent=2))
" 2>/dev/null || echo "$PROVIDERS" | python3 -m json.tool 2>/dev/null | grep -A10 '"cerebras'
echo ""

# -----------------------------------------------------------------------------
# 3. Lấy danh sách models của cerebras-cloud
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3] Lấy danh sách models (accountId=${ACCOUNT_ID})...${NC}"
MODELS=$(curl -s "${BASE_URL}/v1/providers/${PROVIDER_ID}/models?accountId=${ACCOUNT_ID}")
echo "$MODELS" | python3 -m json.tool 2>/dev/null || echo "$MODELS"
echo ""

# -----------------------------------------------------------------------------
# 4. Chat — tin nhắn đầu tiên (new conversation)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4] Chat tin nhắn đầu tiên với model ${MODEL}...${NC}"
CHAT1=$(curl -s -X POST "${BASE_URL}/v1/chat/accounts/${ACCOUNT_ID}/messages" \
  -H "Content-Type: application/json" \
  -d "{
    \"modelId\": \"${MODEL}\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"xin chào, bạn là model gì?\"}
    ]
  }")
echo "$CHAT1" | python3 -m json.tool 2>/dev/null || echo "$CHAT1"
echo ""

# Lấy conversationId từ response để dùng cho tin nhắn tiếp theo
CONV_ID=$(echo "$CHAT1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cid = d.get('conversationId') or d.get('conversation_id') or \
          d.get('data', {}).get('conversationId') or \
          d.get('data', {}).get('conversation_id') or ''
    print(cid)
except:
    print('')
" 2>/dev/null)

# -----------------------------------------------------------------------------
# 5. Chat — tin nhắn tiếp theo (continue conversation)
# -----------------------------------------------------------------------------
if [ -n "$CONV_ID" ]; then
  echo -e "${YELLOW}[5] Chat tin nhắn tiếp theo (conversationId=${CONV_ID})...${NC}"
  CHAT2=$(curl -s -X POST "${BASE_URL}/v1/chat/accounts/${ACCOUNT_ID}/messages" \
    -H "Content-Type: application/json" \
    -d "{
      \"modelId\": \"${MODEL}\",
      \"conversationId\": \"${CONV_ID}\",
      \"messages\": [
        {\"role\": \"user\", \"content\": \"xin chào, bạn là model gì?\"},
        {\"role\": \"assistant\", \"content\": \"Xin chào! Tôi là mô hình ngôn ngữ lớn.\"},
        {\"role\": \"user\", \"content\": \"bạn có thể viết code Python không?\"}
      ]
    }")
  echo "$CHAT2" | python3 -m json.tool 2>/dev/null || echo "$CHAT2"
else
  echo -e "${YELLOW}[5] Bỏ qua test tiếp theo (không lấy được conversationId từ bước 4)${NC}"
  echo -e "    Thử chat tiếp theo với conversationId giả để kiểm tra flow..."
  CHAT2=$(curl -s -X POST "${BASE_URL}/v1/chat/accounts/${ACCOUNT_ID}/messages" \
    -H "Content-Type: application/json" \
    -d "{
      \"modelId\": \"${MODEL}\",
      \"messages\": [
        {\"role\": \"user\", \"content\": \"xin chào, bạn là model gì?\"},
        {\"role\": \"assistant\", \"content\": \"Xin chào! Tôi là mô hình ngôn ngữ lớn.\"},
        {\"role\": \"user\", \"content\": \"bạn có thể viết code Python không?\"}
      ]
    }")
  echo "$CHAT2" | python3 -m json.tool 2>/dev/null || echo "$CHAT2"
fi
echo ""

echo "============================================="
echo "  Done"
echo "============================================="
