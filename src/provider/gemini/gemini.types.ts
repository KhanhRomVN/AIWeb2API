// =============================================================================
// TYPES & INTERFACES — Gemini
// =============================================================================

export interface GeminiCredential {
  cookie: string; // Full cookie string: "SID=xxx; HSID=xxx; ..."
  sapisid?: string; // SAPISID value for SAPISIDHASH auth header
  authUser?: string; // Google account index (e.g. "1" for /u/1/)
  xsrfToken?: string; // XSRF token from Gemini page source (SNlM0e)
  email?: string; // Account email
}