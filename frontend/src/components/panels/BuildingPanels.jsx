import { Map, BarChart2 } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { InfoRow } from '../ui/InfoRow';

const infoBoxStyle = {
  background: '#020617', borderRadius: 8, padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 6,
  border: '1px solid #1e3a5f',
};

/**
 * BuildingSelectorPanel
 * ----------------------
 * Dropdown to choose which detected building to inspect.
 * Only rendered when more than one building is found.
 */
export function BuildingSelectorPanel({ buildings, selected, onChange }) {
  if (!buildings || buildings.length <= 1) return null;

  return (
    <Panel title="Select Building" icon={<Map size={16} />}>
      <select
        value={selected}
        onChange={e => onChange(+e.target.value)}
        style={{
          width: '100%',
          background: '#0f172a',
          border: '1px solid #1e3a5f',
          borderRadius: 6,
          padding: '7px 10px',
          color: '#e2e8f0',
          fontSize: 12,
        }}
      >
        {buildings.map((b, i) => (
          <option key={i} value={i}>
            Building {i + 1} — {b.num_points} pts · {b.num_contour_points} contour
          </option>
        ))}
      </select>
    </Panel>
  );
}

/**
 * BuildingStatsPanel
 * ------------------
 * Shows per-building stats: input points, contour points, and roof area.
 */
export function BuildingStatsPanel({ building }) {
  if (!building) return null;

  return (
    <Panel title="Building Stats" icon={<BarChart2 size={16} />}>
      <div style={infoBoxStyle}>
        <InfoRow label="Input pts"   value={building.num_points.toLocaleString()} />
        <InfoRow label="Contour pts" value={building.num_contour_points} />
        <InfoRow label="Roof area"   value={`${building.area_m2} m²`} />
      </div>
    </Panel>
  );
}
