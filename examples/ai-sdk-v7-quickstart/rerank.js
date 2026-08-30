import { phaseo } from "@phaseo/ai-sdk-provider";
import { rerank } from "ai";

const model = process.env.PHASEO_RERANK_MODEL ?? "voyage/rerank-2";

const result = await rerank({
  model: phaseo.rerankingModel(model),
  query: "Which document best explains TypeScript?",
  documents: [
    "TypeScript adds static types to JavaScript.",
    "Rust is a systems programming language.",
  ],
  topN: 1,
});

console.log(result.ranking);
