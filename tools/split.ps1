param([string]$Src, [string]$Out, [string]$Cuts, [int]$Gap = 300)
# Separa los cuadros de una hoja cuyos dibujos se solapan: reparte los pixeles por columnas con cortes inclinados
# y deja un hueco blanco entre columnas, para que extract.ps1 las trate como figuras independientes.
# -Cuts: un corte por columna, separados por ';'. Cada corte es "x" (vertical) o "x0,x1,x2..." (muestras repartidas de arriba a abajo), en
# fracciones del ancho/alto de la hoja (0-1).
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging;
public static class Split {
  public static void Run(string src, string dst, double[][] cuts, int gap) {
    using (var bmp = new Bitmap(src)) {
      int w = bmp.Width, h = bmp.Height, n = cuts.Length + 1;
      var outBmp = new Bitmap(w + gap * (n - 1), h, PixelFormat.Format24bppRgb);
      using (var g = Graphics.FromImage(outBmp)) g.Clear(Color.White);
      for (int y = 0; y < h; y++) {
        double t = y / (double)(h - 1);
        var edge = new double[cuts.Length];
        for (int k = 0; k < cuts.Length; k++) { var c = cuts[k]; double f = t * (c.Length - 1); int i0 = Math.Min(c.Length - 2, (int)f); edge[k] = (c[i0] + (c[i0 + 1] - c[i0]) * (f - i0)) * w; }
        for (int x = 0; x < w; x++) {
          int col = 0; while (col < edge.Length && x >= edge[col]) col++;
          outBmp.SetPixel(x + gap * col, y, bmp.GetPixel(x, y));
        }
      }
      outBmp.Save(dst, ImageFormat.Png); outBmp.Dispose();
    }
  }
}
"@
$list = @()
foreach ($c in $Cuts.Split(';')) { $p = $c.Split(',') | ForEach-Object { [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) }; if ($p.Count -eq 1) { $p = @($p[0], $p[0]) }; $list += ,([double[]]$p) }
[Split]::Run((Resolve-Path $Src).Path, [IO.Path]::GetFullPath($Out), [double[][]]$list, $Gap)
