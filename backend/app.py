# ============================================================================
# Backend API for Building Roof Contour Extraction
# Python + Flask - Refactored to match CRC Diagram
#
# Classes:
#   - InputDataProcessor
#   - BandContourExtractor
#   - ContourOptimizer
#   - AreaCalculator
#   - ResultHandler
# ============================================================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from scipy.spatial import cKDTree
import json
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pts', 'txt', 'xyz'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB


# ============================================================================
# CLASS: InputDataProcessor
# Responsibilities:
#   - Taking file input containing building point cloud data
#   - Validating input data format and integrity
#   - Computing average point spacing (d)
#   - Projecting 3D points to 2D plane
# Collaborators: BandContourExtractor, VisualizationManager
# ============================================================================
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
        lines = file_content.strip().split('\n')
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
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

    def preprocessPointCloudData(self):
        """Remove obvious outliers based on z-score on Z coordinate."""
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
            'min_x': float(self.points3D[:, 0].min()),
            'max_x': float(self.points3D[:, 0].max()),
            'min_y': float(self.points3D[:, 1].min()),
            'max_y': float(self.points3D[:, 1].max()),
            'min_z': float(self.points3D[:, 2].min()),
            'max_z': float(self.points3D[:, 2].max()),
        }


# ============================================================================
# CLASS: BandContourExtractor
# Responsibilities:
#   - Dividing 2D points into equal-width bands
#   - Extracting extreme boundary points from each band
#   - Combining contour points from multiple directions
#   - Ensuring complete boundary coverage
# Collaborators: ContourOptimizer, InputDataProcessor
# ============================================================================
class BandContourExtractor:
    def __init__(self, points2D: np.ndarray, averageSpacing: float):
        self.points2D = points2D
        self.averageSpacing = averageSpacing
        self.bandWidth = 8 * averageSpacing      # W = 8d  (paper specification)
        self.directions = [0, 30, 60, 90, 120, 150]  # 6 directions (paper)
        self.contourPoints = None                # merged result

    def createDirectionalBands(self, angle: float) -> list:
        """
        Rotate the 2D point set by `angle` degrees and create band slices
        along the rotated X-axis.  Returns a list of (band_mask, rotated_pts)
        tuples.
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
        Basic internal-point removal: keep only points that are convex-hull
        candidates or within a narrow band of the outer boundary.
        For the multidirectional method this is implicitly handled by banding,
        but we expose the method for completeness.
        """
        # Placeholder – the banding approach inherently avoids internal holes.
        return points


# ============================================================================
# CLASS: ContourOptimizer
# Responsibilities:
#   - Sorting contour points with angular constraint
#   - Preventing backward connections (beta=240°)
#   - Densifying long edges (T=10d)
#   - Removing elevation-based noise points
# Collaborators: BandContourExtractor, AreaCalculator, VisualizationManager
# ============================================================================
class ContourOptimizer:
    def __init__(self, unsortedContour: np.ndarray, allPoints2D: np.ndarray,
                 averageSpacing: float, points3D: np.ndarray = None):
        self.unsortedContour = unsortedContour
        self.sortedContour = None
        self.betaAngle = 240          # β = 240° (paper specification)
        self.threshold = 10 * averageSpacing   # T = 10d
        self.averageSpacing = averageSpacing
        self.finalContour = None
        self._allPoints2D = allPoints2D
        self._points3D = points3D

    def sortContourPoints(self) -> np.ndarray:
        """Nearest-neighbour sort with beta-angle forward constraint."""
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
        """
        if self.sortedContour is None or len(self.sortedContour) < 2:
            return self.sortedContour or np.empty((0, 2))

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

    def removeNoisePoints(self, contour2D: np.ndarray,
                          threshold_factor: float = 5.0) -> np.ndarray:
        """
        Remove contour points whose elevation differs significantly from
        their 5 nearest neighbours (parapet walls, antennas, etc.).
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
            dists = [(np.linalg.norm(pt[:2] - other[:2]), j)
                     for j, other in enumerate(contour3D) if j != i]
            dists.sort()
            near_z = np.mean([contour3D[j][2] for _, j in dists[:5]])
            if abs(pt[2] - near_z) < threshold:
                filtered.append(pt[:2])

        return np.array(filtered) if filtered else contour2D

    def closeContour(self, contour: np.ndarray) -> np.ndarray:
        """Append the first point to the end if not already closed."""
        if len(contour) > 0 and not np.allclose(contour[0], contour[-1]):
            return np.vstack([contour, contour[0]])
        return contour

    def optimize(self) -> np.ndarray:
        """Full optimization pipeline."""
        self.sortContourPoints()
        densified = self.densifyEdges()
        denoised = self.removeNoisePoints(densified)
        self.finalContour = self.closeContour(denoised)
        return self.finalContour


# ============================================================================
# CLASS: AreaCalculator
# Responsibilities:
#   - Calculate area of extracted roof contours
# Collaborators: ContourOptimizer, ResultHandler
# ============================================================================
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
        if self.computedArea == 0.0:
            self.calculateArea()
        return self.computedArea


# ============================================================================
# CLASS: ResultHandler
# Responsibilities:
#   - Calculating evaluation metrics (PoLiS, RAE)
#   - Exporting analysis results (CSV, JSON, GeoJSON)
# Collaborators: AreaCalculator
# ============================================================================
class ResultHandler:
    def __init__(self):
        self.contourResults = {}
        self.evaluationMetrics = {}
        self.exportFormat = 'txt'

    def computeAccuracyMetrics(self, contour_a: np.ndarray,
                                contour_b: np.ndarray) -> dict:
        """
        PoLiS (Polygon Similarity, Wang et al. eq. 5) and RAE (eq. 6).
        contour_b is treated as the reference.
        """
        from scipy.spatial.distance import cdist

        if len(contour_a) < 2 or len(contour_b) < 2:
            return {'polis': None, 'rae': None}

        # PoLiS
        D = cdist(contour_a, contour_b)
        p, q = len(contour_a), len(contour_b)
        polis = float(D.min(axis=1).sum() / (2 * p) + D.min(axis=0).sum() / (2 * q))

        # RAE
        area_a = AreaCalculator(contour_a).getArea()
        area_b = AreaCalculator(contour_b).getArea()
        rae = float(abs(area_a - area_b) / area_b * 100) if area_b > 0 else None

        self.evaluationMetrics = {'polis': polis, 'rae': rae}
        return self.evaluationMetrics

    def exportResults(self, contour: np.ndarray, format_type: str = 'txt') -> dict:
        """Serialise contour to the requested format string."""
        self.exportFormat = format_type

        if format_type == 'txt':
            lines = ["# Building Contour Export", "# X Y"]
            for pt in contour:
                lines.append(f"{pt[0]:.6f} {pt[1]:.6f}")
            return {'data': '\n'.join(lines), 'filename': 'contour.txt'}

        elif format_type == 'json':
            return {
                'data': json.dumps({'contour': contour.tolist()}, indent=2),
                'filename': 'contour.json'
            }

        elif format_type == 'geojson':
            geojson = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [contour.tolist()]
                },
                "properties": {
                    "type": "building_contour",
                    "num_points": len(contour)
                }
            }
            return {
                'data': json.dumps(geojson, indent=2),
                'filename': 'contour.geojson'
            }

        return {'error': 'Unsupported format'}


# ============================================================================
# HELPER: Simple spatial clustering (DBSCAN-lite) to separate buildings
# ============================================================================
def cluster_buildings(points2D: np.ndarray,
                      threshold: float = 5.0,
                      min_points: int = 20) -> list:
    """Group spatially close points into separate building clusters."""
    if len(points2D) == 0:
        return []
    tree = cKDTree(points2D)
    visited = np.zeros(len(points2D), dtype=bool)
    clusters = []
    for start in range(len(points2D)):
        if visited[start]:
            continue
        queue = [start]
        cluster = []
        while queue:
            idx = queue.pop()
            if visited[idx]:
                continue
            visited[idx] = True
            cluster.append(idx)
            neighbours = tree.query_ball_point(points2D[idx], threshold)
            queue.extend(n for n in neighbours if not visited[n])
        if len(cluster) >= min_points:
            clusters.append(points2D[cluster])
    return clusters


# ============================================================================
# MAIN PROCESSING PIPELINE  (orchestrates all CRC classes)
# ============================================================================
def run_pipeline(processor: InputDataProcessor) -> dict:
    """
    Full pipeline:
      InputDataProcessor → BandContourExtractor → ContourOptimizer
        → AreaCalculator → ResultHandler
    """
    points2D = processor.points2D
    points3D = processor.points3D
    d = processor.averageSpacing

    buildings_pts = cluster_buildings(points2D)
    pipeline_results = {
        'parameters': {
            'd': float(d),
            'W': float(8 * d),
            'T': float(10 * d),
            'num_buildings': len(buildings_pts)
        },
        'buildings': []
    }

    for idx, bld_pts in enumerate(buildings_pts):
        # --- BandContourExtractor ---
        extractor = BandContourExtractor(bld_pts, d)
        raw_contour = extractor.mergeMultiDirectionContours()

        if len(raw_contour) < 3:
            continue

        # --- ContourOptimizer ---
        optimizer = ContourOptimizer(
            unsortedContour=raw_contour,
            allPoints2D=bld_pts,
            averageSpacing=d,
            points3D=points3D
        )
        final_contour = optimizer.optimize()

        # --- AreaCalculator ---
        area_calc = AreaCalculator(final_contour)
        area = area_calc.getArea()

        # --- ResultHandler (metrics placeholder; no separate reference here) ---
        handler = ResultHandler()
        handler.contourResults = {'building_id': idx, 'contour': final_contour.tolist()}

        pipeline_results['buildings'].append({
            'id': idx,
            'num_points': len(bld_pts),
            'contour': final_contour.tolist(),
            'num_contour_points': len(final_contour),
            'area_m2': round(area, 4)
        })

    return pipeline_results


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'LiDAR Contour Extraction API – CRC Edition',
        'version': '2.0.0'
    })


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload + parse point cloud file via InputDataProcessor."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # InputDataProcessor: validate format
    processor = InputDataProcessor()
    if not processor.validateInputFormat(file.filename):
        return jsonify({'error': 'Invalid file type. Allowed: .pts, .txt, .xyz'}), 400

    try:
        content = file.read().decode('utf-8')

        # InputDataProcessor: read data
        if not processor.readPointCloudData(content, file.filename):
            return jsonify({'error': 'No valid points found in file'}), 400

        # InputDataProcessor: preprocess (outlier removal)
        processor.preprocessPointCloudData()

        # InputDataProcessor: calculate average spacing
        processor.calculateAverageSpacing(k=80)

        return jsonify({
            'success': True,
            'filename': file.filename,
            'num_points': len(processor.points3D),
            'averageSpacing': processor.averageSpacing,
            'bounds': processor.getBounds(),
            'points': processor.points3D.tolist()
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/process', methods=['POST'])
def process_contour():
    """
    Run full pipeline:
    InputDataProcessor → BandContourExtractor → ContourOptimizer
    → AreaCalculator → ResultHandler
    """
    try:
        data = request.json
        raw_points = np.array(data.get('points', []))
        if len(raw_points) == 0:
            return jsonify({'error': 'No points provided'}), 400

        # Re-create InputDataProcessor from already-parsed points
        processor = InputDataProcessor()
        processor.points3D = raw_points
        processor.project3Dto2D()
        processor.calculateAverageSpacing(k=80)

        results = run_pipeline(processor)
        return jsonify({'success': True, 'results': results})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export', methods=['POST'])
def export_contour():
    """Export via ResultHandler."""
    try:
        data = request.json
        contour = np.array(data.get('contour', []))
        format_type = data.get('format', 'txt')

        if len(contour) == 0:
            return jsonify({'error': 'No contour provided'}), 400

        handler = ResultHandler()
        result = handler.exportResults(contour, format_type)

        if 'error' in result:
            return jsonify(result), 400

        return jsonify({'success': True, **result})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/metrics', methods=['POST'])
def compute_metrics():
    """Compute PoLiS and RAE via ResultHandler."""
    try:
        data = request.json
        contour_a = np.array(data.get('contour_a', []))
        contour_b = np.array(data.get('contour_b', []))  # reference

        if len(contour_a) < 2 or len(contour_b) < 2:
            return jsonify({'error': 'Both contours must have at least 2 points'}), 400

        handler = ResultHandler()
        metrics = handler.computeAccuracyMetrics(contour_a, contour_b)
        return jsonify({'success': True, 'metrics': metrics})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)