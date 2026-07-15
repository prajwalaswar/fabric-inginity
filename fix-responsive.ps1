$f = "c:\Users\DELL\Downloads\full-stack-updated\frontend\index.html"
$c = [System.IO.File]::ReadAllText($f)

# Remove the old duplicate media query block (between "/* -- Mobile: full-width fixes --" and the closing "</style>")
# We identify it by its unique comment header
$old = @"

    /* ── Mobile: full-width fixes ── */
    @media (max-width: 1140px) {
      /* mega menu mobile already handled — keep panel columns stacked */
      .mega-panel { flex-direction: column !important; }
      .mega-col   { min-width: 0 !important; width: 100% !important; }
    }

    @media (max-width: 900px) {
      .metric-grid { grid-template-columns: repeat(3, 1fr) !important; }
      .dash-grid   { grid-template-columns: 1fr !important; }
      .dash-grid-2 { grid-template-columns: 1fr !important; }
      .dash-top    { grid-template-columns: 1fr !important; }
    }

    @media (max-width: 760px) {
      .container   { width: min(var(--max), calc(100% - 24px)); }
      .section     { padding: 48px 0; }

      /* grid cols */
      .hero-stats, .grid-4, .grid-3 { grid-template-columns: repeat(2, 1fr); }
      .insta-grid  { grid-template-columns: repeat(2, 1fr); }
      .foot-grid   { grid-template-columns: 1fr; }
      .metric-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .bottom-bar  { grid-template-columns: 1fr; }
      .split       { grid-template-columns: 1fr; }

      /* dashboard */
      .dashboard   { grid-template-columns: 1fr; }
      .dash-side   { position: sticky; top: 0; z-index: 4; min-height: unset; }
      .dash-main   { padding: 12px; }
      .dash-top    { grid-template-columns: 1fr !important; }
      .dash-grid   { grid-template-columns: 1fr !important; }
      .dash-grid-2 { grid-template-columns: 1fr !important; }
      .dash-actions{ flex-wrap: wrap; }

      /* hero */
      .hero-grid   { grid-template-columns: 1fr; }
      .hero-copy h1{ font-size: 2.8rem; }
      .hero-slider { min-height: 320px; }

      /* nav */
      .nav-wrap    { min-height: 62px; }
      .brand span  { display: none; }

      /* product cards */
      .grid-4 .card, .grid-3 .card { font-size: .88rem; }

      /* chat widget */
      #chatWidget  { width: calc(100vw - 24px) !important; right: 12px !important; bottom: 86px !important; }
      #chatLauncher{ right: 12px !important; bottom: 16px !important; width: 52px !important; height: 52px !important; }
      #locationBtn { right: 12px !important; bottom: 78px !important; }
    }

    @media (max-width: 480px) {
      .grid-4, .grid-3 { grid-template-columns: 1fr; }
      .hero-copy h1 { font-size: 2.2rem; }
      .section-head { flex-direction: column; align-items: flex-start; gap: 10px; }
      .metric-grid  { grid-template-columns: 1fr 1fr !important; }
      .cw-tab       { font-size: .68rem; padding: 10px 4px 8px; }
    }
"@

if ($c.Contains($old)) {
    $c = $c.Replace($old, "")
    [System.IO.File]::WriteAllText($f, $c)
    Write-Host "SUCCESS: removed old duplicate media queries"
} else {
    Write-Host "NOT FOUND: string not matched, file unchanged"
    # Try partial match check
    if ($c.Contains("/* ── Mobile: full-width fixes ── */")) {
        Write-Host "PARTIAL: comment found but block differs"
    }
}
