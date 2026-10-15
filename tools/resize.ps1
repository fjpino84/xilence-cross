param([string]$Src, [string]$Dst, [int]$W = 1376, [int]$H = 768)
Add-Type -AssemblyName System.Drawing
$img = New-Object System.Drawing.Bitmap($Src)
$out = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($img, 0, 0, $W, $H); $g.Dispose()
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
$out.Save($Dst, $codec, $ep); $out.Dispose(); $img.Dispose(); "$Dst ok"
