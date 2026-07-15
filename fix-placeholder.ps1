$f = "c:\Users\DELL\Downloads\full-stack-updated\frontend\index.html"
$c = [System.IO.File]::ReadAllText($f)
$c = $c.Replace('placeholder="owner@fabricinfinity.com"', 'placeholder="fabricinfinity.in@gmail.com"')
[System.IO.File]::WriteAllText($f, $c)
Write-Host "Done"
