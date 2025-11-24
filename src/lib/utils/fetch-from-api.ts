import { headers } from "next/headers";
import { resolveBaseUrl } from "./resolve-base-url";

export async function fetchFromApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const [baseUrl, hdrs] = await Promise.all([resolveBaseUrl(), headers()]);
  const cookieHeader = hdrs.get("cookie") ?? undefined;

  return fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });
}
