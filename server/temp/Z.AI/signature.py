import hmac
import hashlib
import base64
import time
import uuid
import json
import os
import urllib.parse

SALT = "key-@@@@)))()((9))-xxxx&&&%%%%%"

def get_auth_data(auth_path="z_ai_auth.json"):
    if not os.path.exists(auth_path):
        return None, None
    
    try:
        with open(auth_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        token = None
        for origin in data.get("origins", []):
            if "chat.z.ai" in origin.get("origin", ""):
                for item in origin.get("localStorage", []):
                    if item.get("name") == "token":
                        token = item.get("value")
                        break
        
        if not token:
            return None, None
            
        parts = token.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1]
            padding = "=" * (4 - len(payload_b64) % 4)
            payload_json = base64.b64decode(payload_b64 + padding).decode("utf-8")
            payload = json.loads(payload_json)
            user_id = payload.get("id")
            return token, user_id
            
        return token, None
    except Exception as e:
        return None, None

def generate_signature_and_params(prompt, token, user_id, timestamp=None):
    if timestamp is None:
        timestamp = str(int(time.time() * 1000))
    
    request_id = str(uuid.uuid4())
    
    # 1. Metadata for URL Query Params (from Zs function analysis)
    metadata = {
        "timestamp": timestamp,
        "requestId": request_id,
        "user_id": user_id,
        "version": "0.0.1",
        "platform": "web",
        "token": token,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "language": "vi",
        "languages": "vi,en-US,en",
        "timezone": "Asia/Saigon",
        "cookie_enabled": "true",
        "screen_width": "1920",
        "screen_height": "1080",
        "screen_resolution": "1920x1080",
        "viewport_height": "1080",
        "viewport_width": "1920",
        "viewport_size": "1920x1080",
        "color_depth": "24",
        "pixel_ratio": "1",
        "current_url": "https://chat.z.ai/",
        "pathname": "/",
        "search": "",
        "hash": "",
        "host": "chat.z.ai",
        "hostname": "chat.z.ai",
        "protocol": "https:",
        "referrer": "",
        "title": "Z.ai - Free AI Chatbot",
        "timezone_offset": "-420",
        "local_time": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "utc_time": time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime()),
        "is_mobile": "false",
        "is_touch": "false",
        "max_touch_points": "0",
        "browser_name": "Chrome",
        "os_name": "Windows",
        "signature_timestamp": timestamp
    }
    
    # 2. Sorted Payload for Signature (requestId, timestamp, user_id)
    sig_payload = {
        "requestId": request_id,
        "timestamp": timestamp,
        "user_id": user_id
    }
    sorted_keys = sorted(sig_payload.keys())
    sorted_items = []
    for k in sorted_keys:
        sorted_items.append(k)
        sorted_items.append(str(sig_payload[k]))
    sorted_payload = ",".join(sorted_items)
    
    # 3. Base64 encode prompt
    b64_prompt = base64.b64encode(prompt.encode('utf-8')).decode('utf-8')
    
    # 4. Construct data string
    data_string = f"{sorted_payload}|{b64_prompt}|{timestamp}"
    
    # 5. Calculate HMAC
    time_chunk = str(int(timestamp) // 300000)
    k1 = hmac.new(SALT.encode('utf-8'), time_chunk.encode('utf-8'), hashlib.sha256).hexdigest()
    signature = hmac.new(k1.encode('utf-8'), data_string.encode('utf-8'), hashlib.sha256).hexdigest()
    
    # 6. Construct Query Params
    query_params = urllib.parse.urlencode(metadata)
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "requestId": request_id,
        "queryParams": query_params
    }

def get_headers(token, signature):
    return {
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Fe-Version": "prod-fe-1.1.14",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Origin": "https://chat.z.ai",
        "Referer": "https://chat.z.ai/"
    }
