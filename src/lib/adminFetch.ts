export function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  let token = "";
  try {
    const session = JSON.parse(sessionStorage.getItem("admin_session") ?? "{}");
    token = session.token ?? "";
  } catch {}
  return fetch(url, {
    ...options,
    headers: { ...((options?.headers as Record<string, string>) ?? {}), "x-admin-token": token },
  });
}
