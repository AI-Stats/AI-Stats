from email.message import Message
from io import BytesIO
from unittest.mock import patch

import pytest

from gen.client import Client
from gen.operations import retrieveBatchResults


@pytest.mark.parametrize("jsonl", ["", '{"custom_id":"one"}\n', '{"custom_id":"one"}\n{"custom_id":"two"}\n'])
def test_download_preserves_jsonl(jsonl):
    response = BytesIO(jsonl.encode())
    response.headers = Message()
    response.headers["Content-Type"] = "application/x-ndjson; charset=utf-8"
    with patch("urllib.request.urlopen", return_value=response) as fetch:
        client = Client("https://example.test/v1", {"Authorization": "Bearer test-key"})
        assert retrieveBatchResults(client, path={"batch_id": "batch_123"}) == jsonl
        request = fetch.call_args.args[0]
        assert request.full_url == "https://example.test/v1/batches/batch_123/results"
        assert request.get_header("Authorization") == "Bearer test-key"
