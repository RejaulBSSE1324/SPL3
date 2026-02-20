"""
BandContourExtractor
--------------------
Responsibilities:
  - Dividing 2D points into equal-width bands
  - Extracting extreme boundary points from each band
  - Combining contour points from multiple directions (6 directions, paper spec)
  - Ensuring complete boundary coverage
Collaborators: ContourOptimizer, InputDataProcessor
"""

import numpy as np


class BandContourExtractor:
    def __init__(self, points2D: np.ndarray, averageSpacing: float):
        self.points2D = points2D
        self.averageSpacing = averageSpacing
        self.bandWidth = 8 * averageSpacing          # W = 8d  (paper spec)
        self.directions = [0, 30, 60, 90, 120, 150]  # N₀ = 6 directions
        self.contourPoints = None                    # merged result

    def createDirectionalBands(self, angle: float) -> list:
        """
        Rotate the 2D point set by `angle` degrees and create band slices
        along the rotated X-axis.
        Returns a list of (band_mask, rotated_pts) tuples.
        """
        angle_rad = np.deg2rad(angle)
        cos_a, sin_a = np.cos(angle_rad), np.sin(angle_rad)
        R = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
        rotated = self.points2D @ R.T

        min_x = rotated[:, 0].min()
        max_x = rotated[:, 0].max()
        edges = np.arange(min_x, max_x + self.bandWidth, self.bandWidth)

        bands = []
        for i in range(len(edges) - 1):
            mask = (rotated[:, 0] >= edges[i]) & (rotated[:, 0] < edges[i + 1])
            if mask.any():
                bands.append((mask, rotated))
        return bands

    def extractExtremePoints(self, angle: float) -> np.ndarray:
        """
        For each band in direction `angle`, pick the two extreme points
        (min-Y and max-Y in the rotated frame) and return them in original
        (unrotated) coordinates.
        """
        bands = self.createDirectionalBands(angle)
        contour_pts = []
        for mask, rotated in bands:
            band_rot = rotated[mask]
            orig_indices = np.where(mask)[0]
            min_idx = np.argmin(band_rot[:, 1])
            max_idx = np.argmax(band_rot[:, 1])
            contour_pts.append(self.points2D[orig_indices[min_idx]])
            if min_idx != max_idx:
                contour_pts.append(self.points2D[orig_indices[max_idx]])
        return np.array(contour_pts) if contour_pts else np.empty((0, 2))

    def mergeMultiDirectionContours(self) -> np.ndarray:
        """
        Run extractExtremePoints for all 6 directions, stack results, and
        remove duplicates (within 1e-6 tolerance).
        """
        all_pts = []
        for angle in self.directions:
            pts = self.extractExtremePoints(angle)
            if len(pts) > 0:
                all_pts.append(pts)
        if not all_pts:
            self.contourPoints = np.empty((0, 2))
            return self.contourPoints
        merged = np.vstack(all_pts)
        unique = np.unique(np.round(merged, decimals=6), axis=0)
        self.contourPoints = unique
        return unique

    def removeInternalPoints(self, points: np.ndarray) -> np.ndarray:
        """
        The banding approach inherently avoids internal points.
        Exposed as a method for completeness and future extension.
        """
        return points