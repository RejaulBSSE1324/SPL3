/**
 * VisualizationManager
 * --------------------
 * Responsibilities:
 *   - Visualising original point cloud and processed contour on a canvas
 *   - Overlaying extracted contours on top of points
 *   - Supporting interactive view modes (2d / overlay)
 *   - Exporting the canvas as a PNG image
 * Collaborators: InputDataProcessor (data), ContourOptimizer (contour)
 */
export class VisualizationManager {
  constructor(canvas) {
    this.canvas         = canvas;
    this.ctx            = canvas.getContext('2d');
    this.originalPoints = [];
    this.contourPoints  = [];
    this.displayMode    = '2d';   // '2d' | 'overlay'
    this._transform     = null;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _buildTransform(points, contour) {
    const all = [...points, ...(contour || [])];
    if (!all.length) return null;

    const xs     = all.map(p => p[0]);
    const ys     = all.map(p => p[1]);
    const minX   = Math.min(...xs), maxX = Math.max(...xs);
    const minY   = Math.min(...ys), maxY = Math.max(...ys);
    const pad    = 50;
    const w      = this.canvas.width  - 2 * pad;
    const h      = this.canvas.height - 2 * pad;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale  = Math.min(w / rangeX, h / rangeY);
    const offsetX = pad + (w - rangeX * scale) / 2;
    const offsetY = pad + (h - rangeY * scale) / 2;

    return { minX, minY, scale, offsetX, offsetY, height: this.canvas.height };
  }

  _toScreen(pt, t) {
    return {
      x: (pt[0] - t.minX) * t.scale + t.offsetX,
      y: t.height - ((pt[1] - t.minY) * t.scale + t.offsetY),
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  plotPointCloud(points, color = '#3b82f6', radius = 2) {
    this.originalPoints = points;
    const ctx = this.ctx;
    const t   = this._buildTransform(points, this.contourPoints);
    if (!t) return;
    this._transform = t;

    ctx.fillStyle = color;
    for (const p of points) {
      const sp = this._toScreen(p, t);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  overlayContour(contour, color = '#ef4444', lineWidth = 2.5) {
    this.contourPoints = contour;
    const ctx = this.ctx;
    const t   = this._transform || this._buildTransform(this.originalPoints, contour);
    if (!t || contour.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth   = lineWidth;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    contour.forEach((p, i) => {
      const sp = this._toScreen(p, t);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = color;
    for (const p of contour) {
      const sp = this._toScreen(p, t);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  toggleViewMode(mode) {
    this.displayMode = mode;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._transform = null;
  }

  drawStats(stats) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.fillRect(10, 10, 200, stats.length * 20 + 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font      = '11px "Courier New", monospace';
    stats.forEach((line, i) => ctx.fillText(line, 18, 26 + i * 20));
  }

  exportVisualization() {
    return this.canvas.toDataURL('image/png');
  }

  render(points, contour, mode) {
    this.clear();
    const ptColor  = mode === 'overlay' ? '#475569' : '#3b82f6';
    const ptRadius = mode === 'overlay' ? 1.5 : 2;
    this.plotPointCloud(points, ptColor, ptRadius);
    if (contour && contour.length > 0) {
      this.overlayContour(contour);
    }
    const stats = [`Points: ${points.length}`];
    if (contour?.length) stats.push(`Contour: ${contour.length} pts`);
    this.drawStats(stats);
  }
}
