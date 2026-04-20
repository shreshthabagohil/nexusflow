import json
import logging
import os
from typing import Optional

import redis

logger = logging.getLogger(__name__)

_SHIPMENT_PREFIX = "shipment:"
_SCORE_PREFIX = "score:"
_SCORE_TTL = 300  # seconds


class RedisClient:
    def __init__(self) -> None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self._client = redis.from_url(url, decode_responses=True)

    def set_shipment(self, id: str, data_dict: dict) -> None:
        self._client.set(f"{_SHIPMENT_PREFIX}{id}", json.dumps(data_dict))

    def get_shipment(self, id: str) -> Optional[dict]:
        raw = self._client.get(f"{_SHIPMENT_PREFIX}{id}")
        if raw is None:
            return None
        return json.loads(raw)

    def set_risk_score(self, id: str, score: int) -> None:
        self._client.setex(f"{_SCORE_PREFIX}{id}", _SCORE_TTL, score)

    def get_risk_score(self, id: str) -> int:
        raw = self._client.get(f"{_SCORE_PREFIX}{id}")
        if raw is None:
            return 0
        return int(raw)

    def get_all_shipment_ids(self) -> list[str]:
        keys = self._client.keys(f"{_SHIPMENT_PREFIX}*")
        return [k.removeprefix(_SHIPMENT_PREFIX) for k in keys]

    def ping(self) -> bool:
        try:
            return self._client.ping()
        except redis.RedisError as exc:
            logger.error("Redis ping failed: %s", exc)
            return False
