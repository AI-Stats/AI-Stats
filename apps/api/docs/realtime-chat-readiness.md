# Realtime Chat verification

Updated 2026-09-07. This is an operational record, not a public API launch.

## Verified

- Chat submission matches the strict gateway session schema. The managed key is scoped to both workspace and user; the gateway verifies that same identity.
- Microphone capture waits for the provider's configuration acknowledgement. Setup errors terminate the session before accepting audio.
- Provider message processing is ordered so a socket close cannot overtake persisted usage from the preceding event.
- Cached OpenAI input tokens are subtracted once. Normalized usage remains stable through persistence and settlement.
- Chat reads billing from the database after disconnect. Settings → Logs → Realtime Sessions shows reserved, captured, released and unresolved amounts separately.
- Production rollback-only SQL checks cover reservation, exclusive connection claims, repeated hold extension, nonzero settlement, partial release, repeated settlement and late callbacks. No fixture rows remain.

## Live evidence

Setup acknowledgements were received from OpenAI `gpt-realtime`, `gpt-realtime-1.5`, `gpt-realtime-2`, `gpt-realtime-mini`, `gpt-realtime-2.1` and `gpt-realtime-2.1-mini` with `marin`; Google `gemini-3.1-flash-live-preview` with `Puck`; and xAI `grok-voice-latest` and `grok-voice-think-fast-2.0` with `eve`. Setup checks requested no generation. All ten OpenAI built-in voices passed setup on GPT-Realtime-2. The xAI picker now includes all 28 voices returned by its voice API, including Aurora and Liora; this is catalogue verification, not an audio canary for every voice.

GPT-Realtime-2.1 and 2.1 Mini now have separate Realtime text, cached-input and audio price meters sourced from their official model pages. Incorrect text-generation cards were removed: those records had treated audio rates as text prices, and the provider routes only advertise Realtime. xAI aliases now resolve consistently to the catalogue's `spacex-ai` identity. Its current 2.0 model costs $0.08 per connected audio minute plus $0.004 per text input message; the UI estimate has been updated.

A local build of the relay, using the production database and real Google API, completed a short PCM16 voice turn. Session `rt_01m1wjq03vhxfgc9khw96grfze` captured $0.0015255, released $4.9984745 of its $5 reservation, and recorded a completed request summary. This verifies the relay and database path, not the deployed Chat browser path.

An earlier successful turn captured $0.0016455. A separate test interrupted by local hot reload had 100ms of pending input and no authoritative usage; its test charge was explicitly waived and the reason recorded in session metadata. It must not be treated as evidence of a genuinely free generation.

## Remaining release gates

- Deploy and verify the patched Chat web service, gateway and browser together with a signed-in pilot user.
- Add a reviewed pilot rule to the `gateway_realtime_voice` Statsig gate. The previously absent gate now exists with no passing rules, so it grants no access. Production targeting must go through the project's review process.
- OpenAI Realtime routes are currently disabled in the production catalogue. Import the new 2.1/2.1 Mini price cards and run full relay canaries before selecting routes for the pilot. The deprecated older Mini remains disabled.
- xAI's catalogue identity is aligned in this patch, but a full relay and billing canary is still required before enabling its route. A successful upstream setup alone does not validate Phaseo billing.
- Run interruption, insufficient-credit and multi-turn provider canaries, including cached input and delayed usage. Verify every selectable voice against the selected model.
- Investigate historical session `rt_01kwykz81wpycgne47rt6bw6ka`: $5 remains held with missing authoritative usage. Do not infer a charge or release from absent request logs. The other 28 historical terminal sessions had balanced reservation totals.

## Provider contracts consulted

- [OpenAI Realtime session contract](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/accept): GA nested audio settings, 24kHz PCM, audio output with transcript, voice selection and model-specific reasoning options.
- [Google Live capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities): PCM input, speech voice configuration, usage metadata, VAD and model-specific thinking options. Gemini 3.1 does not support proactive audio or affective dialogue.
- [xAI speech-to-speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech): session updates, voice selection, PCM audio and server VAD. Provider tools and custom voice APIs are separate capabilities; Chat currently exposes voice and instructions.

Realtime transcription-only, translation-only, music and avatar models are not interchangeable with conversational voice sessions and should not enter this model picker merely because their names contain “realtime”.
