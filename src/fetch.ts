/**
 * m03 · 抓网页 + 把「抓取 → 提取正文 → 切块 → 检索相关段落」包成一个 agent 工具。
 *
 * 抓取后端抽象成 Fetcher 接口——和 m02 的 SearchProvider 同一招：
 * 测试注入 FakeFetcher（canned 页面、零网络），真实运行换 HttpFetcher。
 */
import type { ToolSpec } from "./llm";
import { chunk, retrieve } from "./rag";

/** 抓取后端抽象：给 url，拿回原始 HTML（或纯文本）。 */
export interface Fetcher {
  fetch(url: string): Promise<string>;
}

/** 测试 / demo 用的确定性抓取后端：按 url 返回 canned 页面，未命中返回空串。 */
export class FakeFetcher implements Fetcher {
  constructor(private pages: Record<string, string> = {}) {}
  async fetch(url: string): Promise<string> {
    return this.pages[url] ?? "";
  }
}

/** 真实抓取后端（best-effort）：仅 demo / 真实运行用，失败不抛错返回空串。 */
export class HttpFetcher implements Fetcher {
  async fetch(url: string): Promise<string> {
    try {
      const resp = await fetch(url);
      return await resp.text();
    } catch {
      return "";
    }
  }
}

/** 极简正文提取：去掉 script/style、剥标签、压空白。（已给好） */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 把一个 Fetcher 包成 fetch_page 工具：抓页 → 提取正文 → 切块 → 按 query 检索相关段落。
 * 返回的是「与 query 最相关的几段」而非整页——这正是 m03 的重点。（已给好，依赖 rag.ts 的 chunk/retrieve）
 */
export function makeFetchTool(fetcher: Fetcher): ToolSpec {
  return {
    name: "fetch_page",
    description:
      "抓取一个网页，返回其中与 query 最相关的若干段落（而非整页，省上下文）。参数：url、query。",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "要抓取的网页地址" },
        query: { type: "string", description: "研究主题 / 想从页面里找什么" },
      },
      required: ["url", "query"],
    },
    async run(args: Record<string, unknown>): Promise<string> {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!url) return "错误：缺少 url 参数。";
      if (!query) return "错误：缺少 query 参数。";
      const html = await fetcher.fetch(url);
      const text = stripHtml(html);
      if (!text) return `抓取 ${url} 失败或页面为空。`;
      const relevant = retrieve(query, chunk(text), 3);
      if (relevant.length === 0) return `页面中没有找到与「${query}」相关的内容。`;
      return relevant.map((c, i) => `[片段 ${i + 1}] ${c}`).join("\n\n");
    },
  };
}
