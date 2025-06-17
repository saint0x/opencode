import { Auth } from "./index.js"

// Simple PKCE implementation
async function generatePKCE() {
  const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(byte => String.fromCharCode(byte))
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 43)
  
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return {
    verifier: codeVerifier,
    challenge: challenge
  }
}

export namespace AuthAnthropic {
  const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

  export async function authorize() {
    const pkce = await generatePKCE()
    const url = new URL("https://claude.ai/oauth/authorize")
    url.searchParams.set("code", "true")
    url.searchParams.set("client_id", "9d1c250a-e61b-44d9-88ed-5944d1962f5e")
    url.searchParams.set("response_type", "code")
    url.searchParams.set(
      "redirect_uri",
      "https://console.anthropic.com/oauth/code/callback",
    )
    url.searchParams.set(
      "scope",
      "org:create_api_key user:profile user:inference",
    )
    url.searchParams.set("code_challenge", pkce.challenge)
    url.searchParams.set("code_challenge_method", "S256")
    url.searchParams.set("state", pkce.verifier)
    return {
      url: url.toString(),
      verifier: pkce.verifier,
    }
  }

  export async function exchange(code: string, verifier: string) {
    const splits = code.split("#")
    const result = await fetch("https://console.anthropic.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: splits[0],
        state: splits[1],
        grant_type: "authorization_code",
        client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
        redirect_uri: "https://console.anthropic.com/oauth/code/callback",
        code_verifier: verifier,
      }),
    })
    if (!result.ok) throw new ExchangeFailed()
    const json = await result.json() as { refresh_token: string; expires_in: number }
    await Auth.set("anthropic", {
      type: "oauth",
      refresh: json.refresh_token,
      expires: Date.now() + json.expires_in * 1000,
    })
  }

  export async function access() {
    const info = await Auth.get("anthropic")
    if (!info || info.type !== "oauth") return
    const response = await fetch(
      "https://console.anthropic.com/v1/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: info.refresh,
          client_id: CLIENT_ID,
        }),
      },
    )
    if (!response.ok) return
    const json = await response.json() as { refresh_token: string; expires_in: number; access_token: string }
    await Auth.set("anthropic", {
      type: "oauth",
      refresh: json.refresh_token,
      expires: Date.now() + json.expires_in * 1000,
    })
    return json.access_token
  }

  export async function oauth(code: string) {
    // This would handle OAuth flow - simplified for now
    console.log("Anthropic OAuth not yet implemented, got code:", code)
    return {
      type: "oauth" as const,
      refresh: "fake-refresh-token",
      expires: Date.now() + 3600000,
    }
  }
  
  export async function store(authInfo: Auth.Info) {
    await Auth.set("anthropic", authInfo)
  }

  export class ExchangeFailed extends Error {
    constructor() {
      super("Exchange failed")
    }
  }
}
