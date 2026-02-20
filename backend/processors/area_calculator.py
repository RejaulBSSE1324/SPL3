"""
AreaCalculator
--------------
Responsibilities:
  - Calculate area of extracted roof contours using the Shoelace formula
Collaborators: ContourOptimizer, ResultHandler
"""

import numpy as np


class AreaCalculator:
    def __init__(self, contourPoints: np.ndarray):
        self.contourPoints = contourPoints
        self.computedArea = 0.0

    def calculateArea(self) -> float:
        """Shoelace (Gauss) formula for polygon area."""
        pts = self.contourPoints
        if pts is None or len(pts) < 3:
            self.computedArea = 0.0
            return 0.0
        x = pts[:, 0]
        y = pts[:, 1]
        self.computedArea = float(
            0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
        )
        return self.computedArea

    def getArea(self) -> float:
        """Return computed area, calculating it first if not yet done."""
        if self.computedArea == 0.0:
            self.calculateArea()
        return self.computedArea