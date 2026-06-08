/**
 * m02 · 工具系统 + web 搜索。
 *
 * 把「搜索」做成一个 agent 工具。关键设计：搜索后端抽象成 SearchProvider 接口——
 * 测试注入 FakeSearchProvider（确定性、零网络），真实运行换 DuckDuckGoProvider。
 * 这跟 m01 把 LLM 抽象成 LLMClient 是同一招：依赖接口、不绑实现，才测得动、换得动。
 */
import type { ToolSpec } from "./llm";

/** 一条搜索结果。 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 搜索后端抽象。换 Google / Bing / DuckDuckGo 只是换实现，工具代码不动。 */
export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

/**
 * 测试 / demo 用的确定性搜索后端：query 命中 canned 的某个 key（子串）就返回对应结果，否则空。
 * 零网络、不抖动——这才能让「搜索工具 + agent 循环」被稳定验证。
 */
export class FakeSearchProvider implements SearchProvider {
  constructor(private canned: Record<string, SearchResult[]> = {}) {}
  async search(query: string): Promise<SearchResult[]> {
    for (const key of Object.keys(this.canned)) {
      if (query.includes(key)) return this.canned[key];
    }
    return [];
  }
}

/**
 * 真实搜索后端（best-effort，无需 API key）：DuckDuckGo Instant Answer JSON。
 * 仅 demo / 真实运行用；测试一律用 FakeSearchProvider。失败不抛错，返回空数组——
 * 「搜不到」对 agent 来说是信息，不是异常（参见 m02 工具返回的设计）。
 */
export class DuckDuckGoProvider implements SearchProvider {
  async search(query: string): Promise<SearchResult[]> {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const resp = await fetch(url);
      const data = (await resp.json()) as {
        RelatedTopics?: Array<{ FirstURL?: string; Text?: string }>;
      };
      const topics = data.RelatedTopics ?? [];
      return topics
        .filter((t) => t.FirstURL && t.Text)
        .map((t) => ({ title: t.Text!, url: t.FirstURL!, snippet: t.Text! }));
    } catch {
      return [];
    }
  }
}

/**
 * 把一个 SearchProvider 包成 agent 工具。run 的契约（见 learn-web Ch m02 第③节）：
 *  1. 从 args 取 query；缺失或空白 → 返回明确的错误字符串（不要抛错）。
 *  2. await provider.search(query)。
 *  3. 结果为空 → 返回含「没有找到」的提示串。
 *  4. 否则格式化成带编号的文本（每条 [n] title / url / snippet），供 LLM 阅读。
 * 注意：parameters 要声明 query 必填，LLM 才知道该传什么。
 */
export function makeSearchTool(provider: SearchProvider): ToolSpec {
  return {
    name: "web_search",
    description:
      "在互联网上搜索信息。传入 query 搜索词，返回相关网页的标题、链接和摘要。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
    async run(args: Record<string, unknown>): Promise<string> {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) {
        return "错误：缺少 query 参数，请提供搜索关键词";
      }
      const results = await provider.search(query);
      if (results.length === 0) {
        return `搜索 "${query}" 没有找到相关结果。`;
      }
      return results
        .map((r, i) => `[${i + 1}] ${r.title} / ${r.url} / ${r.snippet}`)
        .join("\n\n");
    },
  };
}
