import { useEffect, useRef } from 'react';
import { Box } from 'lucide-react';
import { Panel } from './ui/Panel';
import { LegendDot } from './ui/InfoRow';
import { ThreeDVisualizationManager } from '../classes/ThreeDVisualizationManager';

/**
 * ThreeDPanel
 * -----------
 * Mounts a Three.js canvas and drives it via ThreeDVisualizationManager.
 * Re-renders whenever points or contour change.
 *
 * Props:
 *   points  – raw point array [[x,y,z], ...]
 *   contour – contour array   [[x,y], ...]
 */
export function ThreeDPanel({ points, contour }) {
  const canvasRef  = useRef(null);
  const managerRef = useRef(null);

  // ── Init Three.js once canvas is mounted ──────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    managerRef.current = new ThreeDVisualizationManager(canvasRef.current);

    // Handle window resize
    const handleResize = () => managerRef.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      managerRef.current?.dispose();
      managerRef.current = null;
    };
  }, []);

  // ── Re-render when data changes ───────────────────────────────────────
  useEffect(() => {
    const mgr = managerRef.current;
    if (!mgr || !points || points.length === 0) return;
    mgr.render(points, contour ?? []);
  }, [points, contour]);

  return (
    <Panel
      title="3D Visualization (Three.js)"
      icon={<Box size={16} />}
      headerRight={
        <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>
          drag to rotate · scroll to zoom · right-drag to pan
        </span>
      }
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 520,
          background: '#020617',
          borderRadius: 8,
          display: 'block',
          cursor: 'grab',
        }}
        width={900}
        height={520}
      />

      {/* Elevation colour legend */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#64748b' }}>
          <LegendDot color="#1e40af" label="Low elevation" />
          <LegendDot color="#22c55e" label="Mid elevation" />
          <LegendDot color="#ef4444" label="High elevation" />
          <LegendDot color="#ef4444" label="Extracted Contour" />
        </div>

        {/* Gradient bar */}
        <div style={{
          height: 8, borderRadius: 4, width: '100%',
          background: 'linear-gradient(to right, #1e40af, #06b6d4, #22c55e, #facc15, #ef4444)',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569' }}>
          <span>Low Z</span>
          <span>High Z</span>
        </div>
      </div>
    </Panel>
  );
}