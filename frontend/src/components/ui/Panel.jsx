/** Generic card panel with a header bar and content area. */
export function Panel({ title, icon, children, headerRight }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.8)',
      border: '1px solid #1e3a5f',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #1e3a5f',
        background: 'rgba(30,58,95,0.4)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 700, color: '#bae6fd', letterSpacing: 0.5,
        }}>
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
