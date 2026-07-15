$f = "c:\Users\DELL\Downloads\full-stack-updated\frontend\index.html"
$c = [System.IO.File]::ReadAllText($f)
$c = $c -replace '"assets/WhatsApp Image ([0-9-]+) at ([0-9.]+) ([AP]M) \(([0-9]+)\)\.jpeg"', '"assets/WhatsApp-Image-$1-at-$2-$3-$4.jpeg"'
$c = $c -replace '"assets/WhatsApp Image ([0-9-]+) at ([0-9.]+) ([AP]M)\.jpeg"', '"assets/WhatsApp-Image-$1-at-$2-$3.jpeg"'
[System.IO.File]::WriteAllText($f, $c)
Write-Host "Done"
$rem = (Select-String -Path $f -Pattern '"assets/WhatsApp Image' -AllMatches).Count
Write-Host "Remaining old refs: $rem"
