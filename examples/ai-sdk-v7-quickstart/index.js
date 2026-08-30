import { phaseo } from "@phaseo/ai-sdk-provider";
import { generateText } from "ai";

const model = process.env.PHASEO_MODEL ?? "openai/gpt-5.6-sol";

const result = await generateText({
  model: phaseo(model),
  prompt: "Reply with: AI SDK 7 works",
});

console.log(result.text);
console.log({ model, providerMetadata: result.providerMetadata });
