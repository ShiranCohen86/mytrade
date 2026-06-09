// In-memory access-token store.
//
// The access token is deliberately NOT persisted to localStorage — that keeps it
// out of reach of any XSS payload. It lives only in this module's closure for the
// lifetime of the page. On a fresh load the session is rehydrated from the
// httpOnly refresh cookie (see AuthContext), and apiClient transparently refreshes
// it on 401. The refresh token remains httpOnly and is never visible to JS.

let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}
