using PhaseoAgentSdk;
using Xunit;

namespace Phaseo.AgentSdk.Tests;

public class AgentLoopTests
{
    [Fact]
    public async Task AgentExecutesToolCallsAndReturnsFinalOutput()
    {
        var tool = global::PhaseoAgentSdk.AgentSdk.DefineTool(new Tool(
            Id: "get_weather",
            Description: "Look up weather by city",
            Parameters: new Dictionary<string, object?>
            {
                ["type"] = "object",
                ["properties"] = new Dictionary<string, object?>
                {
                    ["city"] = new Dictionary<string, object?> { ["type"] = "string" },
                },
                ["required"] = new[] { "city" },
            },
            Execute: (input, context) =>
            {
                var args = Assert.IsType<Dictionary<string, object?>>(input);
                Assert.Equal("London", args["city"]?.ToString());
                Assert.Equal(0, context.StepIndex);
                return Task.FromResult<object?>(new Dictionary<string, object?>
                {
                    ["city"] = "London",
                    ["weather"] = "Sunny",
                });
            }
        ));

        var agent = global::PhaseoAgentSdk.AgentSdk.CreateAgent(new AgentDefinition
        {
            Id = "weather-agent",
            Model = "openai/gpt-5.4-nano",
            Instructions = "Use tools when helpful.",
            Tools = new[] { tool },
        });

        var result = await agent.Run(new RunOptions
        {
            Input = "What is the weather in London?",
            Client = new FakeModelClient(),
        });

        Assert.Equal("completed", result.Run.Status);
        Assert.Equal(2, result.Run.StepCount);
        Assert.Equal("Weather for London: Sunny.", Assert.IsType<string>(result.Output));
        Assert.Equal("req_tool", result.Steps[0].RequestId);
        Assert.Equal("req_final", result.Steps[1].RequestId);
        Assert.Equal(5, result.Messages.Count);
    }

    [Fact]
    public async Task AgentRetriesPausesResumesEmitsEventsAndCapturesDevtools()
    {
        var events = new List<AgentEvent>();
        var client = new ReviewModelClient();
        var agent = global::PhaseoAgentSdk.AgentSdk.CreateAgent(new AgentDefinition
        {
            Id = "review-agent",
            ModelRetry = new ModelRetryConfig(MaxRetries: 1, Backoff: TimeSpan.Zero),
            HumanReview = context => Task.FromResult<HumanReviewRequest?>(
                context.Messages.Any(message => message.Role == "user" && message.Content == "approved")
                    ? null
                    : new HumanReviewRequest("Approve deployment", context.Response.Message.Content)
            ),
        });
        var directory = Path.Combine(Path.GetTempPath(), "phaseo-agent-" + Guid.NewGuid().ToString("N"));
        var devtools = global::PhaseoAgentSdk.AgentSdk.CreateAgentDevtools(directory);
        var paused = await agent.Run(new RunOptions
        {
            Input = "Prepare deployment", Client = client, OnEvent = events.Add, Devtools = devtools,
        });
        Assert.Equal("waiting_for_human", paused.Run.Status);
        Assert.Equal(2, paused.Steps[0].ModelAttempts);
        var resumed = await agent.ContinueRun(new ContinueOptions
        {
            Run = paused, Client = client, HumanInput = "approved", OnEvent = events.Add, Devtools = devtools,
        });
        Assert.Equal("completed", resumed.Run.Status);
        Assert.Equal("Deploy the change", resumed.Output);
        Assert.Equal(2, File.ReadAllLines(Path.Combine(directory, "generations.jsonl")).Length);
        Assert.Contains(events, entry => entry.Type == "run.resumed");
    }

    [Fact]
    public async Task AdvancedParityContractUsesExactToolCallDecisions()
    {
        var client = new ParityModelClient();
        var executed = new List<string>();
        var events = new List<AgentEvent>();
        var agent = global::PhaseoAgentSdk.AgentSdk.CreateAgent(new AgentDefinition
        {
            Id = "advanced",
            StopWhen = new Func<StopState, (bool Stop, string Reason)>[] { state => (state.Usage.Cost >= 2, "max_cost:2") },
            Tools = new Tool[]
            {
                new("progress", async (_, runtime) => { await runtime.EmitProgress!(new { percent = 50 }); executed.Add("auto"); return new { result = 4 }; }) { InputSchema = value => value, OutputSchema = value => value },
                new("gated", (_, _) => { executed.Add("gate"); return Task.FromResult<object?>("approved"); }) { RequireApproval = true },
                new("manual"),
                new("failure", (_, _) => throw new InvalidOperationException("expected")) { OnError = "return-to-model" },
            },
        });

        var paused = await agent.Run(new RunOptions { Input = "run", Client = client, OnEvent = events.Add });
        Assert.Equal(new[] { "gate", "manual" }, paused.Run.Pause!.PendingToolCalls!.Select(item => item.Call.Id));
        Assert.Equal(new[] { "auto" }, executed);
        var result = await agent.ContinueRun(new ContinueOptions
        {
            Run = paused, Client = client,
            Approvals = new[] { new ToolDecision("gate") },
            ToolOutputs = new[] { new ToolOutput("manual", "external") },
        });
        Assert.Equal("stopped", result.Run.Status);
        Assert.Equal(2, result.Usage.Cost);
        Assert.Equal(new[] { "auto", "gate" }, executed);
        Assert.Contains(events, item => item.Type == "tool.preliminary_result");
    }

    [Fact]
    public async Task StreamIsReplayableAndStateIsApplicationOwned()
    {
        var state = new MemoryState();
        var stream = global::PhaseoAgentSdk.AgentSdk.CreateAgent(new AgentDefinition { Id = "stream" }).Stream(new RunOptions { Input = "run", Client = new StreamingClient(), State = state });
        static async Task<string> Read(IAsyncEnumerable<string> values) { var text = ""; await foreach (var value in values) text += value; return text; }
        var first = await Read(stream.TextStream()); var result = await stream.GetResult(); var second = await Read(stream.TextStream());
        Assert.Equal("hello", first); Assert.Equal("hello", second); Assert.Equal("hello", result.Output); Assert.NotNull(state.Value);
    }

    private sealed class StreamingClient : IStreamingModelClient
    {
        public Task<ModelResponse> Generate(ModelRequest request) => Task.FromResult(new ModelResponse(new Message("assistant", "fallback")));
        public async IAsyncEnumerable<ModelStreamEvent> Stream(ModelRequest request) { yield return new("response.output_text.delta", "hel"); yield return new("response.output_text.delta", "lo"); yield return new("response.completed", Response: new ModelResponse(new Message("assistant", "hello"))); await Task.CompletedTask; }
    }
    private sealed class MemoryState : IStateAccessor
    {
        public RunResult? Value { get; private set; }
        public Task<RunResult?> Load(string runId, CancellationToken cancellationToken = default) => Task.FromResult(Value);
        public Task Save(RunResult result, CancellationToken cancellationToken = default) { Value = result; return Task.CompletedTask; }
    }

    private sealed class ParityModelClient : IModelClient
    {
        private int _turn;
        public Task<ModelResponse> Generate(ModelRequest request)
        {
            if (_turn++ == 0) return Task.FromResult(new ModelResponse(
                new Message("assistant", "", new[]
                {
                    new ToolCall("auto", "progress", new { value = 2 }), new ToolCall("gate", "gated", new { }),
                    new ToolCall("manual", "manual", new { }), new ToolCall("failure", "failure", new { }),
                }), Usage: new() { ["input_tokens"] = 2, ["output_tokens"] = 1 }, Cost: 1));
            return Task.FromResult(new ModelResponse(new Message("assistant", "done"), Cost: 1));
        }
    }

    private sealed class ReviewModelClient : IModelClient
    {
        private int _calls;
        public Task<ModelResponse> Generate(ModelRequest request)
        {
            if (Interlocked.Increment(ref _calls) == 1) throw new InvalidOperationException("temporary gateway failure");
            return Task.FromResult(new ModelResponse(new Message("assistant", "Deploy the change")));
        }
    }

    private sealed class FakeModelClient : IModelClient
    {
        private int _turn;

        public Task<ModelResponse> Generate(ModelRequest request)
        {
            if (_turn++ == 0)
            {
                return Task.FromResult(new ModelResponse(
                    Message: new Message(
                        Role: "assistant",
                        Content: string.Empty,
                        ToolCalls: new[]
                        {
                            new ToolCall("call_weather", "get_weather", new Dictionary<string, object?>
                            {
                                ["city"] = "London",
                            }),
                        }
                    ),
                    RequestId: "req_tool"
                ));
            }

            return Task.FromResult(new ModelResponse(
                Message: new Message("assistant", "Weather for London: Sunny."),
                RequestId: "req_final"
            ));
        }
    }
}

public class LiveGatewayTests
{
	[Fact]
	public async Task StreamsLunaWhenEnabled()
	{
		if(Environment.GetEnvironmentVariable("PHASEO_AGENT_LIVE_SMOKE")!="true"||string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PHASEO_API_KEY"))) return;
		var client=global::PhaseoAgentSdk.AgentSdk.CreateGatewayAgentClient(new GatewayAgentClientOptions{Model="openai/gpt-5.6-luna",IncludeMeta=true});var sawDelta=false;var sawCompleted=false;
		await foreach(var item in client.Stream(new ModelRequest("live-smoke",new[]{new Message("user","Reply with exactly: luna-ok")},Array.Empty<Tool>()))) { if(item.Type=="response.output_text.delta"&&!string.IsNullOrEmpty(item.Delta))sawDelta=true;if(item.Type=="response.completed"&&item.Response is not null)sawCompleted=true; }
		Assert.True(sawDelta);Assert.True(sawCompleted);
	}
}
