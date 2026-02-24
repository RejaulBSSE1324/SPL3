"""
app.py
------
Flask application entry point.
Contains ONLY route definitions – all business logic lives in:
  processors/   – CRC classes
  utils/        – helpers
  pipeline.py   – orchestration
"""

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import os

from processors import InputDataProcessor, ResultHandler
from pipeline import run_pipeline

# ── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
#CORS(app)

CORS(app, origins=[                                 
    "http://localhost:3000",
    "https://lidar-frontend-zeta.vercel.app"
])

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200 MB (LAS files can be large)


# ── Health ────────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "LiDAR Contour Extraction API",
        "version": "3.0.0",
        "supported_formats": ["pts", "txt", "xyz", "las", "laz"],
    })


# ── Upload ────────────────────────────────────────────────────────────────────
@app.route("/api/upload", methods=["POST"])
def upload_file():
    """
    Upload + parse a point cloud file.
    Supports:
      - Text formats  : .pts  .txt  .xyz  (read as UTF-8 string)
      - Binary formats: .las  .laz        (read as bytes via laspy)
    Uses InputDataProcessor to validate, read, preprocess, and compute spacing.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    processor = InputDataProcessor()

    if not processor.validateInputFormat(file.filename):
        return jsonify({
            "error": "Invalid file type. Allowed: .pts, .txt, .xyz, .las, .laz"
        }), 400

    try:
        raw_bytes = file.read()   # read once as bytes — works for both text and binary

        # ── Branch: binary (LAS/LAZ) vs text ──────────────────────────────
        if processor.isBinaryFormat(file.filename):
            # LAS / LAZ — pass raw bytes directly to the binary reader
            if not processor.readLasData(raw_bytes, file.filename):
                return jsonify({"error": "No valid points found in LAS/LAZ file"}), 400
        else:
            # Text formats (.pts / .txt / .xyz) — decode as UTF-8
            try:
                content = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                return jsonify({"error": "File is not valid UTF-8 text"}), 400

            if not processor.readPointCloudData(content, file.filename):
                return jsonify({"error": "No valid points found in file"}), 400

        processor.preprocessPointCloudData()
        processor.calculateAverageSpacing(k=80)

        # Build response — include LAS metadata when available
        response = {
            "success": True,
            "filename": file.filename,
            "format": processor.fileFormat,
            "num_points": len(processor.points3D),
            "averageSpacing": processor.averageSpacing,
            "bounds": processor.getBounds(),
            "points": processor.points3D.tolist(),
        }

        # Attach LAS header info if present
        las_meta = processor.getLasMetadata()
        if las_meta:
            response["las_metadata"] = las_meta

        return jsonify(response)

    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Process ───────────────────────────────────────────────────────────────────
@app.route("/api/process", methods=["POST"])
def process_contour():
    """
    Run the full extraction pipeline on already-uploaded points.
    Pipeline: InputDataProcessor → BandContourExtractor
              → ContourOptimizer → AreaCalculator → ResultHandler
    """
    try:
        data = request.json
        raw_points = np.array(data.get("points", []))
        if len(raw_points) == 0:
            return jsonify({"error": "No points provided"}), 400

        processor = InputDataProcessor()
        processor.points3D = raw_points
        processor.project3Dto2D()
        processor.calculateAverageSpacing(k=80)

        results = run_pipeline(processor)
        return jsonify({"success": True, "results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Export ────────────────────────────────────────────────────────────────────
@app.route("/api/export", methods=["POST"])
def export_contour():
    """Export a contour via ResultHandler (txt / json / geojson)."""
    try:
        data = request.json
        contour = np.array(data.get("contour", []))
        format_type = data.get("format", "txt")

        if len(contour) == 0:
            return jsonify({"error": "No contour provided"}), 400

        handler = ResultHandler()
        result = handler.exportResults(contour, format_type)

        if "error" in result:
            return jsonify(result), 400

        return jsonify({"success": True, **result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Metrics ───────────────────────────────────────────────────────────────────
@app.route("/api/metrics", methods=["POST"])
def compute_metrics():
    """Compute PoLiS and RAE accuracy metrics via ResultHandler."""
    try:
        data = request.json
        contour_a = np.array(data.get("contour_a", []))
        contour_b = np.array(data.get("contour_b", []))

        if len(contour_a) < 2 or len(contour_b) < 2:
            return jsonify({"error": "Both contours must have at least 2 points"}), 400

        handler = ResultHandler()
        metrics = handler.computeAccuracyMetrics(contour_a, contour_b)
        return jsonify({"success": True, "metrics": metrics})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)