import { Download } from 'lucide-react';
import { Panel } from '../ui/Panel';

const secondaryBtnStyle = {
  width: '100%', padding: '8px 0', borderRadius: 6,
  border: '1px solid #1e3a5f', cursor: 'pointer',
  background: 'rgba(30,58,95,0.3)', color: '#94a3b8',
  fontSize: 12, letterSpacing: 0.3,
  fontFamily: "'Courier New', monospace",
  transition: 'background 0.2s',
};

export function ExportPanel({ onExportContour, onExportImage }) {
  return (
    <Panel title="Export Results" icon={<Download size={16} />}>
      {['txt', 'json', 'geojson'].map(fmt => (
        <button
          key={fmt}
          onClick={() => onExportContour(fmt)}
          style={secondaryBtnStyle}
        >
          Export as .{fmt}
        </button>
      ))}
      <button
        onClick={onExportImage}
        style={{ ...secondaryBtnStyle, marginTop: 8, borderColor: '#1d4ed8', color: '#93c5fd' }}
      >
        Export PNG (Visualization)
      </button>
    </Panel>
  );
}
