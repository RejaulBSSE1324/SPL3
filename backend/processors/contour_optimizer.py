"""
ContourOptimizer
----------------
Responsibilities:
  - Sorting contour points with angular constraint (β = 240°)
  - Preventing backward connections
  - Densifying long edges by inserting real point-cloud points (T = 10d)
  - Removing elevation-based noise points (parapet walls, antennas, etc.)
  - Closing the contour loop
Collaborators: BandContourExtractor, AreaCalculator, VisualizationManager
"""

import numpy as np
from scipy.spatial import cKDTree


class ContourOptimizer:
    def __init__(
        self,
        unsortedContour: np.ndarray,
        allPoints2D: np.ndarray,
        averageSpacing: float,
        points3D: np.ndarray = None,
    ):
        self.unsortedContour = unsortedContour
        self.sortedContour = None
        self.betaAngle = 240                        # β = 240° (paper spec)
        self.threshold = 10 * averageSpacing        # T = 10d
        self.averageSpacing = averageSpacing
        self.finalContour = None
        self._allPoints2D = allPoints2D
        self._points3D = points3D

    # ------------------------------------------------------------------
    # Step 1 – Sorting
    # ------------------------------------------------------------------

    def sortContourPoints(self) -> np.ndarray:
        """Nearest-neighbour sort with β-angle forward constraint."""
        points = self.unsortedContour
        if len(points) < 2:
            self.sortedContour = points
            return points

        sorted_pts = [points[0]]
        remaining = list(range(1, len(points)))
        last_dir = None

        while remaining:
            current = sorted_pts[-1]
            candidates = points[remaining]
            vectors = candidates - current
            dists = np.linalg.norm(vectors, axis=1)

            if last_dir is not None:
                angles = np.arctan2(vectors[:, 1], vectors[:, 0])
                last_angle = np.arctan2(last_dir[1], last_dir[0])
                diff = np.abs(angles - last_angle)
                diff = np.minimum(diff, 2 * np.pi - diff)
                valid = diff <= np.deg2rad(self.betaAngle)
                valid_dists = np.where(valid, dists, np.inf)
                next_idx = np.argmin(valid_dists) if np.any(valid) else np.argmin(dists)
            else:
                next_idx = np.argmin(dists)

            chosen = remaining[next_idx]
            sorted_pts.append(points[chosen])
            last_dir = points[chosen] - current
            remaining.pop(next_idx)

        self.sortedContour = np.array(sorted_pts)
        return self.sortedContour

    def applyBetaConstraint(self):
        """Alias – constraint is applied inside sortContourPoints."""
        pass

    # ------------------------------------------------------------------
    # Step 2 – Densification
    # ------------------------------------------------------------------

    def identifyLongEdges(self, contour: np.ndarray) -> list:
        """Return list of (index, length) for edges longer than T."""
        long_edges = []
        n = len(contour)
        for i in range(n):
            p1 = contour[i]
            p2 = contour[(i + 1) % n]
            length = float(np.linalg.norm(p2 - p1))
            if length > self.threshold:
                long_edges.append((i, length))
        return long_edges

    def densifyEdges(self, max_iterations: int = 50) -> np.ndarray:
        """
        Iteratively insert real point-cloud points near long-edge midpoints
        until all edges are shorter than T.
        Inserts ACTUAL points from the point cloud, not interpolated ones.
        """
        if self.sortedContour is None or len(self.sortedContour) < 2:
            return self.sortedContour if self.sortedContour is not None else np.empty((0, 2))

        densified = list(self.sortedContour)
        tree = cKDTree(self._allPoints2D)

        for _ in range(max_iterations):
            changed = False
            i = 0
            while i < len(densified):
                p1 = densified[i]
                p2 = densified[(i + 1) % len(densified)]
                if np.linalg.norm(p2 - p1) > self.threshold:
                    mid = (p1 + p2) / 2
                    _, indices = tree.query(mid, k=20)
                    for idx in indices:
                        cand = self._allPoints2D[idx]
                        if not any(np.allclose(cand, cp, atol=1e-6) for cp in densified):
                            densified.insert(i + 1, cand)
                            changed = True
                            break
                    if changed:
                        break
                i += 1
            if not changed:
                break

        return np.array(densified)

    # ------------------------------------------------------------------
    # Step 3 – Noise removal
    # ------------------------------------------------------------------

    def removeNoisePoints(
        self, contour2D: np.ndarray, threshold_factor: float = 5.0
    ) -> np.ndarray:
        """
        Remove contour points whose elevation differs significantly from
        their 5 nearest neighbours (parapet walls, antennas, etc.).
        Requires 3D point cloud data.
        """
        if self._points3D is None or self._points3D.shape[1] < 3:
            return contour2D
        if len(contour2D) < 6:
            return contour2D

        threshold = threshold_factor * self.averageSpacing
        tree = cKDTree(self._points3D[:, :2])
        contour3D = []
        for pt in contour2D:
            _, idx = tree.query(pt, k=1)
            contour3D.append(self._points3D[idx])
        contour3D = np.array(contour3D)

        filtered = []
        for i, pt in enumerate(contour3D):
            dists = [
                (np.linalg.norm(pt[:2] - other[:2]), j)
                for j, other in enumerate(contour3D)
                if j != i
            ]
            dists.sort()
            near_z = np.mean([contour3D[j][2] for _, j in dists[:5]])
            if abs(pt[2] - near_z) < threshold:
                filtered.append(pt[:2])

        return np.array(filtered) if filtered else contour2D

    # ------------------------------------------------------------------
    # Step 4 – Close contour
    # ------------------------------------------------------------------

    def closeContour(self, contour: np.ndarray) -> np.ndarray:
        """Append the first point to the end if the contour is not already closed."""
        if len(contour) > 0 and not np.allclose(contour[0], contour[-1]):
            return np.vstack([contour, contour[0]])
        return contour

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def optimize(self) -> np.ndarray:
        """Run all optimization steps in sequence and return the final contour."""
        self.sortContourPoints()
        densified = self.densifyEdges()
        denoised = self.removeNoisePoints(densified)
        self.finalContour = self.closeContour(denoised)
        return self.finalContour