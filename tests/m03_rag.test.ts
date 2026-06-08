/**
 * m03 验收：抓网页 + RAG 检索 —— chunk 切块 / retrieve 相关度排序 / 丢零分块 / 端到端只返回相关段落。
 * 跑：pnpm test
 * 用 FakeFetcher（canned 页面、零网络）验证，不真发 HTTP。
 */
import { describe, it, expect } from "vitest";
import { chunk, retrieve } from "../src/rag";
import { makeFetchTool, FakeFetcher } from "../src/fetch";

describe("m03 chunk", () => {
  it("长文本切成多块，每块不超过 maxChars，句子不丢", () => {
    const text = "等待期是九十天。现金价值按年累积。核辐射属于除外责任。战争也不赔。";
    const chunks = chunk(text, 12);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(12);
    // 所有原句的关键词都还在某个块里
    expect(chunks.join("")).toContain("核辐射");
    expect(chunks.join("")).toContain("等待期");
  });
});

describe("m03 retrieve", () => {
  const chunks = [
    "核辐射属于除外责任，不予赔付。",
    "等待期是九十天。",
    "现金价值按保单年度累积。",
  ];

  it("与 query 词重叠最多的块排第一", () => {
    const out = retrieve("核辐射赔不赔", chunks, 3);
    expect(out[0]).toContain("核辐射");
  });

  it("topK 限制返回数量", () => {
    const out = retrieve("等待期 核辐射 现金价值", chunks, 1);
    expect(out.length).toBe(1);
  });

  it("完全无重叠 → 返回 []（不喂无关内容）", () => {
    const out = retrieve("披萨摇滚音乐会", chunks, 3);
    expect(out).toEqual([]);
  });
});

describe("m03 fetch_page 工具（端到端）", () => {
  it("抓长页 → 只返回与 query 相关的段落，不含无关段落", async () => {
    // 一段无关长文（单句、无内部句号），会被切成独立 chunk；与 query「核辐射 赔付」零字符重叠。
    const irrelevant =
      "今天阳光明媚微风轻拂的午后特别适合带着家人一起到郊外公园散步野餐顺便品尝当地有名的小吃甜点傍晚还可以去电影院观看一场轻松愉快的喜剧或者在商场悠闲逛街挑选几件喜欢的衣服饰品度过一个充实惬意的周末时光让身心彻底放松休息晚饭打算去尝尝新开的那家川菜馆据说招牌水煮鱼和麻婆豆腐都做得地道饭后再沿着江边慢慢散步吹吹晚风看看夜景结束这美好的一天";
    const longPage =
      "<html><body>" +
      "<p>核辐射属于除外责任，保险公司不予赔付。</p>" +
      "<p>等待期为九十天，期间出险不赔。</p>" +
      `<p>${irrelevant}。</p>` +
      "</body></html>";
    const tool = makeFetchTool(new FakeFetcher({ "https://ex.com/policy": longPage }));
    const out = await tool.run({ url: "https://ex.com/policy", query: "核辐射 赔付" });
    expect(out).toContain("核辐射");
    expect(out).not.toContain("阳光明媚"); // 无关长段被检索过滤掉
    expect(out.length).toBeLessThan(longPage.length); // 远小于原页
  });
});
