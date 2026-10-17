param([string]$Dir, [string]$Filter = "*.png", [int]$Pad = 2)
# Recorta los margenes transparentes de cada PNG (deja una caja ajustada al dibujo), para objetos sueltos como instrumentos.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging;
public static class Trim {
  public static string Run(string path, int pad) {
    Bitmap src; using (var b = new Bitmap(path)) src = new Bitmap(b);
    int w = src.Width, h = src.Height, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (src.GetPixel(x, y).A > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { src.Dispose(); return "vacio"; }
    x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad); x1 = Math.Min(w - 1, x1 + pad); y1 = Math.Min(h - 1, y1 + pad);
    var rect = new Rectangle(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    using (var cropped = src.Clone(rect, PixelFormat.Format32bppArgb)) cropped.Save(path + ".tmp", ImageFormat.Png);
    src.Dispose();
    System.IO.File.Delete(path); System.IO.File.Move(path + ".tmp", path);
    return rect.Width + "x" + rect.Height;
  }
}
"@
foreach ($f in Get-ChildItem $Dir -Filter $Filter) { Write-Output ($f.Name + ": " + [Trim]::Run($f.FullName, $Pad)) }
