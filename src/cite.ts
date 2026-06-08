/**
 * m04 · 带引用的总结：让研究报告「每句话都可溯源」，移植自 mini-rag s09 的 cite + attribute。
 *
 * 两个时机配合：
 *  - 生成「前」：cite() 给每段检索证据编号 [n] + 建引用表，把它放进 prompt，LLM 才能在答案里引用 [n]。
 *  - 生成「后」：verify() 把答案逐句 attribute()，检查每句有没有对应来源——没有的就是可能的幻觉，标出来。
 *
 * 关键区分：attribution（这句话有没有出处）≠ factuality（这句话说得对不对）。
 * 程序能廉价地查前者；后者难得多，不在本章范围。
 */
import { tokenize, splitSentences } from "./rag";

/** 一段检索到的证据：文本 + 它来自哪个 url。 */
export interface Passage {
  text: string;
  url: string;
}

/** 编号后的引用条目。 */
export interface Reference {
  id: number;
  url: string;
  text: string;
}

/** 相邻 token 的二元组（bigram）集合，用于 attribute 的短语级重叠打分。（已给好）
 *  用 bigram 而非单 token：单字/单词重叠太松，中文里大量句子会偶然共享单字而误判「有出处」。 */
export function bigrams(text: string): Set<string> {
  const toks = tokenize(text);
  const grams = new Set<string>();
  for (let i = 0; i + 1 < toks.length; i++) grams.add(toks[i] + "|" + toks[i + 1]);
  return grams;
}

/**
 * 给每段证据编号、建引用表 + 可放进 prompt 的来源块。契约（见 learn-web Ch m04 第③节）：
 *  - references：passages 从 1 开始编号，每条 { id, url, text }。
 *  - sourcesBlock：每行 "[id] (url) text"，用换行连起来（这段塞进 prompt 让 LLM 引用 [n]）。
 */
export function cite(passages: Passage[]): { sourcesBlock: string; references: Reference[] } {
  throw new Error("m04 未实现：cite");
}

/**
 * 判断一句话（claim）是否在引用表里找得到出处。契约（见 learn-web Ch m04 第③节）：
 *  - 用 bigrams 算 claim 与每条 reference.text 的二元组重叠个数。
 *  - 返回重叠最高的那条 reference；若全为 0（找不到任何支撑）→ 返回 null（可能的幻觉信号）。
 */
export function attribute(claim: string, references: Reference[]): Reference | null {
  throw new Error("m04 未实现：attribute");
}

/** 把答案逐句 attribute：返回每句 + 它的来源（null = 找不到出处，需复核）。（已给好，串联 cite/attribute） */
export function verify(
  answer: string,
  references: Reference[],
): Array<{ sentence: string; source: Reference | null }> {
  return splitSentences(answer).map((sentence) => ({
    sentence,
    source: attribute(sentence, references),
  }));
}
