require "minitest/autorun"
require_relative "../lib/index"

class EndpointsTest < Minitest::Test
  def test_list_endpoints_returns_payload
    client = PhaseoSdk::Phaseo.new(
      api_key: "test",
      enable_deprecation_warnings: false
    )

    calls = []
    client.raw_client.define_singleton_method(:request) do |method:, path:, query: nil, headers: nil, body: nil|
      calls << [method, path, query, headers, body]
      {
        "ok" => true,
        "endpoints" => ["chat/completions", "responses", "files"],
        "sample_models" => ["openai/gpt-5-nano"]
      }
    end

    response = client.list_endpoints

    assert_equal true, response["ok"]
    assert_equal "openai/gpt-5-nano", response["sample_models"][0]
    assert_equal [["GET", "/endpoints", nil, nil, nil]], calls
  end

  def test_generated_path_parameters_use_uri_component_encoding
    client = PhaseoSdk::Phaseo.new(
      api_key: "test",
      enable_deprecation_warnings: false
    )

    captured_path = nil
    client.raw_client.define_singleton_method(:request) do |method:, path:, query: nil, headers: nil, body: nil|
      captured_path = path
      { "ok" => true }
    end

    Phaseo::Gen::Operations.retrieveFile(client.raw_client, path: { "file_id" => "folder name/file+one" })

    assert_equal "/files/folder%20name%2Ffile%2Bone", captured_path
  end
end
