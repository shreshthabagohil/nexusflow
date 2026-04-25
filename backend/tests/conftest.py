"""
pytest configuration for NexusFlow backend tests.

Sets asyncio_mode to "auto" so all async test functions run without
needing @pytest.mark.asyncio on every one.
"""

import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
