import { useState, useEffect, useRef } from 'react';
import { Building } from 'lucide-react';

import { VisualizationManager }    from './classes/VisualizationManager';
import { useApi }                  from './hooks/useApi';

import { UploadPanel }             from './components/panels/UploadPanel';
import { ProcessPanel }            from './components/panels/ProcessPanel';
import { BuildingSelectorPanel, BuildingStatsPanel } from './components/panels/BuildingPanels';
import { ExportPanel }             from './components/panels/ExportPanel';
import { VisualizationPanel }      from './components/VisualizationPanel';
import { ThreeDPanel }             from './components/ThreeDPanel';
import { AlgorithmCard }           from './components/AlgorithmCard';
import { ErrorToast }              from './components/ui/ErrorToast';

// ── Tab button style ────────────────────────────────────────────────────────
const tabStyle = (active) => ({
  padding: '8px 20px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.5,
  fontFamily: "'Courier New', monospace",
  transition: 'all 0.2s',
  background: active ? '#1d4ed8' : 'rgba(30,58,95,0.4)',
  color:      active ? '#fff'    : '#64748b',
  borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
});

export default function LiDARContourExtractor() {
  // ── State ──────────────────────────────────────────────────────────────
  const [file,             setFile]             = useState(null);
  const [points,           setPoints]           = useState([]);
  const [results,          setResults]          = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(0);
  const [viewMode,         setViewMode]         = useState('2d');   // 2D canvas overlay mode
  const [viewDimension,    setViewDimension]    = useState('2d');   // '2d' | '3d' tab

  // ── Refs ───────────────────────────────────────────────────────────────
  const canvasRef     = useRef(null);
  const vizManagerRef = useRef(null);

  // ── API hook ───────────────────────────────────────────────────────────
  const {
    loading, processing, error, clearError,
    uploadFile, processPoints, exportContour,
  } = useApi();

  // ── VisualizationManager init (2D) ─────────────────────────────────────
  useEffect(() => {
    if (canvasRef.current && !vizManagerRef.current) {
      vizManagerRef.current = new VisualizationManager(canvasRef.current);
    }
  }, []);

  // ── Re-render 2D canvas on state change ───────────────────────────────
  useEffect(() => {
    if (viewDimension !== '2d') return;
    const vm = vizManagerRef.current;
    if (!vm || points.length === 0) return;
    const contour = results?.buildings?.[selectedBuilding]?.contour ?? [];
    vm.render(points, contour, viewMode);
  }, [points, results, selectedBuilding, viewMode, viewDimension]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleFileSelected = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResults(null);
    const data = await uploadFile(f);
    if (data) setPoints(data.points);
  };

  const handleProcess = async () => {
    if (!points.length) return;
    const res = await processPoints(points);
    if (res) {
      setResults(res);
      setSelectedBuilding(0);
      setViewMode('overlay');
    }
  };

  const handleExportContour = (format) => {
    const building = results?.buildings?.[selectedBuilding];
    if (!building) return;
    exportContour(building.contour, format);
  };

  const handleExportImage = () => {
    const dataUrl = vizManagerRef.current?.exportVisualization();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'contour_visualization.png';
    a.click();
  };

  // ── Derived values ─────────────────────────────────────────────────────
  const currentBuilding = results?.buildings?.[selectedBuilding];
  const currentContour  = currentBuilding?.contour ?? [];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      color: '#e2e8f0',
      fontFamily: "'Courier New', Courier, monospace",
    }}>

      {/* ── Header ── */}
      <header style={{
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #1e3a5f', padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
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

      {/* ── Main grid ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '300px 1fr',
        gap: 20, padding: 24, maxWidth: 1400, margin: '0 auto',
      }}>

        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <UploadPanel
            file={file}
            pointCount={points.length}
            loading={loading}
            onFileSelected={handleFileSelected}
          />
          <ProcessPanel
            hasPoints={points.length > 0}
            processing={processing}
            params={results?.parameters}
            onProcess={handleProcess}
          />
          <BuildingSelectorPanel
            buildings={results?.buildings}
            selected={selectedBuilding}
            onChange={setSelectedBuilding}
          />
          <BuildingStatsPanel building={currentBuilding} />
          {results && (
            <ExportPanel
              onExportContour={handleExportContour}
              onExportImage={handleExportImage}
            />
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 2D / 3D Tab switcher */}
          <div style={{
            display: 'flex', gap: 8,
            borderBottom: '1px solid #1e3a5f',
            paddingBottom: 12,
          }}>
            <button
              style={tabStyle(viewDimension === '2d')}
              onClick={() => setViewDimension('2d')}
            >
              📐 2D View
            </button>
            <button
              style={tabStyle(viewDimension === '3d')}
              onClick={() => setViewDimension('3d')}
            >
              🧊 3D View (Three.js)
            </button>
          </div>

          {/* Conditionally render 2D or 3D panel */}
          {viewDimension === '2d' ? (
            <VisualizationPanel
              canvasRef={canvasRef}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              hasResults={!!results}
            />
          ) : (
            <ThreeDPanel
              points={points}
              contour={currentContour}
            />
          )}

          <AlgorithmCard />
        </div>
      </div>

      {/* Error notification */}
      <ErrorToast message={error} onDismiss={clearError} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}