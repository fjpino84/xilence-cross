param([string]$Dir, [string]$Out, [int]$From, [int]$Count, [int]$Every = 1, [string]$Crop = "0,0,0,0", [int]$Gap = 80)
# Coloca en una sola fila (sobre blanco) los cuadros f_XXXX.png elegidos: -From = primero, -Count = cuantos, -Every = salto entre ellos,
# -Crop "x,y,ancho,alto" = zona a recortar de cada cuadro. Despues se pasa por extract.ps1 (-Rows 1) para quitar el fondo y alinear los pies.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging;
public static class FramesRow {
  public static string Run(string dir, string dst, int from, int count, int every, int[] c, int gap) {
    int w = gap + count * (c[2] + gap), h = c[3] + 2 * gap;
    using (var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
      using (var g = Graphics.FromImage(bmp)) {
        g.Clear(Color.White);
        for (int k = 0; k < count; k++) {
          string file = System.IO.Path.Combine(dir, "f_" + (from + k * every).ToString("D4") + ".png");
          using (var img = new Bitmap(file)) g.DrawImage(img, new Rectangle(gap + k * (c[2] + gap), gap, c[2], c[3]), c[0], c[1], c[2], c[3], GraphicsUnit.Pixel);
        }
      }
      bmp.Save(dst, ImageFormat.Png);
    }
    return count + " cuadros -> " + w + "x" + h;
  }
}
"@
$c = [int[]]($Crop.Split(',') | ForEach-Object { [int]$_ })
Write-Output ([FramesRow]::Run((Resolve-Path $Dir).Path, [IO.Path]::GetFullPath($Out), $From, $Count, $Every, $c, $Gap))
