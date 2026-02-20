import { Upload, CheckCircle, Loader } from 'lucide-react';
import { Panel } from '../ui/Panel';

const dropzoneStyle = (hasFile) => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '20px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
  border: `2px dashed ${hasFile ? '#22c55e' : '#1e3a5f'}`,
  background: hasFile ? 'rgba(34,197,94,0.05)' : 'rgba(30,58,95,0.2)',
  transition: 'all 0.2s',
});

export function UploadPanel({ file, pointCount, loading, onFileSelected }) {
  return (
    <Panel title="Upload Point Cloud" icon={<Upload size={16} />}>
      <input
        type="file"
        accept=".pts,.txt,.xyz"
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
            <span style={{ fontSize: 11, color: '#64748b' }}>{pointCount.toLocaleString()} points</span>
          </>
        ) : (
          <>
            <Upload size={28} color="#475569" />
            <span style={{ fontSize: 13, marginTop: 6 }}>Click to upload</span>
            <span style={{ fontSize: 11, color: '#475569' }}>.pts · .xyz · .txt</span>
          </>
        )}
      </label>
    </Panel>
  );
}
