param([string]$Dir, [string]$Mode, [string]$Files = "", [int]$X = 0, [int]$Y = 0, [int]$W = 0, [int]$H = 0, [string]$Out = "", [int]$Fade = 70)
# Preparacion de los cuadros de Rex Vane (Windows PowerShell 5, sin dependencias).
#  -Mode fade : suaviza el borde superior e izquierdo de los cuadros (-Files a.png,b.png) donde la humareda quedo cortada
#               por el borde de la hoja original (quedaba un bloque negro de bordes duros).
#  -Mode crop : recorta -X -Y -W -H de cada fichero de -Files y los pone en fila en -Out (para elegir o generar el retrato).
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging;
public static class RexPrep {
  public static void Fade(string path, int fade) {
    Bitmap bmp; using (var src = new Bitmap(path)) bmp = new Bitmap(src);
    int w = bmp.Width, h = bmp.Height; int minX = w, minY = h;
    for (int y=0;y<h;y++) for (int x=0;x<w;x++) if (bmp.GetPixel(x,y).A > 10) { if (x<minX) minX=x; if (y<minY) minY=y; }
    for (int y=minY;y<Math.Min(h,minY+fade);y++) for (int x=0;x<w;x++) {
      var c = bmp.GetPixel(x,y); if (c.A==0) continue;
      double t = (y-minY)/(double)fade; t = t*t*(3-2*t);
      bmp.SetPixel(x,y,Color.FromArgb((int)(c.A*t), c.R, c.G, c.B)); }
    for (int x=minX;x<Math.Min(w,minX+fade);x++) for (int y=0;y<h;y++) {
      var c = bmp.GetPixel(x,y); if (c.A==0) continue;
      double t = (x-minX)/(double)fade; t = t*t*(3-2*t);
      bmp.SetPixel(x,y,Color.FromArgb((int)(c.A*t), c.R, c.G, c.B)); }
    bmp.Save(path + ".tmp", ImageFormat.Png); bmp.Dispose();
    System.IO.File.Delete(path); System.IO.File.Move(path + ".tmp", path);
  }
}
"@
$list = @($Files.Split(',') | Where-Object { $_ })
if ($Mode -eq 'fade') { foreach ($f in $list) { [RexPrep]::Fade((Join-Path $Dir $f), $Fade); Write-Output "suavizado $f" } }
elseif ($Mode -eq 'crop') {
  $sheet = New-Object Drawing.Bitmap ($W * $list.Count), $H
  $g = [Drawing.Graphics]::FromImage($sheet); $g.Clear([Drawing.Color]::Transparent)
  for ($i = 0; $i -lt $list.Count; $i++) {
    $img = [Drawing.Image]::FromFile((Join-Path $Dir $list[$i]))
    $g.DrawImage($img, (New-Object Drawing.Rectangle ($i * $W), 0, $W, $H), $X, $Y, $W, $H, [Drawing.GraphicsUnit]::Pixel); $img.Dispose()
  }
  $sheet.Save($Out)
}
