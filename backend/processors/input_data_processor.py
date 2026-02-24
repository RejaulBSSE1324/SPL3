"""
InputDataProcessor
------------------
Responsibilities:
  - Taking file input containing building point cloud data
  - Validating input data format and integrity  
  - Reading text formats  : .pts  .txt  .xyz
  - Reading binary formats: .las  .laz  (via laspy)
  - Computing average point spacing (d)
  - Projecting 3D points to 2D plane
Collaborators: BandContourExtractor, VisualizationManager
"""

import numpy as np
from scipy.spatial import cKDTree

# Supported extensions split by how they are read
TEXT_EXTENSIONS   = {"pts", "txt", "xyz"}
BINARY_EXTENSIONS = {"las", "laz"}
ALLOWED_EXTENSIONS = TEXT_EXTENSIONS | BINARY_EXTENSIONS


class InputDataProcessor:
    def __init__(self):
        self.pointCloudData = None   # raw parsed lines / laspy object
        self.points2D       = None   # np.ndarray shape (N, 2)
        self.points3D       = None   # np.ndarray shape (N, 3)
        self.averageSpacing = None   # float d
        self.fileName       = ""
        self.fileFormat     = ""     # 'text' | 'las' | 'laz'

    # ── Format detection ─────────────────────────────────────────────────────

    def validateInputFormat(self, filename: str) -> bool:
        """Return True if the file extension is supported."""
        return (
            "." in filename
            and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
        )

    def _extension(self, filename: str) -> str:
        return filename.rsplit(".", 1)[1].lower() if "." in filename else ""

    def isBinaryFormat(self, filename: str) -> bool:
        """Return True for LAS/LAZ files that must be read as bytes."""
        return self._extension(filename) in BINARY_EXTENSIONS

    # ── Text reader (.pts / .txt / .xyz) ─────────────────────────────────────

    def readPointCloudData(self, file_content: str, filename: str) -> bool:
        """
        Parse whitespace-delimited text content into a 3D point array.
        Expects at least 3 columns: X  Y  Z  (additional columns ignored).
        """
        self.fileName   = filename
        self.fileFormat = "text"

        lines  = file_content.strip().split("\n")
        points = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 3:
                try:
                    x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
                    points.append([x, y, z])
                except ValueError:
                    continue   # skip header lines / non-numeric rows

        if not points:
            return False

        self.pointCloudData = points
        self.points3D       = np.array(points)
        self.project3Dto2D()
        return True

    # ── Binary reader (.las / .laz) ──────────────────────────────────────────

    def readLasData(self, file_bytes: bytes, filename: str) -> bool:
        """
        Parse LAS or LAZ binary data using laspy.

        Reads X, Y, Z applying the scale + offset stored in the file header
        so coordinates are in real-world units (metres or feet, as stored).

        Optionally reads:
          - intensity  (stored as points3D_extra[:, 3] if needed later)
          - return_number, number_of_returns  (for roof-point filtering)

        For now we keep only X Y Z to stay compatible with the rest of the
        pipeline.
        """
        try:
            import laspy
        except ImportError:
            raise RuntimeError(
                "laspy is not installed. "
                "Run: pip install laspy[lazrs]"
            )

        import io
        self.fileName   = filename
        self.fileFormat = self._extension(filename)   # 'las' or 'laz'

        las = laspy.read(io.BytesIO(file_bytes))

        # laspy applies scale + offset automatically when you access .x/.y/.z
        x = np.array(las.x, dtype=np.float64)
        y = np.array(las.y, dtype=np.float64)
        z = np.array(las.z, dtype=np.float64)

        if len(x) == 0:
            return False

        self.points3D = np.column_stack((x, y, z))
        self.project3Dto2D()

        # Optional: log LAS metadata
        self._lasMetadata = {
            "point_format": int(las.point_format.id),
            "point_count":  int(las.header.point_count),
            "scale":        list(las.header.scales),
            "offset":       list(las.header.offsets),
            "version":      f"{las.header.version.major}.{las.header.version.minor}",
        }

        return True

    # ── Preprocessing ─────────────────────────────────────────────────────────

    def preprocessPointCloudData(self):
        """Remove obvious outliers based on z-score on the Z coordinate."""
        if self.points3D is None or len(self.points3D) == 0:
            return
        z_vals         = self.points3D[:, 2]
        mean_z, std_z  = z_vals.mean(), z_vals.std()
        mask           = np.abs(z_vals - mean_z) < 3 * std_z
        self.points3D  = self.points3D[mask]
        self.project3Dto2D()

    # ── Spacing ───────────────────────────────────────────────────────────────

    def calculateAverageSpacing(self, k: int = 80) -> float:
        """
        Compute average nearest-neighbour spacing from k random anchor points.
        Paper specifies k=80 for stability.
        """
        if self.points2D is None or len(self.points2D) < 2:
            return 1.0
        k_actual   = min(k, len(self.points2D) - 1)
        tree       = cKDTree(self.points2D)
        indices    = np.random.choice(len(self.points2D), k_actual, replace=False)
        anchor_pts = self.points2D[indices]
        distances, _ = tree.query(anchor_pts, k=2)
        self.averageSpacing = float(np.mean(distances[:, 1]))
        return self.averageSpacing

    # ── Projection ────────────────────────────────────────────────────────────

    def project3Dto2D(self):
        """Project 3D point cloud to XY plane (discard Z)."""
        if self.points3D is not None:
            self.points2D = self.points3D[:, :2].copy()

    # ── Bounds ────────────────────────────────────────────────────────────────

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

    def getLasMetadata(self) -> dict:
        """Return LAS header metadata (only available after readLasData)."""
        return getattr(self, "_lasMetadata", {})