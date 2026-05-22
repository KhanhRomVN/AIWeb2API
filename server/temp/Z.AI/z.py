import json
import sys
import time
import requests
import uuid
from signature import get_auth_data, generate_signature_and_params, get_headers

def chat_stream(prompt):
    token, user_id = get_auth_data("z_ai_auth.json")
    if not token or not user_id:
        print("[!] Auth error")
        return

    sig_res = generate_signature_and_params(prompt, token, user_id)
    url = f"https://chat.z.ai/api/v2/chat/completions?{sig_res['queryParams']}"
    headers = get_headers(token, sig_res['signature'])
    
    # Cấu trúc body đầy đủ giống browser
    payload = {
        "stream": True,
        "model": "GLM-5-Turbo",
        "messages": [{"role": "user", "content": prompt}],
        "signature_prompt": prompt,
        "params": {},
        "extra": {},
        "features": {
            "image_generation": False,
            "web_search": False,
            "auto_web_search": False,
            "preview_mode": True,
            "flags": [],
            "vlm_tools_enable": False,
            "vlm_web_search_enable": False,
            "vlm_website_mode": False,
            "enable_thinking": True
        },
        "variables": {
            "{{USER_NAME}}": "User",
            "{{CURRENT_DATETIME}}": time.strftime("%Y-%m-%d %H:%M:%S"),
            "{{CURRENT_TIMEZONE}}": "Asia/Saigon"
        },
        "requestId": sig_res["requestId"],
        "timestamp": int(sig_res["timestamp"]),
        "id": str(uuid.uuid4()),
        "current_user_message_id": str(uuid.uuid4())
    }

    try:
        response = requests.post(url, headers=headers, json=payload, stream=True, timeout=120)
        if response.status_code != 200:
            print(f"[!] API Error: {response.status_code} - {response.text[:200]}")
            return

        is_thinking = False
        for line in response.iter_lines():
            if not line: continue
            decoded = line.decode("utf-8")
            if not decoded.startswith("data: "): continue
            data_str = decoded[6:].strip()
            if data_str == "[DONE]": break

            try:
                data_json = json.loads(data_str)
                inner = data_json.get("data", {})
                if isinstance(inner, dict):
                    phase = inner.get("phase", "")
                    content = inner.get("delta_content", "")
                    if phase == "thinking":
                        if not is_thinking:
                            print("\n[Thinking] ", end="", flush=True)
                            is_thinking = True
                        print(content, end="", flush=True)
                    else:
                        if is_thinking:
                            print("\n" + "-"*30 + "\n", end="", flush=True)
                            is_thinking = False
                        print(content, end="", flush=True)
                    if inner.get("done"): break
            except: pass
        print()
    except Exception as e:
        print(f"[!] Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        chat_stream(" ".join(sys.argv[1:]))
    else:
        while True:
            try:
                user_input = input("\nUser: ").strip()
                if not user_input: continue
                if user_input.lower() in ["exit", "quit"]: break
                print("Assistant: ", end="", flush=True)
                chat_stream(user_input)
            except KeyboardInterrupt: break