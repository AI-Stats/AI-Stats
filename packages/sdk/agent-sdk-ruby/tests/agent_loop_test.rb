require "minitest/autorun"
require "tmpdir"
require_relative "../lib/phaseo_agent_sdk"

class FakeClient
  def initialize
    @calls = 0
  end

  def generate(_request)
    @calls += 1
    if @calls == 1
      PhaseoAgentSdk::ModelResponse.new(
        message: PhaseoAgentSdk::Message.new(
          role: "assistant",
          content: "",
          tool_calls: [
            PhaseoAgentSdk::ToolCall.new(id: "call_1", name: "lookup", input: { "slug" => "presets" })
          ]
        )
      )
    else
      PhaseoAgentSdk::ModelResponse.new(
        message: PhaseoAgentSdk::Message.new(
          role: "assistant",
          content: "Presets let you define stable routing defaults."
        )
      )
    end
  end
end

class AgentLoopTest < Minitest::Test
  def test_agent_executes_tool_loop
    agent = PhaseoAgentSdk.create_agent(
      id: "support-agent",
      instructions: "Use tools when helpful.",
      tools: [
        PhaseoAgentSdk.define_tool(
          PhaseoAgentSdk::Tool.new(
            id: "lookup",
            description: "Lookup docs",
            parameters: { type: "object" },
            execute: lambda { |input, _ctx| { slug: input["slug"], ok: true } }
          )
        )
      ]
    )

    result = agent.run(
      input: "Explain presets",
      client: FakeClient.new
    )

    assert_equal "Presets let you define stable routing defaults.", result.output
    assert_equal 2, result.steps.length
    assert_equal "tool", result.messages[-2].role
  end

  def test_retry_human_review_continuation_events_and_devtools
    client = Class.new do
      attr_reader :calls
      def initialize = @calls = 0
      def generate(_request)
        @calls += 1
        raise "temporary gateway failure" if @calls == 1
        PhaseoAgentSdk::ModelResponse.new(message: PhaseoAgentSdk::Message.new(role: "assistant", content: "Deploy the change"))
      end
    end.new
    events = []
    agent = PhaseoAgentSdk.create_agent(
      id: "review-agent",
      model_retry: { max_retries: 1, backoff_ms: 0 },
      human_review: lambda do |context|
        next nil if context.messages.any? { |message| message.role == "user" && message.content == "approved" }
        PhaseoAgentSdk::HumanReviewRequest.new(reason: "Approve deployment", payload: context.response.message.content)
      end
    )
    Dir.mktmpdir do |directory|
      devtools = PhaseoAgentSdk.create_agent_devtools(directory: directory)
      paused = agent.run(input: "Prepare deployment", client: client, on_event: events.method(:<<), devtools: devtools)
      assert_equal "waiting_for_human", paused.run.status
      assert_equal 2, paused.steps.first.model_attempts
      resumed = agent.continue_run(run: paused, client: client, human_input: "approved", on_event: events.method(:<<), devtools: devtools)
      assert_equal "completed", resumed.run.status
      assert_equal "Deploy the change", resumed.output
      assert_equal 2, File.readlines(File.join(directory, "generations.jsonl")).length
    end
    assert_includes events.map { |event| event[:type] }, "run.resumed"
  end

  def test_advanced_parity_uses_exact_call_decisions
    turns=0;executed=[];events=[]
    client=Class.new do
      define_method(:generate) do |_request|
        turns+=1
        if turns==1
          PhaseoAgentSdk::ModelResponse.new(message:PhaseoAgentSdk::Message.new(role:"assistant",content:"",tool_calls:[
            PhaseoAgentSdk::ToolCall.new(id:"auto",name:"progress",input:{value:2}),PhaseoAgentSdk::ToolCall.new(id:"gate",name:"gated",input:{}),
            PhaseoAgentSdk::ToolCall.new(id:"manual",name:"manual",input:{}),PhaseoAgentSdk::ToolCall.new(id:"failure",name:"failure",input:{})]),usage:{"input_tokens"=>2,"output_tokens"=>1},cost:1)
        else PhaseoAgentSdk::ModelResponse.new(message:PhaseoAgentSdk::Message.new(role:"assistant",content:"done"),cost:1);end
      end
    end.new
    agent=PhaseoAgentSdk.create_agent(id:"parity",stop_when:[->(state){"max_cost:2" if state[:usage][:cost]>=2}],tools:[
      PhaseoAgentSdk::Tool.new(id:"progress",input_schema:->(v){v},output_schema:->(v){v},execute:->(_input,runtime){runtime.emit_progress.call(percent:50);executed<<"auto";{result:4}}),
      PhaseoAgentSdk::Tool.new(id:"gated",require_approval:true,execute:->(*){executed<<"gate";"approved"}),
      PhaseoAgentSdk::Tool.new(id:"manual"),PhaseoAgentSdk::Tool.new(id:"failure",on_error:"return-to-model",execute:->(*){raise "expected"})])
    paused=agent.run(input:"run",client:client,on_event:events.method(:<<));assert_equal ["gate","manual"],paused.run.pause.pending_tool_calls.map{|item|item.call.id};assert_equal ["auto"],executed
    result=agent.continue_run(run:paused,client:client,on_event:events.method(:<<),approvals:[PhaseoAgentSdk::ToolDecision.new(tool_call_id:"gate")],tool_outputs:[PhaseoAgentSdk::ToolOutput.new(tool_call_id:"manual",output:"external")])
    assert_equal "stopped",result.run.status;assert_equal 2.0,result.usage[:cost];assert_equal ["auto","gate"],executed;assert_includes events.map{|event|event[:type]},"tool.preliminary_result"
  end

  def test_stream_is_replayable_and_state_is_application_owned
    client=Class.new do
      def generate(_request)=PhaseoAgentSdk::ModelResponse.new(message:PhaseoAgentSdk::Message.new(role:"assistant",content:"fallback"))
      def stream(_request)=[{type:"response.output_text.delta",delta:"hel"},{type:"response.output_text.delta",delta:"lo"},{type:"response.completed",response:PhaseoAgentSdk::ModelResponse.new(message:PhaseoAgentSdk::Message.new(role:"assistant",content:"hello"))}]
    end.new
    state=Class.new{attr_reader :value;def save(value)=@value=value;def load(_id)=@value}.new
    stream=PhaseoAgentSdk.create_agent(id:"stream").stream(input:"run",client:client,state:state)
    assert_equal "hello",stream.text_stream.to_a.join;assert_equal "hello",stream.text_stream.to_a.join;assert_equal "hello",stream.result.output;refute_nil state.value
  end
end

class LiveGatewayTest < Minitest::Test
  def test_streams_luna_when_enabled
    skip "live Agent SDK smoke is opt-in" unless ENV["PHASEO_AGENT_LIVE_SMOKE"]=="true"&&ENV["PHASEO_API_KEY"]
    client=PhaseoAgentSdk.create_gateway_agent_client(model:"openai/gpt-5.6-luna",include_meta:true);events=client.stream(PhaseoAgentSdk::ModelRequest.new(agent_id:"live-smoke",messages:[PhaseoAgentSdk::Message.new(role:"user",content:"Reply with exactly: luna-ok")],tools:[])).to_a
    assert events.any?{|event|event[:type]=="response.output_text.delta"&&!event[:delta].to_s.empty?};assert events.any?{|event|event[:type]=="response.completed"&&event[:response]}
  end
end
