"""Test configuration.

`load_config()` fails fast on missing configuration, so the environment is set
at import time. The URLs are unreachable on purpose: the test below stubs the
identity provider in-process, because a test that needs a shared stub running is
a test that gets skipped.
"""

from __future__ import annotations

import os

os.environ.setdefault("INSIGHTS_TENANT_ID", "todo-your-tenant")
os.environ.setdefault("INSIGHTS_TIER", "standard")
os.environ.setdefault("INSIGHTS_IDP_URL", "http://idp.invalid")
os.environ.setdefault("INSIGHTS_WAREHOUSE_URL", "http://warehouse.invalid")
os.environ.setdefault("INSIGHTS_AUDIT_URL", "http://audit.invalid")
