const COPY = [
  { title: "稍作沉淀", description: "Chickencop 有所调整，我们很快会面。" },
  { title: "暂别一会儿。", description: "Chickencop 正在调整，感谢你的关注。" },
  { title: "好事值得等待。", description: "Chickencop 正在为下一步做准备。" },
  { title: "下一次见面。", description: "留一点时间，给新的开始。" },
  { title: "我们还在准备。", description: "谢谢你一直关注 Chickencop。" },
  { title: "来得正好。", description: "Chickencop 正在进行一些调整。" },
  { title: "感谢你来看看。", description: "我们正在调整，后续信息会在这里更新。" },
  { title: "快见面了。", description: "Chickencop 正在为接下来的安排做准备。" },
  { title: "先在这里等一等。", description: "Chickencop 的相关信息将在后续更新。" },
  { title: "这里很快再见。", description: "感谢你对 Chickencop 的关注。" }
];

const HOUR = 60 * 60 * 1000;
const MIN_DELAY = 6 * HOUR;
const MAX_DELAY = 30 * HOUR;

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

function randomNextIndex(current) {
  if (COPY.length < 2) return current;
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * COPY.length);
  }
  return next;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/cover-copy") {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" }
      });
    }

    const id = env.COPY_STATE.idFromName("global-copy-v1");
    const stub = env.COPY_STATE.get(id);
    return stub.fetch("https://copy-state/current", {
      method: request.method
    });
  },

  async scheduled(controller, env, ctx) {
    const id = env.COPY_STATE.idFromName("global-copy-v1");
    const stub = env.COPY_STATE.get(id);
    ctx.waitUntil(stub.fetch("https://copy-state/tick", { method: "POST" }));
  }
};

export class GlobalCopyState {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();

    if (url.pathname === "/tick" && request.method === "POST") {
      let state = await this.ctx.storage.get("state");

      if (!state) {
        state = {
          index: 0,
          nextAt: now + randomDelay(),
          updatedAt: now
        };
      } else if (now >= state.nextAt) {
        state = {
          index: randomNextIndex(state.index),
          nextAt: now + randomDelay(),
          updatedAt: now
        };
      }

      await this.ctx.storage.put("state", state);
      return Response.json({ ok: true });
    }

    if (url.pathname !== "/current" ||
        (request.method !== "GET" && request.method !== "HEAD")) {
      return new Response("Not Found", { status: 404 });
    }

    const state = await this.ctx.storage.get("state");
    const index = Number.isInteger(state?.index) &&
      state.index >= 0 &&
      state.index < COPY.length ? state.index : 0;
    const item = COPY[index];

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    };

    const body = JSON.stringify({
      title: item.title,
      description: item.description,
      index,
      nextAt: Number.isFinite(state?.nextAt) ? state.nextAt : null,
      updatedAt: Number.isFinite(state?.updatedAt) ? state.updatedAt : null
    });

    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers
    });
  }
};
