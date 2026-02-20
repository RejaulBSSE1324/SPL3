"""
InputDataProcessor
------------------
Responsibilities:
  - Taking file input containing building point cloud data
  - Validating input data format and integrity
  - Computing average point spacing (d)
  - Projecting 3D points to 2D plane
Collaborators: BandContourExtractor, VisualizationManager
"""

import numpy as np
from scipy.spatial import cKDTree

ALLOWED_EXTENSIONS = {"pts", "txt", "xyz"}


class InputDataProcessor:
    def __init__(self):
        self.pointCloudData = None   # raw parsed lines
        self.points2D = None         # np.ndarray shape (N, 2)
        self.points3D = None         # np.ndarray shape (N, 3)
        self.averageSpacing = None   # float d
        self.fileName = ""

    def readPointCloudData(self, file_content: str, filename: str) -> bool:
        """Parse raw file content into 3D point array."""
        self.fileName = filename
        lines = file_content.strip().split("\n")
        points = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 3:
                try:
                    x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
                    points.append([x, y, z])
                except ValueError:
                    continue
        if not points:
            return False
        self.pointCloudData = points
        self.points3D = np.array(points)
        self.project3Dto2D()
        return True

    def validateInputFormat(self, filename: str) -> bool:
        """Check whether the file extension is allowed."""
        return (
            "." in filename
            and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
        )

    def preprocessPointCloudData(self):
        """Remove obvious outliers based on z-score on the Z coordinate."""
        if self.points3D is None or len(self.points3D) == 0:
            return
        z_vals = self.points3D[:, 2]
        mean_z, std_z = z_vals.mean(), z_vals.std()
        mask = np.abs(z_vals - mean_z) < 3 * std_z
        self.points3D = self.points3D[mask]
        self.project3Dto2D()

    def calculateAverageSpacing(self, k: int = 80) -> float:
        """
        Compute average nearest-neighbour spacing from k random anchor points.
        Paper specifies k=80 for stability.
        """
        if self.points2D is None or len(self.points2D) < 2:
            return 1.0
        k_actual = min(k, len(self.points2D) - 1)
        tree = cKDTree(self.points2D)
        indices = np.random.choice(len(self.points2D), k_actual, replace=False)
        anchor_pts = self.points2D[indices]
        distances, _ = tree.query(anchor_pts, k=2)
        self.averageSpacing = float(np.mean(distances[:, 1]))
        return self.averageSpacing

    def project3Dto2D(self):
        """Project 3D point cloud to XY plane (discard Z)."""
        if self.points3D is not None:
            self.points2D = self.points3D[:, :2].copy()

    def getBounds(self) -> dict:
        if self.points3D is None:
            return {}
        return {
            "min_x": float(self.points3D[:, 0].min()),
            "max_x": float(self.points3D[:, 0].max()),
            "min_y": float(self.points3D[:, 1].min()),
            "max_y": float(self.points3D[:, 1].max()),
            "min_z": float(self.points3D[:, 2].min()),
            "max_z": float(self.points3D[:, 2].max()),
        }