import { Map } from 'lucide-react';
import { Panel } from './ui/Panel';
import { LegendDot } from './ui/InfoRow';

const tabBtnStyle = {
  padding: '5px 12px', border: 'none', borderRadius: 6,
  fontSize: 11, cursor: 'pointer', fontWeight: 600,
  fontFamily: "'Courier New', monospace", transition: 'background 0.2s',
};

export function VisualizationPanel({ canvasRef, viewMode, onViewModeChange, hasResults }) {
  const headerRight = hasResults && (
    <div style={{ display: 'flex', gap: 6 }}>
      {[['2d', 'Points Only'], ['overlay', 'With Contour']].map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => onViewModeChange(mode)}
          style={{
            ...tabBtnStyle,
            background: viewMode === mode ? '#1d4ed8' : '#1e3a5f',
            color:      viewMode === mode ? '#fff'    : '#94a3b8',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Panel title="Visualization" icon={<Map size={16} />} headerRight={headerRight}>
      <canvas
        ref={canvasRef}
        width={900}
        height={520}
        style={{ width: '100%', background: '#020617', borderRadius: 8, display: 'block' }}
      />
      {hasResults && (
        <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12, color: '#64748b' }}>
          <LegendDot color="#475569" label="Original Points" />
          <LegendDot color="#ef4444" label="Extracted Contour" />
        </div>
      )}
    </Panel>
  );
}
