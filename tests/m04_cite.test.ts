/**
 * m04 验收：带引用的总结 —— cite 编号建表 / attribute 找出处 / 找不到=null / verify 逐句核对抓幻觉。
 * 跑：pnpm test
 */
import { describe, it, expect } from "vitest";
import { cite, attribute, verify, type Passage } from "../src/cite";

const PASSAGES: Passage[] = [
  { text: "核辐射属于除外责任，保险公司不予赔付。", url: "https://ex.com/a" },
  { text: "等待期为九十天，期间出险不赔。", url: "https://ex.com/b" },
];

describe("m04 cite", () => {
  it("从 1 编号、建引用表、来源块含编号与 url", () => {
    const { sourcesBlock, references } = cite(PASSAGES);
    expect(references.length).toBe(2);
    expect(references[0]).toMatchObject({ id: 1, url: "https://ex.com/a" });
    expect(references[1].id).toBe(2);
    expect(sourcesBlock).toContain("[1]");
    expect(sourcesBlock).toContain("https://ex.com/a");
  });
});

describe("m04 attribute", () => {
  const { references } = cite(PASSAGES);

  it("有 bigram 重叠 → 返回对应来源", () => {
    const ref = attribute("核辐射不予赔付", references);
    expect(ref?.url).toBe("https://ex.com/a");
  });

  it("找不到任何支撑 → 返回 null（可能的幻觉信号）", () => {
    const ref = attribute("本产品赠送境外旅行意外险", references);
    expect(ref).toBeNull();
  });

  it("多条来源时返回重叠最高的那条", () => {
    const ref = attribute("等待期九十天内出险不赔", references);
    expect(ref?.url).toBe("https://ex.com/b");
  });
});

describe("m04 verify（逐句核对）", () => {
  it("有据的句子拿到来源，编造的句子标为 null", () => {
    const { references } = cite(PASSAGES);
    // 第一句有据（来自 a），第二句是编的（来源里没有）。
    const answer = "核辐射不予赔付。另外本保单还免费赠送一年健身房会籍。";
    const checked = verify(answer, references);
    expect(checked.length).toBe(2);
    expect(checked[0].source?.url).toBe("https://ex.com/a");
    expect(checked[1].source).toBeNull(); // 幻觉句被抓出来
  });
});
