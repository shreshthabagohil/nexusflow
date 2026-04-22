import faust
import os

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")

app = faust.App(
    "nexusflow",
    broker=f"kafka://{KAFKA_BOOTSTRAP}",
    value_serializer="json",
)

# ── Topic declarations ────────────────────────────────────
weather_topic   = app.topic("weather-events")
port_topic      = app.topic("port-status")
carrier_topic   = app.topic("carrier-delays")
shipment_topic  = app.topic("shipment-updates")
risk_topic      = app.topic("risk-scores")


# ── Consumer agents (stubs — T3 implements logic on Day 3) ─
@app.agent(weather_topic)
async def process_weather(stream):
    async for event in stream:
        pass  # T3: feature engineering goes here


@app.agent(shipment_topic)
async def process_shipment(stream):
    async for event in stream:
        pass  # T3: update Redis state goes here