/**
 * m07 · 编排成完整研究助手（capstone）。
 *
 * 前六章造好了所有零件，这一章把它们按数据流串成一条「研究流水线」：
 *   搜索(m02) → 抓取+检索证据(m03) → 编号(m04) → LLM 总结 → 逐句溯源+查幻觉引用(m04/m05)
 * 产出一份「每句可溯源、幻觉可见」的研究报告 ResearchReport。
 *
 * 注意这是**流水线式编排**：步骤由代码写死，LLM 只负责「读证据→写总结」这一步。
 * 它跟 m01-m06 的 runAgent（LLM 自己决定下一步调什么工具）是两种正交的编排风格——
 * 步骤固定、要可控可测时用流水线；步骤不定、要 agent 自主探索时用循环。详见本章第⑤节。
 */
import type { LLMClient } from "./llm";
import type { SearchProvider } from "./search";
import { type Fetcher, stripHtml } from "./fetch";
import { chunk, retrieve } from "./rag";
import { cite, verify, type Passage, type Reference } from "./cite";
import { validateCitations } from "./robust";

/** 一份研究报告：正文（含 [n] 引用）+ 引用表 + 两类「需复核」信号。 */
export interface ResearchReport {
  topic: string;
  /** LLM 基于证据写的总结，论断后带 [n] 引用。 */
  answer: string;
  /** 编号后的引用表，[n] 对应到具体 url + 原文。 */
  references: Reference[];
  /** verify 查出「找不到出处」的句子（可能的幻觉内容，需人工复核）。 */
  unsupported: string[];
  /** validateCitations 查出「引用了不存在的编号」（如 [99]）。 */
  invalidCitations: number[];
}

/** research 的外部依赖（同 LLMClient 一招：测试注入 Fake，生产换真实实现）。 */
export interface ResearchDeps {
  client: LLMClient;
  search: SearchProvider;
  fetcher: Fetcher;
  /** 最多采纳前几条搜索结果，默认 3。 */
  maxSources?: number;
}

/**
 * 把「主题 + 证据」拼成给 LLM 的总结 prompt。（已给好——把 cite 的 sourcesBlock 塞进去，
 * 并要求 LLM 用 [n] 标注来源，这样它的输出才带可校验的引用编号。） */
export function buildSummaryPrompt(topic: string, sourcesBlock: string): string {
  return [
    `请基于以下带编号的资料，就「${topic}」写一段简洁的研究总结。`,
    `要求：每个论断后用 [编号] 标注来源（如 [1]）；只用资料里的信息，不要编造。`,
    ``,
    `资料：`,
    sourcesBlock,
  ].join("\n");
}

/**
 * 跑一次完整研究，产出 ResearchReport。契约（见 learn-web Ch m07 第③节）：
 *  1. 搜索：deps.search.search(topic)，取前 maxSources 条的 url。
 *  2. 抓取+检索：对每个 url，fetcher.fetch → stripHtml → chunk → retrieve(topic, ...)，
 *     把检索到的每段连同它的 url 收成 Passage[]（空页/无相关段就跳过）。
 *  3. 编号：cite(passages) 拿到 { sourcesBlock, references }。
 *  4. 总结：buildSummaryPrompt(topic, sourcesBlock) → client.complete(...)，取 response.text 当 answer。
 *  5. 校验：verify(answer, references) 里 source===null 的句子收进 unsupported；
 *     validateCitations(answer, references) 得到 invalidCitations。
 *  6. 组装并返回 ResearchReport。
 */
export async function research(
  topic: string,
  deps: ResearchDeps,
): Promise<ResearchReport> {
  // TODO(m07)：把六步串起来——
  //  1. 搜索：deps.search.search(topic)，取前 (deps.maxSources ?? 3) 条 url
  //  2. 抓取+检索：每个 url → stripHtml(await deps.fetcher.fetch(url)) → 空则跳过
  //     → retrieve(topic, chunk(text), 3) 的每段连同 url 收进 passages: Passage[]
  //  3. 编号：const { sourcesBlock, references } = cite(passages)
  //  4. 总结：buildSummaryPrompt(topic, sourcesBlock) → deps.client.complete([{role:"user",content:prompt}], [])
  //     → answer = response.text ?? ""
  //  5. 校验：verify(answer, references) 里 source===null 的句子收进 unsupported；
  //     validateCitations(answer, references) → invalidCitations
  //  6. return { topic, answer, references, unsupported, invalidCitations }
  // 提示：stripHtml/chunk/retrieve/cite/verify/validateCitations/buildSummaryPrompt 都已 import。
  throw new Error("m07 未实现：research");
}
