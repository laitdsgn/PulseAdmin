// Forwards /v1/* requests from the panel's origin to the backend API.

// Hop-by-hop headers (RFC 9110 §7.6.1) and ones fetch() must compute itself.
const DROP_REQUEST = ["host", "connection", "keep-alive", "transfer-encoding", "upgrade", "content-length"];
const DROP_RESPONSE = ["connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length"];

export const proxyToApi = async (req: Request, apiBase: string, clientIp?: string) => {
  const url = new URL(req.url);
  const target = new URL(url.pathname + url.search, apiBase);

  const headers = new Headers(req.headers);
  for (const name of DROP_REQUEST) headers.delete(name);
  // The backend only trusts this header when TRUST_PROXY_HOPS > 0.
  if (clientIp) {
    const prior = req.headers.get("x-forwarded-for");
    headers.set("x-forwarded-for", prior ? `${prior}, ${clientIp}` : clientIp);
  }

  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      redirect: "manual",
    });
  } catch {
    return Response.json({ error: { message: "API unreachable", code: "bad_gateway" } }, { status: 502 });
  }

  const outHeaders = new Headers(res.headers);
  for (const name of DROP_RESPONSE) outHeaders.delete(name);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
};
