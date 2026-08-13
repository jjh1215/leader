// Corner-rounding (fillet) geometry for straight-line pattern pieces.
// All coordinates are plain {x, y} numbers in millimeters.

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y)
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len }
}

function fmt(n) {
  return Number(n.toFixed(4))
}

// Computes the rounded-corner (fillet) geometry replacing the sharp corner at C,
// given the previous point P and next point N along the path, for a requested radius.
// Returns null when there is nothing to fillet: radius <= 0, a zero-length adjacent
// segment, or a near-straight-through vertex (no real corner to round).
export function computeFillet(P, C, N, requestedRadius) {
  if (!requestedRadius || requestedRadius <= 0) return null
  const d1 = dist(C, P)
  const d2 = dist(C, N)
  if (d1 === 0 || d2 === 0) return null

  const u1 = normalize({ x: P.x - C.x, y: P.y - C.y })
  const u2 = normalize({ x: N.x - C.x, y: N.y - C.y })
  const dot = Math.min(1, Math.max(-1, u1.x * u2.x + u1.y * u2.y))
  const theta = Math.acos(dot) // angle P-C-N, in (0, π]

  if (theta >= Math.PI - 1e-9) return null // nearly straight through: no real corner
  const halfTan = Math.tan(theta / 2)
  if (halfTan <= 1e-9) return null // hairpin degenerate

  let radius = requestedRadius
  let t = radius / halfTan
  // Clamp so the fillet never eats past the midpoint of either adjacent segment.
  const maxT = Math.min(d1, d2) * 0.999
  if (t > maxT) {
    t = maxT
    radius = t * halfTan
  }

  const p1 = { x: C.x + u1.x * t, y: C.y + u1.y * t }
  const p2 = { x: C.x + u2.x * t, y: C.y + u2.y * t }

  const bisector = normalize({ x: u1.x + u2.x, y: u1.y + u2.y })
  const centerDist = radius / Math.sin(theta / 2)
  const center = { x: C.x + bisector.x * centerDist, y: C.y + bisector.y * centerDist }

  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x)
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x)
  let angleDelta = a2 - a1
  while (angleDelta <= -Math.PI) angleDelta += 2 * Math.PI
  while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI
  // |angleDelta| = π - theta, always < π, so the corner fillet is always a minor arc.
  const sweepFlag = angleDelta > 0 ? 1 : 0

  return { p1, p2, center, radius, largeArcFlag: 0, sweepFlag, startAngle: a1, angleDelta }
}

function verticesFillets(vertices, closed) {
  const n = vertices.length
  return vertices.map((v, i) => {
    if (!closed && (i === 0 || i === n - 1)) return null
    const prev = vertices[(i - 1 + n) % n]
    const next = vertices[(i + 1) % n]
    return computeFillet(prev.point, v.point, next.point, v.cornerRadius || 0)
  })
}

// Builds an SVG path `d` string for a vertex polyline, rounding corners with
// cornerRadius > 0 into tangent arcs. `vertices`: [{ point: {x,y}, cornerRadius }].
export function verticesToPathD(vertices, closed) {
  const n = vertices.length
  if (n < 2) return ''

  const fillets = verticesFillets(vertices, closed)
  const entryPoint = (i) => (fillets[i] ? fillets[i].p1 : vertices[i].point)

  const start = entryPoint(0)
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`

  for (let i = 0; i < n; i++) {
    const f = fillets[i]
    if (f) {
      d += ` L ${fmt(f.p1.x)} ${fmt(f.p1.y)}`
      d += ` A ${fmt(f.radius)} ${fmt(f.radius)} 0 ${f.largeArcFlag} ${f.sweepFlag} ${fmt(f.p2.x)} ${fmt(f.p2.y)}`
    } else {
      d += ` L ${fmt(vertices[i].point.x)} ${fmt(vertices[i].point.y)}`
    }
  }

  if (closed) d += ' Z'
  return d
}

// Approximates the (possibly filleted) shape as a dense polygon of {x,y} points,
// for feeding into the offset engine. arcSamples = points used per rounded corner.
export function flattenToPolygon(vertices, closed, arcSamples = 16) {
  const n = vertices.length
  if (n < 2) return vertices.map((v) => ({ x: v.point.x, y: v.point.y }))

  const fillets = verticesFillets(vertices, closed)
  const points = []
  const pushPoint = (p) => {
    const last = points[points.length - 1]
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1e-9) points.push(p)
  }

  for (let i = 0; i < n; i++) {
    const f = fillets[i]
    if (f) {
      pushPoint(f.p1)
      for (let k = 1; k <= arcSamples; k++) {
        const angle = f.startAngle + (f.angleDelta * k) / arcSamples
        pushPoint({
          x: f.center.x + f.radius * Math.cos(angle),
          y: f.center.y + f.radius * Math.sin(angle),
        })
      }
    } else {
      pushPoint(vertices[i].point)
    }
  }

  return points
}
