"""
utils/clustering.py
-------------------
Spatial clustering helper to separate individual buildings from a mixed
point cloud.  Uses a DBSCAN-inspired region-growing approach backed by
a cKDTree for fast neighbour queries.
"""

import numpy as np
from scipy.spatial import cKDTree


def cluster_buildings(
    points2D: np.ndarray,
    threshold: float = 5.0,
    min_points: int = 20,
) -> list:
    """
    Group spatially close points into separate building clusters.

    Parameters
    ----------
    points2D   : (N, 2) array of XY coordinates
    threshold  : maximum distance to be considered the same cluster (metres)
    min_points : minimum cluster size to be kept (filters noise/small objects)

    Returns
    -------
    List of np.ndarray, each shaped (M, 2) for one building cluster.
    """
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