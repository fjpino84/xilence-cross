param([string]$Dir, [int]$Min = 6, [int]$Max = 60)
# Busca el periodo de un ciclo de animacion en cuadros f_XXXX.png (video de caminar): recorta la zona del personaje, reduce cada cuadro
# y mide cuanto se parece cada cuadro a los siguientes. Imprime los mejores periodos (en cuadros) y la diferencia de cada uno.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.IO; using System.Linq;
public static class Cycle {
  public static string Run(string dir, int min, int max) {
    var files = Directory.GetFiles(dir, "f_*.png").OrderBy(f => f).ToArray(); int n = files.Length;
    var gray = new float[n][]; int W = 0, H = 0; int x0 = int.MaxValue, y0 = int.MaxValue, x1 = 0, y1 = 0; var imgs = new byte[n][]; int iw = 0, ih = 0;
    for (int i = 0; i < n; i++) {
      using (var bmp = new Bitmap(files[i])) {
        iw = bmp.Width; ih = bmp.Height; var d = bmp.LockBits(new Rectangle(0,0,iw,ih), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        var px = new byte[iw*ih*4]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d); imgs[i] = px;
        for (int y = 0; y < ih; y += 2) for (int x = 0; x < iw; x += 2) { int k = (y*iw+x)*4; if (px[k] < 170 && px[k+1] < 170 && px[k+2] < 170) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      }
    }
    x0 = Math.Max(0, x0 - 20); y0 = Math.Max(0, y0 - 20); x1 = Math.Min(iw - 1, x1 + 20); y1 = Math.Min(ih - 1, y1 + 20);
    W = (x1 - x0 + 1) / 4; H = (y1 - y0 + 1) / 4;
    for (int i = 0; i < n; i++) {
      gray[i] = new float[W*H];
      for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { float s = 0; for (int dy = 0; dy < 4; dy++) for (int dx = 0; dx < 4; dx++) { int k = ((y0 + y*4 + dy)*iw + (x0 + x*4 + dx))*4; s += (imgs[i][k] + imgs[i][k+1] + imgs[i][k+2]) / 3f; } gray[i][y*W+x] = s / 16f; }
    }
    var sb = new System.Text.StringBuilder();
    sb.AppendLine("zona del personaje: x " + x0 + "-" + x1 + " y " + y0 + "-" + y1 + " (" + (x1-x0+1) + "x" + (y1-y0+1) + ")");
    var scores = new List<Tuple<int,double>>();
    for (int lag = min; lag <= max && lag < n - 10; lag++) { double sum = 0; int cnt = 0; for (int i = 0; i + lag < n; i++) { double e = 0; for (int p = 0; p < W*H; p++) { double dd = gray[i][p] - gray[i+lag][p]; e += dd*dd; } sum += e / (W*H); cnt++; } scores.Add(Tuple.Create(lag, sum / cnt)); }
    foreach (var s in scores.OrderBy(s => s.Item2).Take(8)) sb.AppendLine("periodo " + s.Item1 + " cuadros: diferencia media " + s.Item2.ToString("F1"));
    // Mejor inicio para ese periodo: el cuadro i cuyo parecido con i+periodo es maximo
    int best = scores.OrderBy(s => s.Item2).First().Item1; double bi = double.MaxValue; int bs = 0;
    for (int i = 0; i + best < n; i++) { double e = 0; for (int p = 0; p < W*H; p++) { double dd = gray[i][p] - gray[i+best][p]; e += dd*dd; } e /= (W*H); if (e < bi) { bi = e; bs = i; } }
    sb.AppendLine("mejor inicio para el periodo " + best + ": cuadro " + (bs + 1) + " (diferencia " + bi.ToString("F1") + ")");
    return sb.ToString();
  }
}
"@
Write-Output ([Cycle]::Run((Resolve-Path $Dir).Path, $Min, $Max))
