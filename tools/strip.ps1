param([string]$Src, [string]$Dst, [string]$Bands)
# Convierte una hoja en cuadricula en una sola tira horizontal: cada banda "y0,y1" se pega a la derecha de la anterior.
Add-Type -AssemblyName System.Drawing
$img = New-Object System.Drawing.Bitmap($Src)
$ranges = @($Bands.Split(";") | ForEach-Object { , ([int[]]($_.Split(",") | ForEach-Object { [int]$_ })) })
$totalW = $img.Width * $ranges.Count
$maxH = ($ranges | ForEach-Object { $_[1] - $_[0] } | Measure-Object -Maximum).Maximum
$out = New-Object System.Drawing.Bitmap($totalW, $maxH)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.Color]::White)
for ($i = 0; $i -lt $ranges.Count; $i++) {
  $y0 = $ranges[$i][0]; $h = $ranges[$i][1] - $ranges[$i][0]
  $dest = New-Object System.Drawing.Rectangle(($i * $img.Width), 0, $img.Width, $h)
  $srcR = New-Object System.Drawing.Rectangle(0, $y0, $img.Width, $h)
  $g.DrawImage($img, $dest, $srcR, [System.Drawing.GraphicsUnit]::Pixel)
}
$g.Dispose()
$out.Save($Dst, [System.Drawing.Imaging.ImageFormat]::Png)
"$Dst : $totalW x $maxH"
