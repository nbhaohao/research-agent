/**
 * m04 看效果：给检索证据编号 → 把来源块塞进 prompt → LLM 写带 [n] 的总结 → verify 逐句核对。
 * 跑：pnpm dev src/m04_demo.ts
 * 重点看：有据的句子拿到来源 [n]，编造的句子被标成 ⚠️ 无来源（可能幻觉）。
 */
import { cite, verify, type Passage } from "./cite";

const PASSAGES: Passage[] = [
  { text: "核辐射属于除外责任，保险公司不予赔付。", url: "https://ex.com/policy-a" },
  { text: "等待期为九十天，期间出险不赔。", url: "https://ex.com/policy-b" },
];

async function demo() {
  console.log("=".repeat(52));
  console.log("m04 demo · 带引用的总结 + 逐句溯源核对");
  console.log("=".repeat(52));

  // 生成「前」：编号 + 来源块（这段会放进给 LLM 的 prompt）
  const { sourcesBlock, references } = cite(PASSAGES);
  console.log("\n--- 放进 prompt 的来源块 ---");
  console.log(sourcesBlock);

  // 模拟 LLM 写出的总结：前两句有据，最后一句是编的（来源里根本没有）
  const answer =
    "核辐射不予赔付。等待期为九十天期间出险不赔。另外本保单还免费赠送一年健身房会籍。";
  console.log("\n--- LLM 写的总结 ---");
  console.log(answer);

  // 生成「后」：逐句核对有没有出处
  console.log("\n--- 逐句溯源 ---");
  for (const { sentence, source } of verify(answer, references)) {
    const tag = source ? `[${source.id}] ${source.url}` : "⚠️ 无来源（可能幻觉，需复核）";
    console.log(`  · ${sentence}  →  ${tag}`);
  }
}

demo();
