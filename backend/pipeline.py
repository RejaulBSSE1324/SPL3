"""
pipeline.py
-----------
Orchestrates the full contour-extraction pipeline:

  InputDataProcessor
    → cluster_buildings  (utils)
      → BandContourExtractor
        → ContourOptimizer
          → AreaCalculator
            → ResultHandler  (metrics / export handled separately via API)
"""

import numpy as np
from processors import (
    InputDataProcessor,
    BandContourExtractor,
    ContourOptimizer,
    AreaCalculator,
    ResultHandler,
)
from utils import cluster_buildings


def run_pipeline(processor: InputDataProcessor) -> dict:
    """
    Execute the full pipeline for a pre-loaded InputDataProcessor and
    return a serialisable results dict.

    Parameters
    ----------
    processor : InputDataProcessor with points3D, points2D, and
                averageSpacing already populated.

    Returns
    -------
    dict with keys:
        parameters  – d, W, T, num_buildings
        buildings   – list of per-building result dicts
    """
    points2D = processor.points2D
    points3D = processor.points3D
    d = processor.averageSpacing

    buildings_pts = cluster_buildings(points2D)

    pipeline_results = {
        "parameters": {
            "d": float(d),
            "W": float(8 * d),
            "T": float(10 * d),
            "num_buildings": len(buildings_pts),
        },
        "buildings": [],
    }

    for idx, bld_pts in enumerate(buildings_pts):

        # ── BandContourExtractor ─────────────────────────────────────────
        extractor = BandContourExtractor(bld_pts, d)
        raw_contour = extractor.mergeMultiDirectionContours()

        if len(raw_contour) < 3:
            continue

        # ── ContourOptimizer ─────────────────────────────────────────────
        optimizer = ContourOptimizer(
            unsortedContour=raw_contour,
            allPoints2D=bld_pts,
            averageSpacing=d,
            points3D=points3D,
        )
        final_contour = optimizer.optimize()

        # ── AreaCalculator ───────────────────────────────────────────────
        area_calc = AreaCalculator(final_contour)
        area = area_calc.getArea()

        # ── ResultHandler (book-keeping) ──────────────────────────────────
        handler = ResultHandler()
        handler.contourResults = {
            "building_id": idx,
            "contour": final_contour.tolist(),
        }

        pipeline_results["buildings"].append(
            {
                "id": idx,
                "num_points": len(bld_pts),
                "contour": final_contour.tolist(),
                "num_contour_points": len(final_contour),
                "area_m2": round(area, 4),
            }
        )

    return pipeline_results