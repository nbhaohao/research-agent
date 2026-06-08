# research-agent · 资料研究助手

> Datawhale Agent-Learning-Hub **Stage 2** capstone。输入一个主题 → 自动搜索、筛选、总结，并输出带**引用链接**的研究报告。
> 学习方式：build 三拍循环（预测 → 测试变绿 → 解释），每个模块加一个机制 + 一个不真调 LLM 的测试。

## 技术栈

- **TypeScript / Node**（pnpm + tsx + vitest）
- LLM：DeepSeek（OpenAI 兼容端点）
- 记忆：[mem0](https://github.com/mem0ai/mem0) oss 本地版（`mem0ai/oss`）
- RAG：自实现 chunk/retrieve/cite（移植自 Python 的 mini-rag 思路）

## Stage 2 五项要求 → 模块映射

| # | Stage 2 要求 | 模块 |
|---|---|---|
| 1 | RAG：chunk / embed / retrieve / answer with citations | m03 + m04 |
| 2 | 把搜索 / 文件 / 浏览器等接成工具 | m02 |
| 3 | 区分短期上下文 / 会话记忆 / 长期记忆 | m06（mem0） |
| 4 | 处理工具失败 / 空结果 / 重复调用 / 幻觉引用 | m05 |
| 5 | 回答里给出来源 / 证据 | m04 |

## 模块路线图

- **m01** 项目骨架 + 最小 agent loop（LLM 调用循环）
- **m02** 工具系统 + web 搜索工具
- **m03** 抓网页 + chunk / retrieve（RAG）
- **m04** 带引用的总结输出（cite / attribute）
- **m05** 健壮性（工具失败 / 空结果 / 重复调用 / 幻觉引用）
- **m06** mem0 记忆分层（短期 / 会话 / 长期）
- **m07** 编排成完整研究 agent + 端到端研究报告

## 运行

```bash
pnpm install
pnpm test            # 跑全部测试（vitest）
pnpm dev src/xxx.ts  # 跑某个 demo
```

参考实现风格：核心函数纯净、`demo()` 分阶段 trace、测试用逐条 ✅ check（沿用 mini-rag 约定）。
