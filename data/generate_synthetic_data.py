"""
generate_synthetic_data.py
Generates realistic synthetic supply chain data for NexusFlow.
Outputs: shipments.json, ports.json, carriers.json, shipping_graph.json
"""

import json
import math
import random
from datetime import date, timedelta

random.seed(42)

DATA_DIR = "data"

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

REAL_PORTS = [
    {"name": "Shanghai",     "lat": 31.2,  "lng": 121.5,  "country": "China"},
    {"name": "Rotterdam",    "lat": 51.9,  "lng": 4.5,    "country": "Netherlands"},
    {"name": "Singapore",    "lat": 1.3,   "lng": 103.8,  "country": "Singapore"},
    {"name": "Los Angeles",  "lat": 33.7,  "lng": -118.3, "country": "United States"},
    {"name": "Dubai (Jebel Ali)", "lat": 25.0,  "lng": 55.1,   "country": "UAE"},
    {"name": "Hamburg",      "lat": 53.5,  "lng": 10.0,   "country": "Germany"},
    {"name": "Busan",        "lat": 35.1,  "lng": 129.0,  "country": "South Korea"},
    {"name": "Hong Kong",    "lat": 22.3,  "lng": 114.2,  "country": "China"},
    {"name": "Antwerp",      "lat": 51.2,  "lng": 4.4,    "country": "Belgium"},
    {"name": "New York",     "lat": 40.7,  "lng": -74.0,  "country": "United States"},
]

CARRIER_NAMES = [
    "Maersk", "MSC", "CMA CGM", "COSCO", "Evergreen",
    "Hapag-Lloyd", "ONE", "Yang Ming", "HMM", "PIL",
]

CARGO_TYPES = [
    "electronics", "pharmaceuticals", "perishables", "automotive",
    "chemicals", "general", "machinery", "textiles",
]

STATUSES = ["in_transit", "delayed", "at_port", "rerouting"]
STATUS_WEIGHTS = [0.80, 0.08, 0.08, 0.04]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def weighted_choice(options, weights):
    r = random.random()
    cumulative = 0.0
    for opt, w in zip(options, weights):
        cumulative += w
        if r < cumulative:
            return opt
    return options[-1]


# ---------------------------------------------------------------------------
# 1. Shipments
# ---------------------------------------------------------------------------

def generate_shipments(n=500):
    port_names = [p["name"] for p in REAL_PORTS]
    start_date = date(2026, 4, 1)
    end_date = date(2026, 4, 15)

    shipments = []
    for i in range(1, n + 1):
        origin = random.choice(port_names)
        destination = random.choice([p for p in port_names if p != origin])
        departure = random_date(start_date, end_date)
        eta = departure + timedelta(days=random.randint(7, 28))

        shipments.append({
            "id": f"S{i:03d}",
            "origin_port": origin,
            "destination_port": destination,
            "carrier": random.choice(CARRIER_NAMES),
            "cargo_type": random.choice(CARGO_TYPES),
            "departure_date": departure.isoformat(),
            "eta": eta.isoformat(),
            "current_lat": round(random.uniform(-60, 70), 4),
            "current_lng": round(random.uniform(-180, 180), 4),
            "status": weighted_choice(STATUSES, STATUS_WEIGHTS),
            "risk_score": 0.0,
            "route_segment_id": f"route_{random.randint(100, 999)}",
        })

    print(f"Generated {n} shipments")
    return shipments


# ---------------------------------------------------------------------------
# 2. Ports
# ---------------------------------------------------------------------------

# Fictional port seed data: (name, lat, lng, country)
FICTIONAL_PORT_SEEDS = [
    ("Karachi", 24.8, 67.0, "Pakistan"),
    ("Mumbai", 19.1, 72.9, "India"),
    ("Colombo", 6.9, 79.8, "Sri Lanka"),
    ("Port Klang", 3.0, 101.4, "Malaysia"),
    ("Tanjung Pelepas", 1.4, 103.6, "Malaysia"),
    ("Guangzhou", 23.1, 113.3, "China"),
    ("Tianjin", 39.0, 117.7, "China"),
    ("Qingdao", 36.1, 120.4, "China"),
    ("Ningbo", 29.9, 121.6, "China"),
    ("Shenzhen", 22.5, 114.1, "China"),
    ("Tokyo", 35.7, 139.7, "Japan"),
    ("Yokohama", 35.4, 139.6, "Japan"),
    ("Nagoya", 35.1, 136.9, "Japan"),
    ("Kaohsiung", 22.6, 120.3, "Taiwan"),
    ("Laem Chabang", 13.1, 100.9, "Thailand"),
    ("Ho Chi Minh City", 10.8, 106.7, "Vietnam"),
    ("Jakarta", -6.2, 106.8, "Indonesia"),
    ("Manila", 14.6, 120.9, "Philippines"),
    ("Chittagong", 22.3, 91.8, "Bangladesh"),
    ("Jeddah", 21.5, 39.2, "Saudi Arabia"),
    ("Oman Sohar", 24.3, 56.6, "Oman"),
    ("Djibouti", 11.6, 43.1, "Djibouti"),
    ("Mombasa", -4.1, 39.7, "Kenya"),
    ("Durban", -29.9, 31.0, "South Africa"),
    ("Cape Town", -33.9, 18.4, "South Africa"),
    ("Lagos", 6.4, 3.4, "Nigeria"),
    ("Dakar", 14.7, -17.4, "Senegal"),
    ("Casablanca", 33.6, -7.6, "Morocco"),
    ("Alexandria", 31.2, 29.9, "Egypt"),
    ("Piraeus", 37.9, 23.7, "Greece"),
    ("Valencia", 39.5, -0.3, "Spain"),
    ("Barcelona", 41.4, 2.2, "Spain"),
    ("Marseille", 43.3, 5.3, "France"),
    ("Genoa", 44.4, 8.9, "Italy"),
    ("Felixstowe", 51.9, 1.3, "United Kingdom"),
    ("Le Havre", 49.5, 0.1, "France"),
    ("Bremerhaven", 53.5, 8.6, "Germany"),
    ("Gothenburg", 57.7, 12.0, "Sweden"),
    ("Santos", -23.9, -46.3, "Brazil"),
    ("Buenos Aires", -34.6, -58.4, "Argentina"),
]


def generate_ports():
    ports = []

    # 10 real ports
    for idx, rp in enumerate(REAL_PORTS):
        ports.append({
            "port_id": f"P{idx + 1:03d}",
            "name": rp["name"],
            "congestion_score": round(random.uniform(0, 10), 2),
            "lat": rp["lat"],
            "lng": rp["lng"],
            "country": rp["country"],
            "port_type": "seaport",
        })

    # 40 fictional ports
    for idx, (name, lat, lng, country) in enumerate(FICTIONAL_PORT_SEEDS):
        ports.append({
            "port_id": f"P{idx + 11:03d}",
            "name": name,
            "congestion_score": round(random.uniform(0, 10), 2),
            "lat": lat,
            "lng": lng,
            "country": country,
            "port_type": "seaport",
        })

    print(f"Generated {len(ports)} ports")
    return ports


# ---------------------------------------------------------------------------
# 3. Carriers
# ---------------------------------------------------------------------------

def generate_carriers():
    carriers = []
    for idx, name in enumerate(CARRIER_NAMES):
        carriers.append({
            "carrier_id": f"C{idx + 1:02d}",
            "name": name,
            "ontime_rate": round(random.uniform(0.55, 0.97), 3),
        })
    print(f"Generated {len(carriers)} carriers")
    return carriers


# ---------------------------------------------------------------------------
# 4. Shipping graph
# ---------------------------------------------------------------------------

# Inland hub seed locations spread across realistic logistics corridors
INLAND_REGIONS = [
    # Central/East Asia
    ("Chongqing Hub", 29.6, 106.6), ("Chengdu Hub", 30.7, 104.1),
    ("Xi'an Hub", 34.3, 108.9), ("Zhengzhou Hub", 34.7, 113.6),
    ("Wuhan Hub", 30.6, 114.3), ("Beijing Hub", 39.9, 116.4),
    ("Harbin Hub", 45.8, 126.5), ("Shenyang Hub", 41.8, 123.4),
    ("Ulaanbaatar Hub", 47.9, 106.9), ("Almaty Hub", 43.3, 76.9),
    ("Tashkent Hub", 41.3, 69.3), ("Bishkek Hub", 42.9, 74.6),
    # South/Southeast Asia
    ("Delhi Hub", 28.6, 77.2), ("Chennai Hub", 13.1, 80.3),
    ("Kolkata Hub", 22.6, 88.4), ("Dhaka Hub", 23.8, 90.4),
    ("Bangkok Hub", 13.8, 100.5), ("Hanoi Hub", 21.0, 105.8),
    ("Kuala Lumpur Hub", 3.1, 101.7), ("Phnom Penh Hub", 11.6, 104.9),
    # Middle East / Central Asia
    ("Tehran Hub", 35.7, 51.4), ("Baghdad Hub", 33.3, 44.4),
    ("Riyadh Hub", 24.7, 46.7), ("Ankara Hub", 39.9, 32.9),
    ("Istanbul Hub", 41.0, 29.0),
    # Europe
    ("Frankfurt Hub", 50.1, 8.7), ("Warsaw Hub", 52.2, 21.0),
    ("Vienna Hub", 48.2, 16.4), ("Milan Hub", 45.5, 9.2),
    ("Madrid Hub", 40.4, -3.7), ("Paris Hub", 48.9, 2.3),
    ("Lyon Hub", 45.7, 4.8), ("Brussels Hub", 50.8, 4.4),
    ("Amsterdam Hub", 52.4, 4.9), ("Zurich Hub", 47.4, 8.5),
    ("Prague Hub", 50.1, 14.4), ("Budapest Hub", 47.5, 19.0),
    ("Bucharest Hub", 44.4, 26.1), ("Sofia Hub", 42.7, 23.3),
    # Africa
    ("Nairobi Hub", -1.3, 36.8), ("Johannesburg Hub", -26.2, 28.0),
    ("Cairo Hub", 30.1, 31.2), ("Addis Ababa Hub", 9.0, 38.7),
    ("Khartoum Hub", 15.6, 32.5), ("Accra Hub", 5.6, -0.2),
    # Americas
    ("Chicago Hub", 41.9, -87.6), ("Dallas Hub", 32.8, -96.8),
    ("Atlanta Hub", 33.7, -84.4), ("Miami Hub", 25.8, -80.2),
    ("Houston Hub", 29.8, -95.4), ("Memphis Hub", 35.1, -90.0),
    ("Los Angeles Hub", 34.0, -118.2), ("Seattle Hub", 47.6, -122.3),
    ("Toronto Hub", 43.7, -79.4), ("Montreal Hub", 45.5, -73.6),
    ("Mexico City Hub", 19.4, -99.1), ("Guadalajara Hub", 20.7, -103.4),
    ("Bogota Hub", 4.7, -74.1), ("Lima Hub", -12.0, -77.0),
    ("Santiago Hub", -33.5, -70.6), ("Sao Paulo Hub", -23.5, -46.6),
    ("Rio Hub", -22.9, -43.2), ("Buenos Aires Hub", -34.6, -58.4),
    # Oceania
    ("Sydney Hub", -33.9, 151.2), ("Melbourne Hub", -37.8, 145.0),
    ("Auckland Hub", -36.9, 174.8),
    # Russia/North Asia
    ("Moscow Hub", 55.8, 37.6), ("St Petersburg Hub", 59.9, 30.3),
    ("Novosibirsk Hub", 55.0, 82.9), ("Vladivostok Hub", 43.1, 131.9),
    ("Yekaterinburg Hub", 56.8, 60.6),
    # North Africa / Southern Europe
    ("Tunis Hub", 36.8, 10.2), ("Algiers Hub", 36.7, 3.1),
    ("Tripoli Hub", 32.9, 13.2), ("Beirut Hub", 33.9, 35.5),
    ("Amman Hub", 31.9, 35.9), ("Muscat Hub", 23.6, 58.6),
    # Extra fillers to reach 150
    ("Karachi Hub", 24.9, 67.1), ("Lahore Hub", 31.5, 74.3),
    ("Kabul Hub", 34.5, 69.2), ("Baku Hub", 40.4, 49.9),
    ("Tbilisi Hub", 41.7, 44.8), ("Yerevan Hub", 40.2, 44.5),
    ("Minsk Hub", 53.9, 27.6), ("Kiev Hub", 50.5, 30.5),
    ("Riga Hub", 56.9, 24.1), ("Vilnius Hub", 54.7, 25.3),
    ("Tallinn Hub", 59.4, 24.7), ("Helsinki Hub", 60.2, 25.0),
    ("Oslo Hub", 59.9, 10.7), ("Stockholm Hub", 59.3, 18.1),
    ("Copenhagen Hub", 55.7, 12.6), ("Dublin Hub", 53.3, -6.3),
    ("Lisbon Hub", 38.7, -9.1), ("Porto Hub", 41.2, -8.6),
    ("Seville Hub", 37.4, -6.0), ("Bilbao Hub", 43.3, -2.9),
    ("Toulouse Hub", 43.6, 1.4), ("Bordeaux Hub", 44.8, -0.6),
    ("Nantes Hub", 47.2, -1.6), ("Lille Hub", 50.6, 3.1),
    ("Cologne Hub", 50.9, 7.0), ("Munich Hub", 48.1, 11.6),
    ("Stuttgart Hub", 48.8, 9.2), ("Nuremberg Hub", 49.5, 11.1),
    ("Dresden Hub", 51.1, 13.7), ("Leipzig Hub", 51.3, 12.4),
    ("Krakow Hub", 50.1, 19.9), ("Lodz Hub", 51.8, 19.5),
    ("Katowice Hub", 50.3, 18.9), ("Wroclaw Hub", 51.1, 17.0),
    ("Bratislava Hub", 48.1, 17.1), ("Ljubljana Hub", 46.1, 14.5),
    ("Zagreb Hub", 45.8, 16.0), ("Sarajevo Hub", 43.9, 18.4),
    ("Belgrade Hub", 44.8, 20.5), ("Skopje Hub", 42.0, 21.4),
    ("Tirana Hub", 41.3, 19.8), ("Athens Hub", 37.9, 23.7),
    ("Thessaloniki Hub", 40.6, 22.9), ("Izmir Hub", 38.4, 27.1),
    ("Antalya Hub", 36.9, 30.7), ("Adana Hub", 37.0, 35.3),
    # Additional hubs to reach 150
    ("Dar es Salaam Hub", -6.8, 39.3), ("Maputo Hub", -25.9, 32.6),
    ("Harare Hub", -17.8, 31.1), ("Lusaka Hub", -15.4, 28.3),
    ("Luanda Hub", -8.8, 13.2), ("Kinshasa Hub", -4.3, 15.3),
    ("Abidjan Hub", 5.3, -4.0), ("Bamako Hub", 12.7, -8.0),
    ("N'Djamena Hub", 12.1, 15.0), ("Douala Hub", 4.0, 9.7),
    ("Brazzaville Hub", -4.3, 15.4), ("Libreville Hub", 0.4, 9.5),
    ("Kampala Hub", 0.3, 32.6), ("Kigali Hub", -1.9, 30.1),
    ("Djibouti Hub", 11.6, 43.2), ("Asmara Hub", 15.3, 38.9),
    ("Addis Hub 2", 9.1, 38.8), ("Antananarivo Hub", -18.9, 47.5),
    ("Winnipeg Hub", 49.9, -97.1), ("Edmonton Hub", 53.5, -113.5),
    ("Calgary Hub", 51.0, -114.1), ("Vancouver Hub", 49.2, -123.1),
    ("Phoenix Hub", 33.4, -112.1), ("Denver Hub", 39.7, -104.9),
    ("Minneapolis Hub", 44.9, -93.2), ("Detroit Hub", 42.3, -83.0),
    ("Pittsburgh Hub", 40.4, -80.0),
]


def generate_graph(ports):
    nodes = []

    # First 50 nodes from ports
    for p in ports:
        nodes.append({
            "id": p["port_id"],
            "name": p["name"],
            "lat": p["lat"],
            "lng": p["lng"],
            "port_type": p["port_type"],
        })

    # 150 inland hub nodes
    needed = 150
    seeds = INLAND_HUBS = INLAND_REGIONS[:needed]
    for idx, (name, lat, lng) in enumerate(seeds):
        nodes.append({
            "id": f"H{idx + 1:03d}",
            "name": name,
            "lat": lat,
            "lng": lng,
            "port_type": "inland_hub",
        })

    total_nodes = len(nodes)  # should be 200

    # Build edge list — target ~400 edges, ensure every node has >= 2 edges
    edges = []
    degree = {n["id"]: 0 for n in nodes}

    def add_edge(src_idx, tgt_idx, mode):
        src, tgt = nodes[src_idx], nodes[tgt_idx]
        dist = max(1.0, haversine_km(src["lat"], src["lng"], tgt["lat"], tgt["lng"]))
        if mode == "sea":
            transit_h = dist / 25
        elif mode == "air":
            transit_h = dist / 800
        else:  # rail
            transit_h = dist / 60
        edges.append({
            "source": src["id"],
            "target": tgt["id"],
            "distance_km": round(dist, 1),
            "transit_hours": round(transit_h, 2),
            "cost_usd": random.randint(500, 50000),
            "mode": mode,
        })
        degree[src["id"]] += 1
        degree[tgt["id"]] += 1

    # Sea edges between seaport nodes (first 50)
    port_indices = list(range(50))
    random.shuffle(port_indices)
    # Connect in a ring first to ensure connectivity
    for i in range(len(port_indices)):
        add_edge(port_indices[i], port_indices[(i + 1) % len(port_indices)], "sea")
    # Add more random sea edges
    for _ in range(150):
        a, b = random.sample(port_indices, 2)
        add_edge(a, b, "sea")

    # Rail/road edges between inland hubs (indices 50-199)
    hub_indices = list(range(50, total_nodes))
    random.shuffle(hub_indices)
    for i in range(len(hub_indices)):
        add_edge(hub_indices[i], hub_indices[(i + 1) % len(hub_indices)], "rail")
    # Extra inland edges
    for _ in range(50):
        a, b = random.sample(hub_indices, 2)
        add_edge(a, b, "rail")

    # Air edges between random node pairs (cross-type)
    all_indices = list(range(total_nodes))
    for _ in range(100):
        a, b = random.sample(all_indices, 2)
        add_edge(a, b, "air")

    # Guarantee every node has at least 2 edges
    for node in nodes:
        while degree[node["id"]] < 2:
            candidates = [n for n in nodes if n["id"] != node["id"]]
            partner = random.choice(candidates)
            ni = next(i for i, n in enumerate(nodes) if n["id"] == node["id"])
            pi = next(i for i, n in enumerate(nodes) if n["id"] == partner["id"])
            mode = random.choice(["sea", "air", "rail"])
            add_edge(ni, pi, mode)

    print(f"Generated graph with {total_nodes} nodes and {len(edges)} edges")
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    shipments = generate_shipments(500)
    ports = generate_ports()
    carriers = generate_carriers()
    graph = generate_graph(ports)

    files = {
        f"{DATA_DIR}/shipments.json": shipments,
        f"{DATA_DIR}/ports.json": ports,
        f"{DATA_DIR}/carriers.json": carriers,
        f"{DATA_DIR}/shipping_graph.json": graph,
    }

    for path, data in files.items():
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    print("All data saved to data/ folder")


if __name__ == "__main__":
    main()
