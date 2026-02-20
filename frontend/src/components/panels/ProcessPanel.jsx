import { Play, Loader } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { InfoRow } from '../ui/InfoRow';

const infoBoxStyle = {
  background: '#020617', borderRadius: 8, padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 6,
  border: '1px solid #1e3a5f',
};

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

export function ProcessPanel({ hasPoints, processing, params, onProcess }) {
  return (
    <Panel title="Extract Contours" icon={<Play size={16} />}>
      <button
        onClick={onProcess}
        disabled={!hasPoints || processing}
        style={btnStyle(!hasPoints || processing)}
      >
        {processing ? (
          <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
        ) : (
          <><Play size={14} /> Extract Contours</>
        )}
      </button>

      {params && (
        <div style={infoBoxStyle}>
          <InfoRow label="Buildings"     value={params.num_buildings} />
          <InfoRow label="Avg spacing d" value={`${params.d.toFixed(4)} m`} />
          <InfoRow label="Band width W"  value={`${params.W.toFixed(4)} m`} />
          <InfoRow label="Threshold T"   value={`${params.T.toFixed(4)} m`} />
        </div>
      )}
    </Panel>
  );
}
