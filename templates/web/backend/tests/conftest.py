"""Test configuration.

The app reads its tenant configuration at import time and fails fast when it is
missing, so the environment has to be set before `app.main` is imported — hence
module scope here rather than a fixture.

None of these URLs are reachable, which is intentional: the tests below exercise
authentication and the health contract, neither of which touches the network. A
test that needs the warehouse should stand up a local fake rather than dial a
shared stub, so the suite stays runnable on a laptop with nothing else running.
"""

from __future__ import annotations

import os

os.environ.setdefault("INSIGHTS_TENANT_ID", "todo-your-tenant")
os.environ.setdefault("INSIGHTS_TIER", "standard")
os.environ.setdefault("INSIGHTS_IDP_URL", "http://idp.invalid")
os.environ.setdefault("INSIGHTS_WAREHOUSE_URL", "http://warehouse.invalid")
os.environ.setdefault("INSIGHTS_AUDIT_URL", "http://audit.invalid")
