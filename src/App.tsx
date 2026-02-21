import { useState, useCallback, useRef } from "react";

// ── WEATHER DATA ──────────────────────────────────────────────────────────────
const WEATHER = {
  STILL: {
    name: "Still",
    description: "The desert landscape is still, untroubled by the susurration of the heavens. Visibility is good.",
    effect: "No special effects. Clear visibility.",
    label: "○",
    color: "#ffffff",
  },
  HAZY: {
    name: "Hazy",
    description: "The air is still, but mists of a lurid hue hang over the desert. Landmarks cannot be seen from a distance.",
    effect: "Visibility impaired. Vigilance checks with disadvantage.",
    label: "≋",
    color: "#7facc0",
  },
  DUST_STORM: {
    name: "Dust Storm",
    description: "The wind blows sheets of blue dust across the desert. Visibility is badly impaired.",
    effect: "Half travel speed. Vigilance checks with disadvantage.",
    label: "⁘",
    color: "#6a90a8",
  },
  SAND_STORM: {
    name: "Sand Storm",
    description: "A howling wind blows a ferocious cloud of azure sand. Nobody travels in Vaarn's sandstorms.",
    effect: "No travel. Seek shelter. Encounters also shelter nearby.",
    label: "⚏",
    color: "#2a58b0",
  },
  HEATWAVE: {
    name: "Heatwave",
    description: "Urth's dying sun musters all the warmth it can.",
    effect: "Double water rations required if traveling.",
    label: "║",
    color: "#3060c0",
  },
  WORM_POLLEN: {
    name: "Worm-pollen",
    description: "Ponderous sticky deluges of sandworm spores drift from the heavens, slowing all movement.",
    effect: "Half travel speed. Each player gains d4 rations.",
    label: "✲",
    color: "#7a9278",
  },
  RAIN: {
    name: "Rain",
    description: "A rare bounty. The parched blue earth is blessed with water. Majestic short-lived flora conquers the desert.",
    effect: "Collect 2d6 days of water rations per member.",
    label: "⌁",
    color: "#2870c8",
  },
  PRISMATIC: {
    name: "Prismatic Tempest",
    description: "The sky bruises with midnight blue. Polychromatic lightning caresses the desert like a jellyfish deity.",
    effect: "No travel. 3d6 electrical damage per hour aboveground.",
    label: "⌬",
    color: "#0808a0",
  },
};

// ── HEX GRID ─────────────────────────────────────────────────────────────────
// Flat-top axial (q, r), radius 3 = 37 hexes total
// d6 directions: 1=NW(0,-1) 2=NE(1,-1) 3=E(1,0) 4=SE(0,1) 5=SW(-1,1) 6=W(-1,0)
const HEX_GRID = {
  // Ring 0
  "0,0":   "STILL",         // #19 Still
  // Ring 1
  "1,0":   "HAZY",          // #20 Hazy
  "1,-1":  "STILL",         // #13 Still
  "0,-1":  "HAZY",          // #12 Hazy
  "-1,0":  "WORM_POLLEN",   // #18 Worm-pollen
  "-1,1":  "DUST_STORM",    // #25 Dust Storm
  "0,1":   "STILL",         // #26 Still
  // Ring 2
  "2,0":   "HAZY",          // #21 Hazy
  "2,-1":  "SAND_STORM",    // #14 Sand Storm
  "2,-2":  "DUST_STORM",    // #8  Dust Storm
  "1,-2":  "STILL",         // #7  Still
  "0,-2":  "HAZY",          // #6  Hazy
  "-1,-1": "HAZY",          // #11 Hazy
  "-2,0":  "WORM_POLLEN",   // #17 Worm-pollen
  "-2,1":  "STILL",         // #24 Still
  "-2,2":  "DUST_STORM",    // #30 Dust Storm
  "-1,2":  "STILL",         // #31 Still
  "0,2":   "SAND_STORM",    // #32 Sand Storm
  "1,1":   "STILL",         // #27 Still
  // Ring 3
  "-2,-1": "DUST_STORM",    // #10 Dust Storm
  "-1,-2": "SAND_STORM",    // #5  Sand Storm
  "0,-3":  "RAIN",          // #1  Rain
  "1,-3":  "DUST_STORM",    // #2  Dust Storm
  "2,-3":  "DUST_STORM",    // #3  Dust Storm
  "3,-3":  "HEATWAVE",      // #4  Heatwave
  "3,-2":  "HEATWAVE",      // #9  Heatwave
  "3,-1":  "HEATWAVE",      // #15 Heatwave
  "3,0":   "HEATWAVE",      // #22 Heatwave
  "2,1":   "STILL",         // #28 Still
  "1,2":   "SAND_STORM",    // #33 Sand Storm
  "0,3":   "PRISMATIC",     // #37 Prismatic Tempest
  "-1,3":  "SAND_STORM",    // #36 Sand Storm
  "-2,3":  "SAND_STORM",    // #35 Sand Storm
  "-3,3":  "STILL",         // #34 Still
  "-3,2":  "STILL",         // #29 Still
  "-3,1":  "WORM_POLLEN",   // #23 Worm-pollen
  "-3,0":  "DUST_STORM",    // #16 Dust Storm
};

// Flat-top direction vectors (axial)
// 1=NW upper-left, 2=N top, 3=NE upper-right, 4=SE lower-right, 5=S bottom, 6=SW lower-left
const DIRS = {
  1: [-1,  0],  // NW  upper-left
  2: [ 0, -1],  // N   top
  3: [ 1, -1],  // NE  upper-right
  4: [ 1,  0],  // SE  lower-right
  5: [ 0,  1],  // S   bottom
  6: [-1,  1],  // SW  lower-left
};

// Flat-top face midpoint angle (degrees) for each direction
// The midpoint of the face shared with the neighbor in that direction
const DIR_FACE_ANGLE = {
  1: 150,   // NW  → left-upper face
  2:  90,   // N   → top face
  3:  30,   // NE  → right-upper face
  4: 330,   // SE  → right-lower face
  5: 270,   // S   → bottom face
  6: 210,   // SW  → left-lower face
};

// Returns pixel coords of the midpoint of a hex face for a given direction
function faceCenter(cx, cy, dir, s = HEX_SIZE) {
  const angle = DIR_FACE_ANGLE[dir] * Math.PI / 180;
  const dist  = s * SQRT3 / 2;   // apothem = distance from center to face midpoint
  return {
    x: cx + dist * Math.cos(angle),
    y: cy + dist * Math.sin(angle),
  };
}
const DIR_LABELS = [
  { d: 1, angle: -150 }, // upper-left
  { d: 2, angle:  -90 }, // top
  { d: 3, angle:  -30 }, // upper-right
  { d: 4, angle:   30 }, // lower-right
  { d: 5, angle:   90 }, // bottom
  { d: 6, angle:  150 }, // lower-left
];



// Exact wrap rules keyed by "q,r,roll" → [destQ, destR]
// Hex numbering (sorted by r then q):
// #2=(1,-3) #3=(2,-3) #4=(3,-3) #5=(-1,-2) #9=(3,-2)
// #10=(-2,-1) #15=(3,-1) #16=(-3,0) #22=(3,0)
// #23=(-3,1) #28=(2,1) #29=(-3,2) #33=(1,2) #34=(-3,3) #35=(-2,3) #36=(-1,3)
const WRAP_RULES = {
  "-1,-2,1":  [ 3, -2],  // cell 5  roll 1 → cell 9
  "1,-3,3":   [-3,  1],  // cell 2  roll 3 → cell 23
  "3,-2,4":   [-1, -2],  // cell 9  roll 4 → cell 5
  "-3,1,6":   [ 1, -3],  // cell 23 roll 6 → cell 2
  "-3,2,1":   [ 1,  2],  // cell 29 roll 1 → cell 33
  "3,-1,3":   [-1,  3],  // cell 15 roll 3 → cell 36
  "1,2,4":    [-3,  2],  // cell 33 roll 4 → cell 29
  "-1,3,6":   [ 3, -1],  // cell 36 roll 6 → cell 15
  "-2,-1,2":  [-2,  3],  // cell 10 roll 2 → cell 35
  "-2,3,5":   [-2, -1],  // cell 35 roll 5 → cell 10
  "2,-3,2":   [ 2,  1],  // cell 3  roll 2 → cell 28
  "2,1,5":    [ 2, -3],  // cell 28 roll 5 → cell 3
  "-3,0,1":   [ 3,  0],  // cell 16 roll 1 → cell 22
  "3,0,4":    [-3,  0],  // cell 22 roll 4 → cell 16
  "-3,3,6":   [ 3, -3],  // cell 34 roll 6 → cell 4
  "3,-3,3":   [-3,  3],  // cell 4  roll 3 → cell 34
};

function inMap(q, r) {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 3;
}

// ── FLAT-TOP HEX GEOMETRY ─────────────────────────────────────────────────────
const HEX_SIZE = 36;
const SQRT3 = Math.sqrt(3);

// Flat-top pixel from axial: x=size*3/2*q, y=size*(sqrt3/2*q + sqrt3*r)
function hexToXY(q, r) {
  return {
    x: HEX_SIZE * 1.5 * q,
    y: HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r),
  };
}

// Flat-top polygon: angles at i×60° (no 30° offset → flat at top/bottom)
function hexPolygon(cx, cy, s = HEX_SIZE) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`;
  }).join(" ");
}

// ── SVG DEFS ──────────────────────────────────────────────────────────────────
function SvgDefs() {
  return (
    <defs>
      <pattern id="pSTILL" width="60" height="40" patternUnits="userSpaceOnUse">
        {/* Sky gradient base */}
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b8dff5" />
            <stop offset="100%" stopColor="#dff2fc" />
          </linearGradient>
        </defs>
        <rect width="60" height="40" fill="url(#skyGrad)" />
        {/* Soft wispy clouds */}
        <ellipse cx="12" cy="14" rx="9" ry="4" fill="white" opacity="0.55" />
        <ellipse cx="18" cy="12" rx="7" ry="3.5" fill="white" opacity="0.45" />
        <ellipse cx="8"  cy="13" rx="5" ry="3"   fill="white" opacity="0.4" />
        <ellipse cx="44" cy="22" rx="10" ry="4.5" fill="white" opacity="0.5" />
        <ellipse cx="51" cy="20" rx="7"  ry="3.5" fill="white" opacity="0.4" />
        <ellipse cx="39" cy="21" rx="5"  ry="3"   fill="white" opacity="0.35" />
        <ellipse cx="28" cy="8"  rx="6"  ry="2.5" fill="white" opacity="0.3" />
        <ellipse cx="33" cy="7"  rx="4"  ry="2"   fill="white" opacity="0.25" />
      </pattern>

      <pattern id="pHAZY" width="30" height="14" patternUnits="userSpaceOnUse">
        <rect width="30" height="14" fill="#aac4d8" />
        <path d="M0,4 Q7.5,0 15,4 Q22.5,8 30,4" stroke="#6a9cb8" strokeWidth="1.6" fill="none" />
        <path d="M0,10 Q7.5,6 15,10 Q22.5,14 30,10" stroke="#6a9cb8" strokeWidth="1.2" fill="none" opacity="0.7" />
      </pattern>

      <pattern id="pDUST_STORM" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect width="9" height="9" fill="#90b2c2" />
        <circle cx="2" cy="2" r="1.2" fill="#4a7090" />
        <circle cx="7" cy="7" r="1.2" fill="#4a7090" />
        <circle cx="7" cy="2" r="0.8" fill="#4a7090" opacity="0.6" />
        <circle cx="2" cy="7" r="0.8" fill="#4a7090" opacity="0.6" />
        <circle cx="4.5" cy="4.5" r="0.5" fill="#4a7090" opacity="0.4" />
      </pattern>

      <pattern id="pSAND_STORM" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#1a3c90" />
        <rect x="0" y="0" width="4" height="4" fill="#2050b0" opacity="0.35" />
        <rect x="4" y="4" width="4" height="4" fill="#2050b0" opacity="0.35" />
      </pattern>

      <pattern id="pHEATWAVE" width="8" height="1" patternUnits="userSpaceOnUse">
        <rect width="8" height="1" fill="#1e3e9a" />
        <rect x="0" width="2.5" height="1" fill="#0c1e60" />
        <rect x="5.5" width="2.5" height="1" fill="#0c1e60" />
      </pattern>

      <pattern id="pWORM_POLLEN" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="#6a8870" />
        <path d="M0,25 Q12,10 25,25 Q38,40 50,25" stroke="#486058" strokeWidth="3" fill="none" opacity="0.8" />
        <path d="M0,38 Q12,23 25,38 Q38,53 50,38" stroke="#8aaa88" strokeWidth="1.8" fill="none" opacity="0.5" />
        <path d="M12,0 Q20,25 12,50" stroke="#a0b898" strokeWidth="2" fill="none" opacity="0.4" />
        <path d="M36,0 Q28,25 36,50" stroke="#486058" strokeWidth="1.2" fill="none" opacity="0.3" />
      </pattern>

      <pattern id="pRAIN" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="#2a72c8" />
        <path d="M0,15 Q12,3 25,15 Q38,27 50,15" stroke="#80c0f0" strokeWidth="3.5" fill="none" opacity="0.9" />
        <path d="M0,30 Q12,18 25,30 Q38,42 50,30" stroke="#60b0e8" strokeWidth="2.5" fill="none" opacity="0.7" />
        <path d="M10,0 Q16,25 10,50" stroke="#c0e4ff" strokeWidth="2.5" fill="none" opacity="0.6" />
        <path d="M32,0 Q26,25 32,50" stroke="#c0e4ff" strokeWidth="1.8" fill="none" opacity="0.4" />
        <circle cx="20" cy="18" r="3" fill="#e0f4ff" opacity="0.3" />
      </pattern>

      <pattern id="pPRISMATIC" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="#04087a" />
        <path d="M0,25 Q12,10 25,25 Q38,40 50,25" stroke="#3858e0" strokeWidth="3" fill="none" opacity="0.9" />
        <path d="M8,0 Q20,15 8,30 Q-4,45 8,60" stroke="#6080ff" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M36,0 Q24,18 36,36" stroke="#9090ff" strokeWidth="1.4" fill="none" opacity="0.5" />
        <circle cx="25" cy="25" r="12" stroke="#4060e0" strokeWidth="0.8" fill="none" opacity="0.4" />
        <circle cx="25" cy="25" r="6" stroke="#8090ff" strokeWidth="0.6" fill="none" opacity="0.35" />
        <path d="M10,10 L40,40" stroke="#7080ff" strokeWidth="0.8" opacity="0.25" />
        <path d="M10,40 L40,10" stroke="#7080ff" strokeWidth="0.8" opacity="0.25" />
      </pattern>

      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

// ── DIE FACE ──────────────────────────────────────────────────────────────────
const DIE_DOTS = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,28],[72,28],[28,50],[72,50],[28,72],[72,72]],
};

function DieFace({ value, rolling }) {
  const dots = value ? DIE_DOTS[value] : [];
  return (
    <svg width="88" height="88" viewBox="0 0 100 100">
      <rect x="4" y="4" width="92" height="92" rx="18"
        fill="#080e38"
        stroke={rolling ? "#5070e0" : "#1c3070"}
        strokeWidth="3"
        style={{ filter: rolling ? "drop-shadow(0 0 10px #3050cc)" : "drop-shadow(0 2px 6px rgba(0,0,20,0.7))", transition: "all 0.1s" }}
      />
      {dots.map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r={rolling ? 6 : 8}
          fill={rolling ? "#5070dd" : "#b0c8f0"}
          style={{ transition: "all 0.1s" }}
        />
      ))}
    </svg>
  );
}

// ── ACCENT / BG COLORS ────────────────────────────────────────────────────────
const ACCENT = {
  STILL:       "#ffffff",
  HAZY:        "#5090b8",
  DUST_STORM:  "#4080a0",
  SAND_STORM:  "#5080e0",
  HEATWAVE:    "#7090ff",
  WORM_POLLEN: "#90b888",
  RAIN:        "#60b8f8",
  PRISMATIC:   "#8090ff",
};
const BG_HEX = {
  STILL:       "#2e2a1a",
  HAZY:        "#122a3a",
  DUST_STORM:  "#101e2e",
  SAND_STORM:  "#080e28",
  HEATWAVE:    "#080e28",
  WORM_POLLEN: "#0e1e14",
  RAIN:        "#061428",
  PRISMATIC:   "#020430",
};

// ── APP ───────────────────────────────────────────────────────────────────────
export default function VaarnWeather() {
  const [pos, setPos]         = useState([0, 0]);
  const [dayRoll, setDayRoll] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [note, setNote]       = useState(null);
  const [history, setHistory] = useState([]);
  const [day, setDay]         = useState(1);
  const [pulse, setPulse]     = useState(false);
  const intervalRef           = useRef(null);

  const weatherKey = HEX_GRID[`${pos[0]},${pos[1]}`];
  const weather    = WEATHER[weatherKey];
  const acc        = ACCENT[weatherKey] || "#8888ff";
  const bg         = BG_HEX[weatherKey]  || "#080820";

  const rollDie = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    setPulse(false);
    setNote(null);

    let ticks = 0;
    const total = 10 + Math.floor(Math.random() * 7);

    intervalRef.current = setInterval(() => {
      setDayRoll(Math.ceil(Math.random() * 6));
      ticks++;
      if (ticks >= total) {
        clearInterval(intervalRef.current);
        const roll = Math.ceil(Math.random() * 6);
        setDayRoll(roll);

        const [q, r] = pos;
        const [dq, dr] = DIRS[roll];
        let newQ = q, newR = r;
        let noteText = "", noteType = "normal";

        {
          const cq = q + dq, cr = r + dr;
          if (inMap(cq, cr)) {
            newQ = cq; newR = cr;
            noteText = `→ Rolled ${roll}`;
          } else {
            const wrapDest = WRAP_RULES[`${q},${r},${roll}`];
            if (wrapDest) {
              [newQ, newR] = wrapDest;
              noteText = `↺ Rolled ${roll} — wraps to opposite edge`;
              noteType = "wrap";
            } else {
              noteText = `⊗ Rolled ${roll} — edge, marker stays put`;
              noteType = "blocked";
            }
          }
        }

        setPos([newQ, newR]);
        setNote({ text: noteText, type: noteType });
        setDay(d => d + 1);
        setHistory(h => [
          { roll, weather: HEX_GRID[`${newQ},${newR}`], noteType },
          ...h,
        ].slice(0, 9));
        setRolling(false);
        setPulse(true);
      }
    }, 65);
  }, [rolling, pos]);

  const reset = () => {
    setPos([0, 0]); setDayRoll(null); setRolling(false);
    setNote(null); setHistory([]); setDay(1); setPulse(false);
  };

  // SVG canvas
  const SVG_W = 530, SVG_H = 500;
  const cx0 = SVG_W / 2 - 14, cy0 = SVG_H / 2 + 8;

  // Stable ordering for hex numbering: sort by r then q
  const orderedHexes = Object.entries(HEX_GRID).sort(([a], [b]) => {
    const [aq, ar] = a.split(",").map(Number);
    const [bq, br] = b.split(",").map(Number);
    return ar !== br ? ar - br : aq - bq;
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(155deg, #040820 0%, #090e3a 55%, #040620 100%)",
      color: "#c0d0ee",
      fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "20px 12px 36px",
      position: "relative", overflow: "hidden",
    }}>

      {/* Starfield */}
      <svg style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", pointerEvents:"none", opacity:0.22, zIndex:0 }}>
        {Array.from({ length: 90 }, (_, i) => (
          <circle key={i} cx={`${(i * 137.7 + 13) % 100}%`} cy={`${(i * 83.1 + 9) % 100}%`}
            r={i % 9 === 0 ? 1.7 : i % 4 === 0 ? 1.1 : 0.65}
            fill="#b0c8ff" opacity={0.15 + (i % 5) * 0.09} />
        ))}
      </svg>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:"16px", position:"relative", zIndex:1 }}>
        <a href="https://vaultsofvaarn.com/" target="_blank" rel="noreferrer"
          style={{ fontSize:"14px", letterSpacing:"7px", color:"#304880", marginBottom:"5px", textDecoration:"none", display:"block", transition:"color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color="#5070b0"}
          onMouseLeave={e => e.currentTarget.style.color="#304880"}>
          VAULTS OF VAARN
        </a>
        <a href="https://mkn-publications.itch.io/" target="_blank" rel="noreferrer"
          style={{ fontSize:"28px", fontWeight:"normal", letterSpacing:"2px", margin:"0 0 0 0", color:"#90b0e0", textShadow:"0 0 30px rgba(70,110,200,0.5)", textDecoration:"none", display:"block", transition:"color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color="#c0d8ff"}
          onMouseLeave={e => e.currentTarget.style.color="#90b0e0"}>
          MKN Desert Weather Oracle 2.7
        </a>
        <div style={{ color:"#2a4070", fontSize:"15px", marginTop:"5px", letterSpacing:"1px" }}>Day {day}</div>
      </div>

      {/* Main layout */}
      <div style={{ display:"flex", gap:"18px", alignItems:"flex-start", flexWrap:"wrap", justifyContent:"center", position:"relative", zIndex:1, width:"100%", maxWidth:"960px" }}>

        {/* Hex Map */}
        <div style={{ background:"rgba(6,10,40,0.75)", border:"1px solid #141e50", borderRadius:"14px", padding:"10px 10px 4px", backdropFilter:"blur(8px)", boxShadow:"0 4px 32px rgba(0,0,20,0.6)" }}>

          <svg width={SVG_W} height={SVG_H} style={{ display:"block" }}>
            <SvgDefs />

            {orderedHexes.map(([key, wKey], idx) => {
              const hexNum = idx + 1;
              const [q, r] = key.split(",").map(Number);
              const { x, y } = hexToXY(q, r);
              const px = cx0 + x, py = cy0 + y;
              const isActive = pos[0] === q && pos[1] === r;
              const isStart  = q === 0 && r === 0;

              return (
                <g key={key}>
                  <polygon points={hexPolygon(px + 1.5, py + 2.5)} fill="rgba(0,0,16,0.45)" />
                  <polygon points={hexPolygon(px, py)} fill={`url(#p${wKey})`}
                    stroke={isActive ? "#ffffff" : "#0e1848"}
                    strokeWidth={isActive ? 2.5 : 1}
                    style={{ transition:"stroke 0.3s" }} />
                  <polygon points={hexPolygon(px, py, HEX_SIZE - 2)}
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                  {isActive && (
                    <polygon points={hexPolygon(px, py, HEX_SIZE + 7)}
                      fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" filter="url(#glow)">
                      <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2.2s" repeatCount="indefinite" />
                    </polygon>
                  )}

                  {/* Hex number — top area */}


                  {/* START label */}
                  {isStart && !isActive && (
                    <text x={px} y={py + 6} textAnchor="middle" fontSize="11" fill="#50688a"
                      letterSpacing="1" fontFamily="Georgia,serif">
                      START
                    </text>
                  )}

                  {isActive && (
                    <g>
                      {pulse && (
                        <circle cx={px} cy={py} r="12" fill="none" stroke="white" strokeWidth="2" opacity="0.9">
                          <animate attributeName="r"       from="12" to="34" dur="1s" fill="freeze" />
                          <animate attributeName="opacity" from="0.9" to="0"  dur="1s" fill="freeze" />
                        </circle>
                      )}
                      <circle cx={px} cy={py} r="11" fill="rgba(255,255,255,0.12)" filter="url(#glow)" />
                      <circle cx={px} cy={py} r="9"  fill="rgba(255,255,255,0.95)" />
                      <circle cx={px} cy={py} r="4.5" fill="#10186a" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Direction key (top-right, flat-top hex) */}
            {(() => {
              const kx = SVG_W - 44, ky = 44;
              return (
                <g>
                  <polygon points={hexPolygon(kx, ky, 26)} fill="rgba(4,8,36,0.92)" stroke="#142058" strokeWidth="1.2" />
                  {DIR_LABELS.map(({ d, angle }) => {
                    const rad = angle * Math.PI / 180;
                    return (
                      <text key={d} x={kx + 17 * Math.cos(rad)} y={ky + 17 * Math.sin(rad) + 3.5}
                        textAnchor="middle" fontSize="11" fill="#4870a8" fontFamily="Georgia,serif">
                        {d}
                      </text>
                    );
                  })}
                  <circle cx={kx} cy={ky} r="3" fill="#182050" />
                </g>
              );
            })()}

            {/* Legend */}
            {Object.entries(WEATHER).map(([key, w], i) => {
              const col = i < 4 ? 0 : 1;
              const row = i % 4;
              const ly = SVG_H - 92 + row * 23;
              if (col === 0) {
                const lx = 12;
                return (
                  <g key={key}>
                    <polygon points={hexPolygon(lx + 9, ly, 9)} fill={`url(#p${key})`} stroke="#0e1848" strokeWidth="0.8" />
                    <text x={lx + 25} y={ly + 4} fontSize="12.5" fill="#506880" fontFamily="Georgia,serif">
                      {w.name}
                    </text>
                  </g>
                );
              } else {
                // Right-aligned: text anchor end, hex swatch to the right of text
                const rx = SVG_W - 12;
                return (
                  <g key={key}>
                    <text x={rx - 25} y={ly + 4} fontSize="12.5" fill="#506880" fontFamily="Georgia,serif" textAnchor="end">
                      {w.name}
                    </text>
                    <polygon points={hexPolygon(rx - 9, ly, 9)} fill={`url(#p${key})`} stroke="#0e1848" strokeWidth="0.8" />
                  </g>
                );
              }
            })}
          </svg>
        </div>

        {/* Right panel — 2-column grid: Weather|Die top row, Rules|Log bottom row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"auto auto", gap:"12px", flexShrink:0, width:"520px" }}>

          {/* Weather card — top-left */}
          <div style={{ background:`linear-gradient(140deg, ${bg} 0%, rgba(6,10,40,0.95) 100%)`, border:`1px solid ${acc}30`, borderRadius:"12px", padding:"18px", transition:"all 0.7s", boxShadow:`0 0 24px ${acc}16` }}>
            <div style={{ fontSize:"13px", letterSpacing:"5px", color:acc, marginBottom:"10px", opacity:0.72 }}>TODAY'S WEATHER</div>
            <div style={{ fontSize:"20px", color:acc, marginBottom:"10px", textShadow:`0 0 18px ${acc}80`, letterSpacing:"0.5px", lineHeight:1.2 }}>
              {weather.name}
            </div>
            <p style={{ fontSize:"13px", lineHeight:"1.8", color:"#6878a0", margin:"0 0 12px", fontStyle:"italic" }}>
              {weather.description}
            </p>
            <div style={{ borderTop:`1px solid ${acc}25`, paddingTop:"10px", fontSize:"12.5px", color:acc, opacity:0.82, lineHeight:1.5 }}>
              ⟶ {weather.effect}
            </div>
          </div>

          {/* Die roller — top-right */}
          <div style={{ background:"rgba(6,10,40,0.85)", border:"1px solid #121a50", borderRadius:"12px", padding:"16px", textAlign:"center" }}>
            <div style={{ fontSize:"13px", letterSpacing:"5px", color:"#2a3a60", marginBottom:"12px" }}>ROLL THE DIE</div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:"12px" }}>
              <DieFace value={dayRoll} rolling={rolling} />
            </div>

            {note && (
              <div style={{ fontSize:"12.5px", marginBottom:"10px", letterSpacing:"0.3px", lineHeight:1.5,
                color: note.type==="blocked" ? "#c08840" : note.type==="wrap" ? "#8060d8" : "#70b8f8",
                transition:"color 0.4s", minHeight:"34px" }}>
                {note.text}
              </div>
            )}

            <button onClick={rollDie} disabled={rolling} style={{
              background: rolling ? "rgba(16,24,70,0.5)" : "linear-gradient(135deg, #142060 0%, #08103c 100%)",
              border: `1px solid ${rolling ? "#0e1840" : "#2a4080"}`,
              color: rolling ? "#2a3a60" : "#90b0e8",
              padding:"10px 0", borderRadius:"8px",
              cursor: rolling ? "default" : "pointer",
              fontSize:"13px", letterSpacing:"4px", width:"100%",
              fontFamily:"inherit", transition:"all 0.2s",
            }}>
              {rolling ? "ROLLING…" : "ROLL FOR DAY"}
            </button>

            <button onClick={reset} style={{
              background:"transparent", border:"none", color:"#1a2650",
              padding:"8px 0", cursor:"pointer", fontSize:"13px",
              letterSpacing:"3px", marginTop:"4px", width:"100%",
              fontFamily:"inherit", transition:"color 0.2s",
            }}
              onMouseEnter={e => e.target.style.color="#3a5090"}
              onMouseLeave={e => e.target.style.color="#1a2650"}>
              RESET EXPEDITION
            </button>
          </div>

          {/* Rules reminder — bottom-left */}
          <div style={{ background:"rgba(4,8,28,0.7)", border:"1px solid #0c1240", borderRadius:"10px",
            padding:"12px 14px", fontSize:"12.5px", color:"#283050", lineHeight:"1.85", alignSelf:"start" }}>
            <div style={{ color:"#1a2848", letterSpacing:"3px", fontSize:"13px", marginBottom:"6px" }}>RULES REFERENCE</div>
            <div>↺ Specific rolls wrap to opposite edge</div>
            <div>⊗ Other off-edge rolls: marker stays put</div>
            <div>◉ White disc = current hex</div>
          </div>

          {/* History — bottom-right */}
          {history.length > 0 ? (
            <div style={{ background:"rgba(6,10,40,0.8)", border:"1px solid #121a50", borderRadius:"12px", padding:"14px", alignSelf:"start" }}>
              <div style={{ fontSize:"13px", letterSpacing:"5px", color:"#2a3a60", marginBottom:"10px" }}>EXPEDITION LOG</div>
              {history.map((h, i) => {
                const w = WEATHER[h.weather];
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"5px 0",
                    borderBottom: i < history.length-1 ? "1px solid #090e30" : "none",
                    opacity: Math.max(0.25, 1 - i * 0.1) }}>
                    <div style={{ width:"22px", height:"22px", background:"#080c28", border:"1px solid #1a2248",
                      borderRadius:"5px", display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"15px", color:"#4868a0", flexShrink:0 }}>
                      {h.roll}
                    </div>
                    <div style={{ fontSize:"14px", color:"#2e3e60" }}>
                      {h.noteType==="blocked" ? "⊗" : h.noteType==="wrap" ? "↺" : "→"}
                    </div>
                    <div style={{ fontSize:"15px", color: ACCENT[h.weather] || "#6878b0" }}>
                      {w?.name}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div />}
        </div>
      </div>

      <div style={{ marginTop:"22px", fontSize:"15px", letterSpacing:"4px", color:"#0e1628", textAlign:"center", position:"relative", zIndex:1 }}>
        <a href="https://vaultsofvaarn.com/" target="_blank" rel="noreferrer"
          style={{ color:"#0e1628", textDecoration:"none", transition:"color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color="#304880"}
          onMouseLeave={e => e.currentTarget.style.color="#0e1628"}>
          VAULTS OF VAARN
        </a>
        {" · "}
        <a href="https://mkn-publications.itch.io/" target="_blank" rel="noreferrer"
          style={{ color:"#0e1628", textDecoration:"none", transition:"color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color="#304880"}
          onMouseLeave={e => e.currentTarget.style.color="#0e1628"}>
          MKN DESERT WEATHER ORACLE 2.7
        </a>
      </div>
    </div>
  );
}
