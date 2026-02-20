"""
ResultHandler
-------------
Responsibilities:
  - Calculating evaluation metrics (PoLiS, RAE)
  - Exporting analysis results (TXT, JSON, GeoJSON)
Collaborators: AreaCalculator
"""

import json
import numpy as np
from scipy.spatial.distance import cdist
from .area_calculator import AreaCalculator


class ResultHandler:
    def __init__(self):
        self.contourResults = {}
        self.evaluationMetrics = {}
        self.exportFormat = "txt"

    def computeAccuracyMetrics(
        self, contour_a: np.ndarray, contour_b: np.ndarray
    ) -> dict:
        """
        PoLiS (Polygon Similarity, Wang et al. eq. 5) and RAE (eq. 6).
        contour_b is treated as the reference polygon.
        """
        if len(contour_a) < 2 or len(contour_b) < 2:
            return {"polis": None, "rae": None}

        # PoLiS
        D = cdist(contour_a, contour_b)
        p, q = len(contour_a), len(contour_b)
        polis = float(
            D.min(axis=1).sum() / (2 * p) + D.min(axis=0).sum() / (2 * q)
        )

        # RAE – Relative Area Error
        area_a = AreaCalculator(contour_a).getArea()
        area_b = AreaCalculator(contour_b).getArea()
        rae = float(abs(area_a - area_b) / area_b * 100) if area_b > 0 else None

        self.evaluationMetrics = {"polis": polis, "rae": rae}
        return self.evaluationMetrics

    def exportResults(self, contour: np.ndarray, format_type: str = "txt") -> dict:
        """Serialise contour to the requested format string."""
        self.exportFormat = format_type

        if format_type == "txt":
            lines = ["# Building Contour Export", "# X Y"]
            for pt in contour:
                lines.append(f"{pt[0]:.6f} {pt[1]:.6f}")
            return {"data": "\n".join(lines), "filename": "contour.txt"}

        elif format_type == "json":
            return {
                "data": json.dumps({"contour": contour.tolist()}, indent=2),
                "filename": "contour.json",
            }

        elif format_type == "geojson":
            geojson = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [contour.tolist()],
                },
                "properties": {
                    "type": "building_contour",
                    "num_points": len(contour),
                },
            }
            return {
                "data": json.dumps(geojson, indent=2),
                "filename": "contour.geojson",
            }

        return {"error": "Unsupported format"}