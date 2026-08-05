package phaseoagent

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type fakeClient struct {
	calls int
}

type reviewClient struct{ calls int }

func (f *reviewClient) Generate(_ context.Context, _ ModelRequest) (ModelResponse, error) {
	f.calls++
	if f.calls == 1 {
		return ModelResponse{}, errors.New("temporary gateway failure")
	}
	return ModelResponse{Message: Message{Role: "assistant", Content: "Deploy the change"}}, nil
}

func TestAgentRetriesPausesResumesAndCapturesDevtools(t *testing.T) {
	events := make([]AgentEvent, 0)
	agent := CreateAgent(AgentDefinition{
		ID:         "review-agent",
		ModelRetry: ModelRetryConfig{MaxRetries: 1},
		HumanReview: func(ctx HumanReviewContext) *HumanReviewRequest {
			for _, message := range ctx.Messages {
				if message.Role == "user" && message.Content == "approved" {
					return nil
				}
			}
			return &HumanReviewRequest{Reason: "Approve deployment", Payload: ctx.Response.Message.Content}
		},
	})
	client := &reviewClient{}
	directory := t.TempDir()
	paused, err := agent.Run(context.Background(), RunOptions{Input: "Prepare deployment", Client: client, OnEvent: func(event AgentEvent) { events = append(events, event) }, Devtools: CreateAgentDevtools(directory)})
	if err != nil {
		t.Fatal(err)
	}
	if paused.Run.Status != "waiting_for_human" || paused.Run.Pause == nil {
		t.Fatalf("expected human pause, got %#v", paused.Run)
	}
	if paused.Steps[0].ModelAttempts != 2 {
		t.Fatalf("expected retry, got %d attempts", paused.Steps[0].ModelAttempts)
	}
	resumed, err := agent.Continue(context.Background(), ContinueOptions{Run: paused, Client: client, HumanInput: "approved", OnEvent: func(event AgentEvent) { events = append(events, event) }, Devtools: CreateAgentDevtools(directory)})
	if err != nil {
		t.Fatal(err)
	}
	if resumed.Run.Status != "completed" || resumed.Output != "Deploy the change" {
		t.Fatalf("unexpected resumed result: %#v", resumed)
	}
	data, err := os.ReadFile(filepath.Join(directory, "generations.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(data), "\n") != 2 {
		t.Fatalf("expected two devtools entries: %s", data)
	}
}

func (f *fakeClient) Generate(_ context.Context, _ ModelRequest) (ModelResponse, error) {
	f.calls++
	if f.calls == 1 {
		return ModelResponse{
			Message: Message{
				Role:    "assistant",
				Content: "",
				ToolCalls: []ToolCall{
					{ID: "call_1", Name: "lookup", Input: map[string]any{"slug": "presets"}},
				},
			},
		}, nil
	}
	return ModelResponse{
		Message: Message{
			Role:    "assistant",
			Content: "Presets let you define stable routing defaults.",
		},
	}, nil
}

func TestAgentExecutesToolLoop(t *testing.T) {
	agent := CreateAgent(AgentDefinition{
		ID:           "support-agent",
		Instructions: "Use tools when helpful.",
		Tools: []Tool{
			DefineTool(Tool{
				ID:          "lookup",
				Description: "Lookup docs",
				Parameters:  map[string]any{"type": "object"},
				Execute: func(input any, _ RuntimeContext) (any, error) {
					payload := input.(map[string]any)
					return map[string]any{"slug": payload["slug"], "ok": true}, nil
				},
			}),
		},
	})

	result, err := agent.Run(context.Background(), RunOptions{
		Input:  "Explain presets",
		Client: &fakeClient{},
	})
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}
	if result.Output != "Presets let you define stable routing defaults." {
		t.Fatalf("unexpected output: %#v", result.Output)
	}
	if len(result.Steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(result.Steps))
	}
	if got := result.Messages[len(result.Messages)-2].Role; got != "tool" {
		t.Fatalf("expected penultimate message to be tool, got %q", got)
	}
}

type parityClient struct{ turns int }

func (p *parityClient) Generate(_ context.Context, _ ModelRequest) (ModelResponse, error) {
	p.turns++
	if p.turns == 1 {
		return ModelResponse{Message: Message{Role: "assistant", ToolCalls: []ToolCall{{ID: "auto", Name: "progress", Input: map[string]any{"value": 2}}, {ID: "gate", Name: "gated", Input: map[string]any{}}, {ID: "manual", Name: "manual", Input: map[string]any{}}, {ID: "failure", Name: "failure", Input: map[string]any{}}}}, Usage: map[string]any{"input_tokens": 2, "output_tokens": 1}, Cost: 1}, nil
	}
	return ModelResponse{Message: Message{Role: "assistant", Content: "done"}, Cost: 1}, nil
}

func TestAdvancedParityContract(t *testing.T) {
	client := &parityClient{}
	executed := []string{}
	events := []AgentEvent{}
	agent := CreateAgent(AgentDefinition{ID: "advanced", StopWhen: []StopCondition{MaxCost(2)}, Tools: []Tool{
		{ID: "progress", InputSchema: func(value any) (any, error) { return value, nil }, OutputSchema: func(value any) (any, error) { return value, nil }, Execute: func(input any, runtime RuntimeContext) (any, error) {
			_ = runtime.EmitProgress(map[string]any{"percent": 50})
			executed = append(executed, "auto")
			return map[string]any{"result": 4}, nil
		}},
		{ID: "gated", RequireApproval: true, Execute: func(any, RuntimeContext) (any, error) { executed = append(executed, "gate"); return "approved", nil }},
		{ID: "manual"},
		{ID: "failure", OnError: "return-to-model", Execute: func(any, RuntimeContext) (any, error) { return nil, errors.New("expected") }},
	}})
	paused, err := agent.Run(context.Background(), RunOptions{Input: "run", Client: client, OnEvent: func(event AgentEvent) { events = append(events, event) }})
	if err != nil {
		t.Fatal(err)
	}
	if got := len(paused.Run.Pause.PendingToolCalls); got != 2 {
		t.Fatalf("pending calls = %d", got)
	}
	result, err := agent.Continue(context.Background(), ContinueOptions{Run: paused, Client: client, Approvals: []ToolDecision{{ToolCallID: "gate"}}, ToolOutputs: []ToolOutput{{ToolCallID: "manual", Output: "external"}}})
	if err != nil {
		t.Fatal(err)
	}
	if result.Run.Status != "stopped" || result.Usage.Cost != 2 {
		t.Fatalf("result = %#v", result)
	}
	if len(executed) != 2 {
		t.Fatalf("executed = %#v", executed)
	}
	foundProgress := false
	for _, event := range events {
		if event.Type == "tool.preliminary_result" {
			foundProgress = true
		}
	}
	if !foundProgress {
		t.Fatal("missing progress event")
	}
}

type streamingClient struct{}

func (streamingClient) Generate(context.Context, ModelRequest) (ModelResponse, error) {
	return ModelResponse{Message: Message{Role: "assistant", Content: "fallback"}}, nil
}
func (streamingClient) Stream(_ context.Context, _ ModelRequest) <-chan ModelStreamEvent {
	events := make(chan ModelStreamEvent, 3)
	events <- ModelStreamEvent{Type: "response.output_text.delta", Delta: "hel"}
	events <- ModelStreamEvent{Type: "response.output_text.delta", Delta: "lo"}
	response := ModelResponse{Message: Message{Role: "assistant", Content: "hello"}}
	events <- ModelStreamEvent{Type: "response.completed", Response: &response}
	close(events)
	return events
}

type memoryState struct{ value *RunResult }

func (m *memoryState) Load(_ context.Context, _ string) (*RunResult, error) { return m.value, nil }
func (m *memoryState) Save(_ context.Context, value RunResult) error        { m.value = &value; return nil }
func TestReplayableStreamAndState(t *testing.T) {
	state := &memoryState{}
	stream := CreateAgent(AgentDefinition{ID: "stream"}).Stream(context.Background(), RunOptions{Input: "run", Client: streamingClient{}, State: state})
	first := ""
	for delta := range stream.Text() {
		first += delta
	}
	result, err := stream.Result()
	if err != nil {
		t.Fatal(err)
	}
	second := ""
	for delta := range stream.Text() {
		second += delta
	}
	if first != "hello" || second != "hello" || result.Output != "hello" || state.value == nil {
		t.Fatalf("stream/state mismatch: %q %q %#v", first, second, result)
	}
}

func TestLiveLunaGatewayStreamWhenEnabled(t *testing.T) {
	if os.Getenv("PHASEO_AGENT_LIVE_SMOKE") != "true" { t.Skip("live Agent SDK smoke is opt-in") }
	if os.Getenv("PHASEO_API_KEY") == "" { t.Skip("PHASEO_API_KEY is unavailable") }
	client,err:=CreateGatewayAgentClient(GatewayAgentClientOptions{Model:"openai/gpt-5.6-luna"});if err!=nil{t.Fatal(err)}
	events:=client.Stream(context.Background(),ModelRequest{AgentID:"live-smoke",Messages:[]Message{{Role:"user",Content:"Reply with exactly: luna-ok"}}});sawDelta,sawCompleted:=false,false
	for event:=range events{if event.Err!=nil{t.Fatal(event.Err)};if event.Type=="response.output_text.delta"&&event.Delta!=""{sawDelta=true};if event.Type=="response.completed"&&event.Response!=nil{sawCompleted=true}}
	if !sawDelta||!sawCompleted{t.Fatalf("incomplete live stream: delta=%v completed=%v",sawDelta,sawCompleted)}
}
