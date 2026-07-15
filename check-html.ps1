$html = [System.IO.File]::ReadAllText('c:\Users\DELL\Downloads\full-stack-updated\frontend\index.html')
$sfPos = $html.IndexOf('id="storefront"')
$dashPos = $html.IndexOf('class="dashboard-wrap"')
$bodyEnd = $html.LastIndexOf('</body>')
Write-Host "storefront pos: $sfPos"
Write-Host "dashboard-wrap pos: $dashPos"
Write-Host "body end: $bodyEnd"
Write-Host "HTML length: $($html.Length)"
Write-Host "storefront BEFORE dashboard: $($sfPos -lt $dashPos)"
# Check div balance after storefront opening
$sfSection = $html.Substring($sfPos, [Math]::Min(50000, $html.Length - $sfPos))
$opens = ($sfSection -split '<div' | Measure-Object).Count - 1
$closes = ($sfSection -split '</div>' | Measure-Object).Count - 1
Write-Host "In storefront area: div opens=$opens closes=$closes balance=$($opens - $closes)"
