import { Building } from 'lucide-react';
import { Panel } from './ui/Panel';

const CRC_CLASSES = [
  {
    cls: 'InputDataProcessor',
    steps: ['Read .pts/.xyz', 'Validate format', 'Calc avg spacing d', 'Project 3D→2D'],
  },
  {
    cls: 'BandContourExtractor',
    steps: ['Create 6-dir bands', 'Extract extreme pts', 'Merge directions', 'Remove internal pts'],
  },
  {
    cls: 'ContourOptimizer',
    steps: ['Sort (β=240°)', 'Densify edges (T=10d)', 'Remove noise', 'Close contour'],
  },
  {
    cls: 'AreaCalculator',
    steps: ['Shoelace formula', 'getArea()'],
  },
  {
    cls: 'ResultHandler',
    steps: ['PoLiS metric', 'RAE metric', 'Export TXT/JSON/GeoJSON'],
  },
  {
    cls: 'VisualizationManager',
    steps: ['plotPointCloud()', 'overlayContour()', 'toggleViewMode()', 'exportVisualization()'],
  },
];

export function AlgorithmCard() {
  return (
    <Panel title="Algorithm Pipeline (CRC Classes)" icon={<Building size={16} />}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {CRC_CLASSES.map(({ cls, steps }) => (
          <div
            key={cls}
            style={{
              background: '#0f172a',
              border: '1px solid #1e3a5f',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#38bdf8',
              marginBottom: 6, letterSpacing: 0.5,
            }}>
              {cls}
            </div>
            {steps.map(s => (
              <div key={s} style={{
                fontSize: 10, color: '#64748b',
                paddingLeft: 8, borderLeft: '2px solid #1e3a5f', marginBottom: 3,
              }}>
                {s}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}
