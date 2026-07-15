$html = [System.IO.File]::ReadAllText('c:\Users\DELL\Downloads\full-stack-updated\frontend\index.html')
$lines = $html -split "`n"
$depth = 0
$openLines = New-Object System.Collections.Generic.Stack[int]
for($i=0; $i -lt $lines.Length; $i++){
    $line = $lines[$i]
    # Count div opens (not self-closing)
    $divOpens = ([regex]::Matches($line, '<div[^>]*>(?!</div>)')).Count
    # Count div closes
    $divCloses = ([regex]::Matches($line, '</div>')).Count
    for($j=0; $j -lt $divOpens; $j++) { $openLines.Push($i+1) }
    for($j=0; $j -lt $divCloses; $j++) { if($openLines.Count -gt 0){ $openLines.Pop() | Out-Null } }
}
Write-Host "Unclosed divs remaining: $($openLines.Count)"
$unclosed = $openLines.ToArray()
foreach($ln in $unclosed) {
    Write-Host "  Line $ln : $($lines[$ln-1].Trim().Substring(0,[Math]::Min(120,$lines[$ln-1].Trim().Length)))"
}
