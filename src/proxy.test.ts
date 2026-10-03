import { afterAll, expect, test } from "bun:test";
import { proxyToApi } from "./proxy";

const api = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/v1/echo") {
      return Response.json(
        {
          method: req.method,
          search: url.search,
          auth: req.headers.get("authorization"),
          forwardedFor: req.headers.get("x-forwarded-for"),
          body: req.method === "GET" ? null : await req.json(),
        },
        { status: 201, headers: { "retry-after": "7" } },
      );
    }
    return new Response("a;b\n", {
      headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="x.csv"' },
    });
  },
});
afterAll(() => api.stop(true));
const base = `http://localhost:${api.port}`;

test("forwards method, query, headers and body; passes the response through", async () => {
  const req = new Request("http://panel.local/v1/echo?q=1", {
    method: "POST",
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify({ a: 1 }),
  });
  const res = await proxyToApi(req, base, "203.0.113.5");
  expect(res.status).toBe(201);
  expect(res.headers.get("retry-after")).toBe("7");
  expect(await res.json()).toEqual({
    method: "POST",
    search: "?q=1",
    auth: "Bearer t",
    forwardedFor: "203.0.113.5",
    body: { a: 1 },
  });
});

test("keeps file downloads intact", async () => {
  const res = await proxyToApi(new Request("http://panel.local/v1/city/reports.csv"), base);
  expect(res.headers.get("content-disposition")).toContain("x.csv");
  expect(await res.text()).toBe("a;b\n");
});

test("answers 502 when the API is down", async () => {
  const res = await proxyToApi(new Request("http://panel.local/v1/x"), "http://localhost:1");
  expect(res.status).toBe(502);
});
