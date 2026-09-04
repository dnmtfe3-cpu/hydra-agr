import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[2] / "api" / "hydra-assistant.py"
spec = importlib.util.spec_from_file_location("hydra_assistant", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class ExtractTextTests(unittest.TestCase):
    def test_prefers_output_text(self):
        self.assertEqual(module._extract_text({"output_text": "  resposta direta  "}), "resposta direta")

    def test_collects_nested_text(self):
        data = {
            "output": [
                {"content": [{"text": "primeira"}, {"text": "segunda"}]},
                {"content": [{"text": "terceira"}]},
            ]
        }
        self.assertEqual(module._extract_text(data), "primeira\nsegunda\nterceira")

    def test_returns_empty_when_response_has_no_text(self):
        self.assertEqual(module._extract_text({"output": [{"content": [{}]}]}), "")


if __name__ == "__main__":
    unittest.main()
