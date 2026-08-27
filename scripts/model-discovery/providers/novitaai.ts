import { asArray, asRecord, defineProvider, fetchJson, normalizeModelEntries } from "./_shared";

export default defineProvider({
    id: "novitaai",
    name: "NovitaAI",
    async fetchModels() {
        const apiKey = process.env.NOVITA_API_KEY?.trim();
        const payload = await fetchJson({
            url: "https://api.novita.ai/openai/v1/models",
            init: {
                headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
            },
        });
        const data = asArray(asRecord(payload)?.data);
        return normalizeModelEntries(data, (item) => (typeof item.id === "string" ? item.id : null));
    },
});
