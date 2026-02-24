import { Upload, CheckCircle, Loader } from 'lucide-react';
import { Panel } from '../ui/Panel';

// File format groups with colours for the badge
const FORMAT_BADGES = {
  pts: { bg: '#1e3a5f', color: '#38bdf8' },
  txt: { bg: '#1e3a5f', color: '#38bdf8' },
  xyz: { bg: '#1e3a5f', color: '#38bdf8' },
  las: { bg: '#14532d', color: '#4ade80' },
  laz: { bg: '#14532d', color: '#4ade80' },
};

function FormatBadge({ ext }) {
  const style = FORMAT_BADGES[ext] || FORMAT_BADGES.pts;
  return (
    <span style={{
      background: style.bg, color: style.color,
      fontSize: 10, fontWeight: 700, padding: '2px 7px',
      borderRadius: 4, letterSpacing: 0.5,
      fontFamily: "'Courier New', monospace",
    }}>
      .{ext}
    </span>
  );
}

const dropzoneStyle = (hasFile) => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '20px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
  border: `2px dashed ${hasFile ? '#22c55e' : '#1e3a5f'}`,
  background: hasFile ? 'rgba(34,197,94,0.05)' : 'rgba(30,58,95,0.2)',
  transition: 'all 0.2s',
});

export function UploadPanel({ file, pointCount, loading, onFileSelected, lasMetadata }) {
  // Derive format from file name
  const ext = file?.name?.split('.').pop()?.toLowerCase() ?? '';
  const isBinary = ext === 'las' || ext === 'laz';

  return (
    <Panel title="Upload Point Cloud" icon={<Upload size={16} />}>

      {/* Supported format badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {Object.keys(FORMAT_BADGES).map(f => <FormatBadge key={f} ext={f} />)}
      </div>

      {/* Drop zone */}
      <input
        type="file"
        accept=".pts,.txt,.xyz,.las,.laz"
        onChange={onFileSelected}
        id="file-upload"
        style={{ display: 'none' }}
      />
      <label htmlFor="file-upload" style={dropzoneStyle(!!file)}>
        {loading ? (
          <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }} />
        ) : file ? (
          <>
            <CheckCircle size={28} color="#22c55e" />
            <span style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{file.name}</span>
            <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {pointCount.toLocaleString()} points loaded
            </span>
            {isBinary && (
              <span style={{
                marginTop: 6, fontSize: 10, fontWeight: 700,
                color: '#4ade80', background: '#14532d',
                padding: '2px 8px', borderRadius: 4,
              }}>
                LiDAR binary format
              </span>
            )}
          </>
        ) : (
          <>
            <Upload size={28} color="#475569" />
            <span style={{ fontSize: 13, marginTop: 6 }}>Click to upload</span>
            <span style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              Text: .pts · .xyz · .txt
            </span>
            <span style={{ fontSize: 11, color: '#475569' }}>
              Binary: .las · .laz
            </span>
          </>
        )}
      </label>

      {/* LAS metadata box — shown only for LAS/LAZ files */}
      {lasMetadata && (
        <div style={{
          background: '#020617', border: '1px solid #14532d',
          borderRadius: 8, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 5,
          marginTop: 4,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 2 }}>
            LAS Header Info
          </div>
          {[
            ['Version',      lasMetadata.version],
            ['Point format', lasMetadata.point_format],
            ['Point count',  lasMetadata.point_count?.toLocaleString()],
            ['Scale X',      lasMetadata.scale?.[0]?.toFixed(4)],
            ['Offset X',     lasMetadata.offset?.[0]?.toFixed(2)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#64748b' }}>{label}</span>
              <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

    </Panel>
  );
}