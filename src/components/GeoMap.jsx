import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

// Simple Mercator projection world map
// Map boundaries: lat -60 to 85, lng -180 to 180
const MAP_W = 600
const MAP_H = 380
const LAT_MIN = -60
const LAT_MAX = 85
const LNG_MIN = -180
const LNG_MAX = 180

function latLngToXY(lat, lng) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W
  // Mercator-ish y
  const latRad = (lat * Math.PI) / 180
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  const latMinRad = (LAT_MIN * Math.PI) / 180
  const latMaxRad = (LAT_MAX * Math.PI) / 180
  const mercMin = Math.log(Math.tan(Math.PI / 4 + latMinRad / 2))
  const mercMax = Math.log(Math.tan(Math.PI / 4 + latMaxRad / 2))
  const y = MAP_H - ((mercN - mercMin) / (mercMax - mercMin)) * MAP_H
  return { x, y }
}

function xyToLatLng(x, y) {
  const lng = (x / MAP_W) * (LNG_MAX - LNG_MIN) + LNG_MIN
  const latMinRad = (LAT_MIN * Math.PI) / 180
  const latMaxRad = (LAT_MAX * Math.PI) / 180
  const mercMin = Math.log(Math.tan(Math.PI / 4 + latMinRad / 2))
  const mercMax = Math.log(Math.tan(Math.PI / 4 + latMaxRad / 2))
  const mercN = ((MAP_H - y) / MAP_H) * (mercMax - mercMin) + mercMin
  const lat = ((Math.atan(Math.exp(mercN)) - Math.PI / 4) * 2 * 180) / Math.PI
  return { lat, lng }
}

// Simplified continent outlines (very basic)
const CONTINENTS = `M95,95 L110,92 L115,100 L108,115 L100,120 L85,115 L80,105 Z
M150,70 L170,65 L185,72 L200,68 L210,75 L215,95 L200,110 L195,130 L185,140 L175,135 L170,120 L160,115 L155,100 L145,90 Z
M280,60 L310,55 L340,60 L370,55 L400,60 L410,70 L420,80 L415,100 L405,110 L395,105 L385,95 L370,95 L360,100 L340,90 L320,85 L300,80 L285,75 Z
M330,110 L345,115 L355,130 L350,155 L340,170 L325,180 L315,170 L310,150 L315,130 Z
M435,65 L460,60 L490,65 L510,80 L520,100 L515,115 L500,120 L490,130 L475,140 L460,135 L445,120 L435,100 L430,80 Z
M450,190 L480,180 L510,190 L520,210 L510,235 L490,240 L470,235 L455,220 L450,205 Z
M185,145 L200,148 L230,160 L245,180 L240,200 L225,225 L215,240 L200,250 L190,245 L180,225 L175,200 L170,175 L175,155 Z`

export default function GeoMap({ onSelect, selected, target, showTarget, pins = [] }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const handleClick = (e) => {
    if (!onSelect) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * MAP_W
    const y = ((e.clientY - rect.top) / rect.height) * MAP_H
    const { lat, lng } = xyToLatLng(x, y)
    onSelect({ lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 })
  }

  const handleMove = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * MAP_W
    const y = ((e.clientY - rect.top) / rect.height) * MAP_H
    const { lat, lng } = xyToLatLng(x, y)
    setHover({ x, y, lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 })
  }

  const selectedXY = selected ? latLngToXY(selected.lat, selected.lng) : null
  const targetXY = target ? latLngToXY(target.lat, target.lng) : null

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full rounded-xl cursor-crosshair"
        style={{ background: 'linear-gradient(180deg, #0c1929 0%, #0f2240 100%)' }}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {[-60,-30,0,30,60].map(lat => {
          const { y } = latLngToXY(lat, 0)
          return <line key={`lat${lat}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        })}
        {[-120,-60,0,60,120].map(lng => {
          const { x } = latLngToXY(0, lng)
          return <line key={`lng${lng}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        })}

        {/* Continents */}
        {CONTINENTS.split('\n').map((d, i) => (
          <path key={i} d={d.trim()} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
        ))}

        {/* Hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} y1={0} x2={hover.x} y2={MAP_H} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="4" />
            <line x1={0} y1={hover.y} x2={MAP_W} y2={hover.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="4" />
          </>
        )}

        {/* Player pins */}
        {pins.map((pin, i) => {
          const { x, y } = latLngToXY(pin.lat, pin.lng)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill={pin.color || '#3b82f6'} stroke="white" strokeWidth="1.5" />
              <text x={x} y={y - 8} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{pin.label}</text>
            </g>
          )
        })}

        {/* Selected pin */}
        {selectedXY && (
          <g>
            <circle cx={selectedXY.x} cy={selectedXY.y} r={6} fill="#f59e0b" stroke="white" strokeWidth="2" />
            <circle cx={selectedXY.x} cy={selectedXY.y} r={12} fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.5">
              <animate attributeName="r" from="8" to="20" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Target pin (reveal) */}
        {showTarget && targetXY && (
          <g>
            <circle cx={targetXY.x} cy={targetXY.y} r={8} fill="#10b981" stroke="white" strokeWidth="2" />
            <text x={targetXY.x} y={targetXY.y + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">✓</text>
          </g>
        )}
      </svg>
      {hover && (
        <div className="text-center text-xs text-slate-500 mt-1">
          {hover.lat}°, {hover.lng}°
        </div>
      )}
    </div>
  )
}

// Calculate distance in km between two lat/lng points
export function geoDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
