/**
 * m03 · RAG 原语（chunk + retrieve），移植自你在 mini-rag 学的那套。
 *
 * 真实网页抓回来几千上万字，整页塞给 LLM 会超上下文、烧 token、引入噪声。
 * 所以先 chunk（切块）再 retrieve（按与 query 的相关度挑 top-k），只把最相关的几段喂进去。
 * 这一章用最简的「词重叠」打通管线；语义向量 / hybrid / rerank 你在 mini-rag 见过，按需再加。
 */

/** 分句：在中英文句末标点 / 换行处切开，去掉空白片段。（已给好，retrieve/chunk 会用） */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？.!?\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 分词：ASCII 按单词、CJK 按单字，统一小写。用于相关度打分。（已给好） */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const ascii = lower.match(/[a-z0-9]+/g) ?? [];
  const cjk = lower.match(/[一-鿿]/g) ?? [];
  return [...ascii, ...cjk];
}

/**
 * 把长文本切成若干块，每块尽量不超过 maxChars。契约（见 learn-web Ch m03 第③节）：
 *  - 先 splitSentences 分句；贪心地把句子塞进当前块，
 *    一旦再加下一句会超过 maxChars 就「封口」、另起一块。
 *  - 不丢句子；单句超长时它自成一块。
 */
export function chunk(text: string, maxChars = 200): string[] {
  const sentences = splitSentences(text);
  const result: string[] = [];
  let current = "";

  for (const sent of sentences) {
    if (current === "") {
      current = sent;
    } else if (current.length + sent.length <= maxChars) {
      current += sent;
    } else {
      result.push(current);
      current = sent;
    }
  }
  if (current) result.push(current);

  return result;
}

/**
 * 从 chunks 里挑出与 query 最相关的 top-k 块。契约（见 learn-web Ch m03 第③节）：
 *  - 用 tokenize 给 query 和每个 chunk 分词，相关度 = 二者去重 token 的重叠个数。
 *  - 按相关度从高到低排序，丢掉相关度为 0 的块（宁缺毋滥，不喂无关内容），
 *    最多返回 topK 个。
 */
export function retrieve(query: string, chunks: string[], topK = 3): string[] {
  const qTokens = new Set(tokenize(query));
  const scored: { chunk: string; score: number }[] = [];

  for (const c of chunks) {
    const cTokens = new Set(tokenize(c));
    let score = 0;
    for (const t of qTokens) {
      if (cTokens.has(t)) score++;
    }
    if (score > 0) scored.push({ chunk: c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}
