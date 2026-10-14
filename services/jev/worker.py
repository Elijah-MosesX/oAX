"""One bounded planning request; upstream browser execution is never constructed."""

import json
import sys

from jev_ultrafast.model import action_space, choose

line = sys.stdin.buffer.readline(65537)
if len(line) > 65536 or not line.endswith(b"\n"):
    raise ValueError("Invalid bounded request")
request = json.loads(line)
if set(request) != {"mode", "page", "goal"} or request["mode"] not in {
    "inspect",
    "predict",
}:
    raise ValueError("Invalid planner request")
page = request["page"]
if request["mode"] == "inspect":
    elements, targets, controls = action_space(page["actions"])
    result = {
        "elements": elements,
        "operations": sorted([*targets, *controls]),
        "executed": False,
    }
else:
    decision = choose(page, request["goal"], [])
    result = {
        key: decision[key]
        for key in ("choice", "operation", "target", "confidence", "latency_ms")
    }
    result.update(executed=False, verified=False)
sys.stdout.write(json.dumps(result, allow_nan=False) + "\n")
