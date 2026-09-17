### `GET` https://claude.ai/edge-api/bootstrap/bb8efd7a-e973-4271-84ab-2f85ad59ebef/app_start?statsig_hashing_algorithm=djb2&growthbook_format=sdk&cache_bust=1&include_system_prompts=false

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.07854a27-6f1c-4bb2-a6f8-0db948b44e47
x-activity-session-id: e05338af-20a4-4261-bb54-2b3638fdd3d5
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/new
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
anthropic-client-version: 1.0.0
sec-ch-ua-mobile: ?0
anthropic-client-sha: dcb28fad37dadc374fa62d9a8f8ca9a64793f9ee
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
anthropic-client-build: 1789600962
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
```

**Response Headers:**
```http
X-Robots-Tag: none
Content-Encoding: zstd
CF-Cache-Status: DYNAMIC
request-id: req_011Cf8JG8kNgpVWhJVURWp8r
server-timing: auth;dur=0.2, acct;dur=36.6, ccjoin;dur=0.0, gb;dur=22.6, vw_probe;dur=0.0, holdjoin;dur=0.0, access;dur=0.6, mcs;dur=13.8, encode;dur=0.7, total;dur=75.1, x-originResponse;dur=96, origin_ttfb;dur=341, origin_body;dur=30, edge_total;dur=371
alt-svc: h3=":443"; ma=86400
Date: Thu, 17 Sep 2026 03:25:56 GMT
Content-Type: application/json; charset=utf-8
Vary: accept-encoding
Transfer-Encoding: chunked
Cache-Control: no-store
Pragma: no-cache
x-ion-version: f4204c48-0abc-49f6-b7eb-5e8c71ba5f6a
Connection: keep-alive
CF-Ray: a3c501a97ffafd23-SIN
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "account": {
    "tagged_id": "user_01Lp8HCHh8WREBoLuw9TDQSg",
    "uuid": "a07213e4-9ad5-4e84-8e6e-5f178496910d",
    "email_address": "thienbaovn2468@gmail.com",
    "full_name": "ThienBaoVN",
    "display_name": "ThienBaoVN",
    "memberships": [
      {
        "organization": {
          "id": 65274706,
          "uuid": "bb8efd7a-e973-4271-84ab-2f85ad59ebef",
          "name": "thienbaovn2468@gmail.com's Organization",
          "settings": {
            "account_session_duration_seconds": null,
            "allowed_invite_domains": null,
            "api_key_creation_enabled": null,
            "batches_download_ui_enabled_workspace_ids": [],
            "batches_download_ui_visibility": "all",
            "claude_academy_inference_enabled": null,
            "claude_academy_personalization_enabled": null,
            "claude_ai_ccr_sharing_enabled": true,
            "claude_ai_chat_external_sharing_enabled": false,
            "claude_ai_chat_sharing_enabled": true,
            "claude_ai_completion_feedback_enabled": true,
            "claude_ai_integration_sharing_enabled": true,
            "claude_ai_omelette_enabled": null,
            "claude_ai_operon_enabled": null,
            "claude_ai_skill_creation_enabled": null,
            "claude_ai_skill_plugins_scanning_enabled": null,
            "claude_ai_skill_publish_open_available": true,
            "claude_ai_skill_publish_policy": null,
            "claude_ai_skill_publish_policy_effective": "off",
            "claude_ai_skill_sharing_enabled": null,
            "claude_ai_skill_sharing_group_enabled": null,
            "claude_ai_skill_sharing_org_enabled": null,
            "claude_code_allow_session_pool_moves": null,
            "claude_code_default_worker_environment_id": null,
            "claude_code_default_worker_pool_id": null,
            "claude_code_disable_anthropic_compute": null,
            "claude_code_github_analytics_enabled": null,
            "claude_code_hide_managed_environments": null,
            "claude_code_metrics_logging_enabled": true,
            "claude_code_penguin_mode_enabled": false,
            "claude_code_quick_web_setup_enabled": null,
            "claude_code_remote_control_default_enabled": null,
            "claude_code_remote_control_enabled": null,
            "claude_code_routines_enabled": null,
            "claude_code_trusted_devices_required": null,
            "claude_code_workflows_enabled": null,
            "claude_console_privacy": "default_private",
            "cobalt_plinth_enabled": null,
            "connector_social_proof": null,
            "default_workspace_settings": {
              "enable_api_keys": true
            },
            "disabled_admin_request_types": null,
            "dramatic_shrimp_enabled": null,
            "files_api_enabled": true,
            "frontier_services_data_use_enabled": null,
            "inline_visualizations_enabled": null,
            "is_desktop_extension_allowlist_enabled": false,
            "lti_course_projects_enabled": null,
            "managed_agents_enabled": true,
            "member_usage_dashboard_visible": null,
            "oc_overage_credit_claimed": null,
            "pewter_finch_enabled": null,
            "sampling_restriction": null,
            "skills_api_enabled": true,
            "system_preferences_prompt": null,
            "vcs_connections": null,
            "work_across_apps_enabled": null,
            "workbench_completion_feedback_enabled": null
          },
          "capabilities": [
            "chat"
          ],
          "parent_organization_uuid": null,
          "rate_limit_tier": "default_claude_ai",
          "billing_type": null,
          "free_credits_status": null,
          "data_retention": "default",
          "api_disabled_reason": null,
          "api_disabled_until": null,
          "billable_usage_paused_until": null,
          "raven_type": null,
          "rate_limit_upsell": "upgrade_to_pro",
          "merchant_of_record": "anthropic",
          "claude_ai_bootstrap_models_config": [
            {
              "model": "claude-fable-5-1",
              "name": "Claude Fable 5.1",
              "description": "For your toughest challenges",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Can think for more complex tasks",
                  "id": "auto",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Thinking",
                  "title": "Thinking"
                }
              ],
              "hard_limit": 950000
            },
            {
              "model": "claude-opus-5",
              "name": "Claude Opus 5",
              "description": "For complex tasks",
              "notice_text": "Opus consumes usage limits faster than other models",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Can think for more complex tasks",
                  "id": "auto",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Thinking",
                  "title": "Thinking"
                }
              ],
              "hard_limit": 950000
            },
            {
              "model": "claude-opus-4-5-20251101",
              "name": "Claude Opus 4.5",
              "inactive": true,
              "notice_text": "Opus consumes usage limits faster than other models",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Think longer for complex tasks",
                  "id": "extended",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Extended",
                  "title": "Extended thinking"
                }
              ],
              "hard_limit": 190000
            },
            {
              "model": "claude-opus-4-1-20250805-claude-ai",
              "name": "Opus 4.1",
              "inactive": true,
              "notice_text": "Opus consumes usage limits faster than other models",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Think longer for complex tasks",
                  "id": "extended",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Extended",
                  "title": "Extended thinking"
                }
              ],
              "hard_limit": 190000
            },
            {
              "model": "claude-sonnet-5",
              "name": "Claude Sonnet 5",
              "description": "Most efficient for everyday tasks",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Can think for more complex tasks",
                  "id": "auto",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Thinking",
                  "title": "Thinking"
                }
              ],
              "hard_limit": 950000
            },
            {
              "model": "claude-haiku-4-5-20251001",
              "name": "Claude Haiku 4.5",
              "description": "Fastest for quick answers",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Think longer for complex tasks",
                  "id": "extended",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Extended",
                  "title": "Extended thinking"
                }
              ],
              "hard_limit": 190000
            },
            {
              "model": "claude-fable-5",
              "name": "Claude Fable 5",
              "overflow": true,
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Can think for more complex tasks",
                  "id": "auto",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Thinking",
                  "title": "Thinking"
                }
              ],
              "hard_limit": 449000
            },
            {
              "model": "claude-opus-4-8",
              "name": "Claude Opus 4.8",
              "overflow": true,
              "notice_text": "Opus consumes usage limits faster than other models",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Can think for more complex tasks",
                  "id": "auto",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Thinking",
                  "title": "Thinking"
                }
              ],
              "hard_limit": 950000
            },
            {
              "model": "claude-opus-4-7",
              "name": "Claude Opus 4.7",
              "overflow": true,
              "notice_text": "Opus consumes usage limits faster than other models",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Can think for more complex tasks",
                  "id": "auto",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Thinking",
                  "title": "Thinking"
                }
              ],
              "hard_limit": 449000
            },
            {
              "model": "claude-opus-4-6",
              "name": "Claude Opus 4.6",
              "overflow": true,
              "notice_text": "Opus consumes usage limits faster than other models",
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Think longer for complex tasks",
                  "id": "extended",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Extended",
                  "title": "Extended thinking"
                }
              ],
              "hard_limit": 449000
            },
            {
              "model": "claude-3-opus-20240229",
              "name": "Claude Opus 3",
              "overflow": true,
              "notice_text": "Opus consumes usage limits faster than other models",
              "paprika_modes": [],
              "thinking_modes": [],
              "knowledgeCutoff": "August 2023",
              "capabilities": {
                "mm_pdf": false,
                "mm_images": false,
                "web_search": false,
                "gsuite_tools": false,
                "compass": false
              },
              "hard_limit": 190000
            },
            {
              "model": "claude-sonnet-4-6",
              "name": "Claude Sonnet 4.6",
              "overflow": true,
              "paprika_modes": [
                "extended"
              ],
              "thinking_modes": [
                {
                  "description": "Can think for more complex tasks",
                  "id": "auto",
                  "mode": "extended",
                  "paprika_mode_value": "extended",
                  "selection_title": "Thinking",
                  "title": "Thinking"
                }
              ],
              "hard_limit": 449000
            }
          ],
          "has_icon": false,
          "external_mapping": null,
          "raven_configuration": null,
          "visibility_status": null,
          "created_at": "2025-08-26T08:40:10.259487Z",
          "is_internal_org": false,
          "monitoring_notice": null,
          "subscription_pause": null,
          "billing_issue": null,
          "analytics_subscription_plan": "claude_free",
          "access_block": null
        },
        "role": "admin",
        "seat_tier": null,
        "created_at": "2025-08-26T08:40:10.259487Z",
        "updated_at": "2026-08-22T21:10:03.733541Z",
        
}
```