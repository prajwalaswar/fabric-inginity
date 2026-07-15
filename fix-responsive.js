const fs = require("fs");
const path = "c:/Users/DELL/Downloads/full-stack-updated/frontend/index.html";
let html = fs.readFileSync(path, "utf8");

// Find the second @media (max-width: 1140px) block (the old duplicate one with comment "Mobile: full-width fixes")
// Strategy: find its start marker and the closing </style> then remove everything in between those two media blocks

const startMarker = "\n    /* \u2500\u2500 Mobile: full-width fixes \u2500\u2500 */";
const idx = html.indexOf(startMarker);

if (idx === -1) {
  // Try with ASCII dash
  const alt = "/* -- Mobile: full-width fixes -- */";
  const idx2 = html.indexOf(alt);
  console.log(idx2 === -1 ? "NOT FOUND at all" : "Found alt at " + idx2);
  process.exit(0);
}

// Find the last @media (max-width: 480px) block after this marker
const endSearchFrom = idx;
const endBlock = "    }\n  </style>";
const endIdx = html.indexOf(endBlock, endSearchFrom);

if (endIdx === -1) {
  console.log("Could not find end block");
  process.exit(1);
}

// Remove from startMarker to just before </style>
const before = html.substring(0, idx);
const after = html.substring(endIdx + 5); // keep "\n  </style>"
const fixed = before + "\n  </style>" + after;

fs.writeFileSync(path, fixed, "utf8");
console.log("DONE - removed duplicate media queries. File length:", fixed.length);
