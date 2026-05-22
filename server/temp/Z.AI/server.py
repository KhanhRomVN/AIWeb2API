\"\"\"
Z.AI API Server - Pure Python Mode (v2 Final)
\"\"\"
import json
import sys
import time
import requests as req_lib
import uuid
from flask import Flask, request, Response, jsonify
from signature import get_auth_data, generate_signature_and_params, get_headers

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

PORT = 8889
AUTH_PATH = "z_ai_auth.json"
BASE_URL = "https://chat.z.ai/api/v2/chat/completions"

app = Flask(__name__)
_start_time = time.time()
_http_session = req_lib.Session()

def _call_zai_api(prompt, stream=True):
    token, user_id = get_auth_data(AUTH_PATH)
    if not token or not user_id:
        raise Exception("Auth error: Token or user_id not found in z_ai_auth.json")

    sig_res = generate_signature_and_params(prompt, token, user_id)
    url = f"{BASE_URL}?{sig_res['queryParams']}"
    headers = get_headers(token, sig_res['signature'])
    
    payload = {
        "stream": stream,
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

    return _http_session.post(url, headers=headers, json=payload, stream=stream, timeout=120)

@app.route("/health")
def health():
    return jsonify({
        "status": "ok", 
        "engine": "pure-python", 
        "uptime": int(time.time()-_start_time),
        "api_version": "v2"
    })

@app.route("/v1/accounts")
def accounts():
    return jsonify([{
        "id": "zai-account", 
        "provider_id": "z.ai", 
        "email": "user@z.ai",
        "model": "GLM-5-Turbo",
        "isActive": True
    }])

@app.route("/v1/models")
def models():
    return jsonify({
        "object": "list",
        "data": [{"id": "glm-5-turbo", "object": "model", "owned_by": "z.ai"}]
    })

@app.route("/v1/chat/accounts/messages", methods=["POST"])
def chat_accounts_messages():
    body = request.get_json()
    if not body: return jsonify({"error": "Invalid JSON"}), 400
    messages = body.get("messages", [])
    prompt = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), None)
    if not prompt: return jsonify({"error": "No user message"}), 400
    
    def generate():
        yield f'data: {json.dumps({"meta": {"providerId": "z.ai", "modelId": "glm-5-turbo", "accountId": "zai-account"}})}\n\n'
        try:
            resp = _call_zai_api(prompt, stream=True)
            if resp.status_code != 200:
                yield f'data: {json.dumps({"error": f"API Error {resp.status_code}: {resp.text[:100]}"})}\n\n'
                return

            is_thinking = False
            for line in resp.iter_lines():
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
                            if content: yield f'data: {json.dumps({"thinking": content})}\n\n'
                        else:
                            if content: yield f'data: {json.dumps({"content": content})}\n\n'
                        if inner.get("done"): break
                except: pass
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'
        yield "data: [DONE]\n\n"
    return Response(generate(), mimetype="text/event-stream")

@app.route("/v1/chat/completions", methods=["POST"])
def openai_chat_completions():
    body = request.get_json()
    if not body: return jsonify({"error": "Invalid JSON"}), 400
    messages = body.get("messages", [])
    stream = body.get("stream", False)
    prompt = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), None)
    if not prompt: return jsonify({"error": "No user message"}), 400

    if stream:
        def generate_openai():
            try:
                resp = _call_zai_api(prompt, stream=True)
                for line in resp.iter_lines():
                    if not line: continue
                    decoded = line.decode("utf-8")
                    if not decoded.startswith("data: "): continue
                    data_str = decoded[6:].strip()
                    if data_str == "[DONE]": break
                    try:
                        inner = json.loads(data_str).get("data", {})
                        if isinstance(inner, dict):
                            content = inner.get("delta_content", "")
                            phase = inner.get("phase", "")
                            if content and phase != "thinking":
                                chunk = {"choices": [{"delta": {"content": content}}]}
                                yield f"data: {json.dumps(chunk)}\n\n"
                            if inner.get("done"): break
                    except: pass
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
        return Response(generate_openai(), mimetype="text/event-stream")
    else:
        try:
            resp = _call_zai_api(prompt, stream=True)
            full_text = ""
            for line in resp.iter_lines():
                if not line: continue
                decoded = line.decode("utf-8")
                if decoded.startswith("data: "):
                    data_str = decoded[6:].strip()
                    if data_str == "[DONE]": break
                    try:
                        inner = json.loads(data_str).get("data", {})
                        if inner.get("phase") != "thinking":
                            full_text += inner.get("delta_content", "")
                        if inner.get("done"): break
                    except: pass
            return jsonify({
                "choices": [{"message": {"role": "assistant", "content": full_text}, "finish_reason": "stop"}]
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print(f"[*] Z.AI Pure Python Server (v2) at http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, threaded=True)
