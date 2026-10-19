param([string]$File, [string]$Rect)
# Borra (deja transparente) una zona de un PNG. -Rect "x0,y0,x1,y1" en fracciones del ancho/alto (0-1).
Add-Type -AssemblyName System.Drawing
$p = [double[]]($Rect.Split(',') | ForEach-Object { [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) })
$src = New-Object Drawing.Bitmap $File; $bmp = New-Object Drawing.Bitmap $src; $src.Dispose()
$x0 = [int]($p[0] * $bmp.Width); $x1 = [int]($p[2] * $bmp.Width); $y0 = [int]($p[1] * $bmp.Height); $y1 = [int]($p[3] * $bmp.Height)
for ($y = $y0; $y -lt $y1; $y++) { for ($x = $x0; $x -lt $x1; $x++) { $bmp.SetPixel($x, $y, [Drawing.Color]::Transparent) } }
$bmp.Save($File + ".tmp", [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); Move-Item -Force ($File + ".tmp") $File
