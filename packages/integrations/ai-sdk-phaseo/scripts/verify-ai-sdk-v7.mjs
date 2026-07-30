import { generateText } from "ai";
import { createPhaseo } from "../dist/index.js";

let requestBody;
const phaseo = createPhaseo({
  apiKey: "phaseo_test",
  fetch: async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: "chatcmpl_test",
        object: "chat.completion",
        created: 0,
        model: "openai/test",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Native v4" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 2,
          completion_tokens: 2,
          total_tokens: 4,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  },
});

if (phaseo.specificationVersion !== "v4") {
  throw new Error("Provider is not v4");
}

const model = phaseo("openai/test");
if (model.specificationVersion !== "v4") {
  throw new Error("Language model is not v4");
}

const result = await generateText({
  model,
  prompt: "compatibility check",
  reasoning: "medium",
});

if (result.text !== "Native v4") {
  throw new Error(`Unexpected result: ${result.text}`);
}

if (requestBody.reasoning_effort !== "medium") {
  throw new Error("AI SDK 7 reasoning option was not forwarded");
}

console.log("AI SDK 7 ProviderV4 smoke test passed");
