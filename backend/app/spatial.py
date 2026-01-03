import s2sphere
from typing import List, Dict
from app.schemas import RestrictedZone, AircraftState

class SpatialIndex:
    def __init__(self, level=10):
        self.level = level
        self.cell_to_zones: Dict[str, List[RestrictedZone]] = {}

    def index_zone(self, zone: RestrictedZone):
        """
        Approximation: Add zone to cells that intersect its bounding box.
        For MVP, we just find the cell of the polygon vertices and maybe centroid.
        A proper coverer is complex without full library support, so we will use a simpler Bounding Box Grid Key approach which is essentially what S2 cells are.
        """
        # Simple cover: Get cells for vertices
        # Optimized for MVP: Use S2 cell for vertices
        affected_cells = set()
        for lat, lng in zone.polygon:
            cell_id = s2sphere.CellId.from_lat_lng(s2sphere.LatLng.from_degrees(lat, lng)).parent(self.level)
            affected_cells.add(cell_id.to_token())
        
        # Also add centroid just in case
        if zone.polygon:
            avg_lat = sum(p[0] for p in zone.polygon) / len(zone.polygon)
            avg_lng = sum(p[1] for p in zone.polygon) / len(zone.polygon)
            cell_id = s2sphere.CellId.from_lat_lng(s2sphere.LatLng.from_degrees(avg_lat, avg_lng)).parent(self.level)
            affected_cells.add(cell_id.to_token())

        for token in affected_cells:
            if token not in self.cell_to_zones:
                self.cell_to_zones[token] = []
            self.cell_to_zones[token].append(zone)

    def query(self, lat: float, lng: float) -> List[RestrictedZone]:
        cell_id = s2sphere.CellId.from_lat_lng(s2sphere.LatLng.from_degrees(lat, lng)).parent(self.level)
        return self.cell_to_zones.get(cell_id.to_token(), [])

def point_in_polygon(x, y, poly):
    """
    Ray casting algorithm.
    poly: List of (lat, lng) -> (y, x)
    """
    n = len(poly)
    inside = False
    p1x, p1y = poly[0][1], poly[0][0] # lng, lat
    for i in range(n + 1):
        p2x, p2y = poly[i % n][1], poly[i % n][0]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside
