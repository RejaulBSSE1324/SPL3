import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Play, Download, Loader, AlertCircle, CheckCircle, Building, Map, BarChart2, X } from 'lucide-react';

// ============================================================================
// CLASS: VisualizationManager
// Responsibilities:
//   - Visualizing original and processed data
//   - Overlaying extracted contours
//   - Supporting interactive inspection
// Collaborators: InputDataProcessor (data), ContourOptimizer (contour)
// ============================================================================
class VisualizationManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.originalPoints = [];
    this.contourPoints = [];
    this.displayMode = '2d'; // '2d' | 'overlay'
    this._transform = null;
  }

  _buildTransform(points, contour) {
    const all = [...points, ...(contour || [])];
    if (!all.length) return null;
    const xs = all.map(p => p[0]);
    const ys = all.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 50;
    const w = this.canvas.width - 2 * pad;
    const h = this.canvas.height - 2 * pad;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min(w / rangeX, h / rangeY);
    const offsetX = pad + (w - rangeX * scale) / 2;
    const offsetY = pad + (h - rangeY * scale) / 2;
    return { minX, minY, scale, offsetX, offsetY, height: this.canvas.height };
  }

  _toScreen(pt, t) {
    return {
      x: (pt[0] - t.minX) * t.scale + t.offsetX,
      y: t.height - ((pt[1] - t.minY) * t.scale + t.offsetY)
    };
  }

  plotPointCloud(points, color = '#3b82f6', radius = 2) {
    this.originalPoints = points;
    const ctx = this.ctx;
    const t = this._buildTransform(points, this.contourPoints);
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
    const t = this._transform || this._buildTransform(this.originalPoints, contour);
    if (!t || contour.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    contour.forEach((p, i) => {
      const sp = this._toScreen(p, t);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Draw contour vertices
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
    ctx.font = '11px "Courier New", monospace';
    stats.forEach((line, i) => ctx.fillText(line, 18, 26 + i * 20));
  }

  exportVisualization() {
    return this.canvas.toDataURL('image/png');
  }

  render(points, contour, mode) {
    this.clear();
    const ptColor = mode === 'overlay' ? '#475569' : '#3b82f6';
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


// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
const API_URL = 'http://localhost:5000/api';

export default function LiDARContourExtractor() {
  const [file, setFile]                     = useState(null);
  const [points, setPoints]                 = useState([]);
  const [results, setResults]               = useState(null);
  const [loading, setLoading]               = useState(false);
  const [processing, setProcessing]         = useState(false);
  const [error, setError]                   = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState(0);
  const [viewMode, setViewMode]             = useState('2d');
  const [activeTab, setActiveTab]           = useState('visualize'); // 'visualize' | 'metrics'
  const [metrics, setMetrics]               = useState(null);

  const canvasRef = useRef(null);
  const vizManagerRef = useRef(null);

  // Initialise VisualizationManager once canvas is ready
  useEffect(() => {
    if (canvasRef.current && !vizManagerRef.current) {
      vizManagerRef.current = new VisualizationManager(canvasRef.current);
    }
  }, []);

  // Re-render whenever points, results, building selection or viewMode changes
  useEffect(() => {
    const vm = vizManagerRef.current;
    if (!vm || points.length === 0) return;

    const contour = results?.buildings?.[selectedBuilding]?.contour ?? [];
    vm.render(points, contour, viewMode);
  }, [points, results, selectedBuilding, viewMode]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setLoading(true);
    setError('');
    setResults(null);
    setMetrics(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setPoints(data.points);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Cannot reach backend. Make sure the Flask server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!points.length) return;
    setProcessing(true);
    setError('');
    setMetrics(null);

    try {
      const res = await fetch(`${API_URL}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points })
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setSelectedBuilding(0);
        setViewMode('overlay');
        setActiveTab('visualize');
      } else {
        setError(data.error || 'Processing failed');
      }
    } catch {
      setError('Processing failed. Check server connection.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async (format = 'txt') => {
    if (!results?.buildings?.[selectedBuilding]) return;
    const contour = results.buildings[selectedBuilding].contour;
    try {
      const res = await fetch(`${API_URL}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contour, format })
      });
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([data.data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError('Export failed');
    }
  };

  const handleExportImage = () => {
    const vm = vizManagerRef.current;
    if (!vm) return;
    const dataUrl = vm.exportVisualization();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'contour_visualization.png';
    a.click();
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const currentBuilding = results?.buildings?.[selectedBuilding];
  const params = results?.parameters;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', color: '#e2e8f0', fontFamily: "'Courier New', Courier, monospace" }}>

      {/* ── Header ── */}
      <header style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1e3a5f', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Building size={28} color="#38bdf8" />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: 1, color: '#f0f9ff' }}>
              LiDAR Building Contour Extractor
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b', letterSpacing: 0.5 }}>
              Multidirectional Bands Method · Wang et al. 2024
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#475569' }}>
          <div>IIT, University of Dhaka</div>
          <div>Roll: BSSE-1324</div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, padding: 24, maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Left panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload */}
          <Panel title="Upload Point Cloud" icon={<Upload size={16} />}>
            <input type="file" accept=".pts,.txt,.xyz" onChange={handleFileUpload} id="file-upload" style={{ display: 'none' }} />
            <label htmlFor="file-upload" style={dropzoneStyle(!!file)}>
              {loading
                ? <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }} />
                : file
                  ? <>
                      <CheckCircle size={28} color="#22c55e" />
                      <span style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{file.name}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{points.length.toLocaleString()} points</span>
                    </>
                  : <>
                      <Upload size={28} color="#475569" />
                      <span style={{ fontSize: 13, marginTop: 6 }}>Click to upload</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>.pts · .xyz · .txt</span>
                    </>}
            </label>
          </Panel>

          {/* Process */}
          <Panel title="Extract Contours" icon={<Play size={16} />}>
            <button
              onClick={handleProcess}
              disabled={!points.length || processing}
              style={btnStyle(!points.length || processing)}
            >
              {processing
                ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
                : <><Play size={14} /> Extract Contours</>}
            </button>

            {params && (
              <div style={infoBoxStyle}>
                <InfoRow label="Buildings" value={params.num_buildings} />
                <InfoRow label="Avg spacing d" value={`${params.d.toFixed(4)} m`} />
                <InfoRow label="Band width W" value={`${params.W.toFixed(4)} m`} />
                <InfoRow label="Threshold T" value={`${params.T.toFixed(4)} m`} />
              </div>
            )}
          </Panel>

          {/* Building selector */}
          {results?.buildings?.length > 1 && (
            <Panel title="Select Building" icon={<Map size={16} />}>
              <select
                value={selectedBuilding}
                onChange={e => setSelectedBuilding(+e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 12 }}
              >
                {results.buildings.map((b, i) => (
                  <option key={i} value={i}>
                    Building {i + 1} — {b.num_points} pts · {b.num_contour_points} contour
                  </option>
                ))}
              </select>
            </Panel>
          )}

          {/* Building stats */}
          {currentBuilding && (
            <Panel title="Building Stats" icon={<BarChart2 size={16} />}>
              <div style={infoBoxStyle}>
                <InfoRow label="Input pts" value={currentBuilding.num_points.toLocaleString()} />
                <InfoRow label="Contour pts" value={currentBuilding.num_contour_points} />
                <InfoRow label="Roof area" value={`${currentBuilding.area_m2} m²`} />
              </div>
            </Panel>
          )}

          {/* Export */}
          {results && (
            <Panel title="Export Results" icon={<Download size={16} />}>
              {['txt', 'json', 'geojson'].map(fmt => (
                <button key={fmt} onClick={() => handleExport(fmt)} style={secondaryBtnStyle}>
                  Export as .{fmt}
                </button>
              ))}
              <button onClick={handleExportImage} style={{ ...secondaryBtnStyle, marginTop: 8, borderColor: '#1d4ed8', color: '#93c5fd' }}>
                Export PNG (VisualizationManager)
              </button>
            </Panel>
          )}
        </div>

        {/* ── Right panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* View mode tabs + canvas */}
          <Panel
            title="Visualization"
            icon={<Map size={16} />}
            headerRight={
              results && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['2d', 'Points Only'], ['overlay', 'With Contour']].map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      style={{ ...tabBtnStyle, background: viewMode === mode ? '#1d4ed8' : '#1e3a5f', color: viewMode === mode ? '#fff' : '#94a3b8' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )
            }
          >
            <canvas
              ref={canvasRef}
              width={900}
              height={520}
              style={{ width: '100%', background: '#020617', borderRadius: 8, display: 'block' }}
            />
            {results && (
              <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12, color: '#64748b' }}>
                <LegendDot color="#475569" label="Original Points" />
                <LegendDot color="#ef4444" label="Extracted Contour (ContourOptimizer)" />
              </div>
            )}
          </Panel>

          {/* Algorithm card */}
          <Panel title="Algorithm Pipeline (CRC Classes)" icon={<Building size={16} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { cls: 'InputDataProcessor', steps: ['Read .pts/.xyz', 'Validate format', 'Calc avg spacing d', 'Project 3D→2D'] },
                { cls: 'BandContourExtractor', steps: ['Create 6-dir bands', 'Extract extreme pts', 'Merge directions', 'Remove internal pts'] },
                { cls: 'ContourOptimizer', steps: ['Sort (β=240°)', 'Densify edges (T=10d)', 'Remove noise', 'Close contour'] },
                { cls: 'AreaCalculator', steps: ['Shoelace formula', 'getArea()'] },
                { cls: 'ResultHandler', steps: ['PoLiS metric', 'RAE metric', 'Export CSV/JSON/GeoJSON'] },
                { cls: 'VisualizationManager', steps: ['plotPointCloud()', 'overlayContour()', 'toggleViewMode()', 'exportVisualization()'] },
              ].map(({ cls, steps }) => (
                <div key={cls} style={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 6, letterSpacing: 0.5 }}>{cls}</div>
                  {steps.map(s => (
                    <div key={s} style={{ fontSize: 10, color: '#64748b', paddingLeft: 8, borderLeft: '2px solid #1e3a5f', marginBottom: 3 }}>
                      {s}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 10, padding: '14px 18px', maxWidth: 380, display: 'flex', gap: 10, alignItems: 'flex-start', zIndex: 1000 }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fca5a5' }}>Error</div>
            <div style={{ fontSize: 12, color: '#fecaca', marginTop: 4 }}>{error}</div>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', marginLeft: 'auto' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({ title, icon, children, headerRight }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid #1e3a5f', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #1e3a5f', background: 'rgba(30,58,95,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#bae6fd', letterSpacing: 0.5 }}>
          {icon}{title}
        </div>
        {headerRight}
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span>{label}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const dropzoneStyle = (hasFile) => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '20px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
  border: `2px dashed ${hasFile ? '#22c55e' : '#1e3a5f'}`,
  background: hasFile ? 'rgba(34,197,94,0.05)' : 'rgba(30,58,95,0.2)',
  transition: 'all 0.2s',
});

const btnStyle = (disabled) => ({
  width: '100%', padding: '10px 0', borderRadius: 8,
  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? '#1e3a5f' : '#1d4ed8',
  color: disabled ? '#475569' : '#fff',
  fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  transition: 'background 0.2s',
  fontFamily: "'Courier New', monospace",
});

const secondaryBtnStyle = {
  width: '100%', padding: '8px 0', borderRadius: 6,
  border: '1px solid #1e3a5f', cursor: 'pointer',
  background: 'rgba(30,58,95,0.3)', color: '#94a3b8',
  fontSize: 12, letterSpacing: 0.3,
  fontFamily: "'Courier New', monospace",
  transition: 'background 0.2s',
};

const infoBoxStyle = {
  background: '#020617', borderRadius: 8, padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 6,
  border: '1px solid #1e3a5f',
};

const tabBtnStyle = {
  padding: '5px 12px', border: 'none', borderRadius: 6,
  fontSize: 11, cursor: 'pointer', fontWeight: 600,
  fontFamily: "'Courier New', monospace", transition: 'background 0.2s',
};
