import { useMemo, useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// US states TopoJSON from us-atlas. Loaded at runtime so we don't bloat the bundle.
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

/**
 * Two-letter postal code → state name. Used to translate
 * WC's billing.state (typically a 2-letter code) into the
 * full state names returned by us-atlas.
 */
export const STATE_CODE_TO_NAME = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

export const STATE_NAME_TO_CODE = Object.fromEntries(
  Object.entries(STATE_CODE_TO_NAME).map(([code, name]) => [name, code])
);

export const ALL_STATE_NAMES = Object.values(STATE_CODE_TO_NAME)
  .filter(n => n !== 'District of Columbia')
  .sort();

function colorForCount(count) {
  if (!count || count <= 0) return '#ffffff';
  if (count <= 19) return '#fb923c';   // orange
  if (count <= 49) return '#3b82f6';   // blue
  return '#15803d';                    // dark green
}

/**
 * countsByState: { 'California': 12, 'Texas': 47, ... }
 */
export default function UsStatesMap({ countsByState, onStateHover }) {
  const [hovered, setHovered] = useState(null);

  const handleEnter = (name) => {
    setHovered(name);
    onStateHover?.(name, countsByState[name] || 0);
  };

  const handleLeave = () => {
    setHovered(null);
    onStateHover?.(null, 0);
  };

  return (
    <div className="relative">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 900 }}
        width={780}
        height={460}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={TOPO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name = geo.properties.name;
              const count = countsByState[name] || 0;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={colorForCount(count)}
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                  onMouseEnter={() => handleEnter(name)}
                  onMouseLeave={handleLeave}
                  style={{
                    default: { outline: 'none', cursor: 'pointer' },
                    hover: { outline: 'none', stroke: '#0f172a', strokeWidth: 1.2 },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Hover tooltip + legend */}
      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
          <Legend swatch="#ffffff" label="0" border />
          <Legend swatch="#fb923c" label="1–19" />
          <Legend swatch="#3b82f6" label="20–49" />
          <Legend swatch="#15803d" label="50+" />
        </div>
        <div className="font-medium text-gray-700 dark:text-gray-300 min-h-[1.25rem]">
          {hovered ? `${hovered}: ${countsByState[hovered] || 0} orders` : 'Hover a state'}
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, label, border }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3.5 h-3.5 rounded"
        style={{
          backgroundColor: swatch,
          border: border ? '1px solid #cbd5e1' : 'none',
        }}
      />
      {label}
    </span>
  );
}
