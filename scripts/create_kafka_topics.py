import os

from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError

TOPICS = [
    "weather-events",
    "port-status",
    "carrier-delays",
    "shipment-updates",
    "risk-scores",
    "reroute-commands",
]

NUM_PARTITIONS = 3
REPLICATION_FACTOR = 1


def main() -> None:
    bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    admin = KafkaAdminClient(bootstrap_servers=bootstrap_servers)

    new_topics = [
        NewTopic(
            name=name,
            num_partitions=NUM_PARTITIONS,
            replication_factor=REPLICATION_FACTOR,
        )
        for name in TOPICS
    ]

    for topic in new_topics:
        try:
            admin.create_topics([topic])
            print(f"Created topic: {topic.name}")
        except TopicAlreadyExistsError:
            print(f"Topic already exists (skipped): {topic.name}")

    admin.close()


if __name__ == "__main__":
    main()
