# Limpia el borde de los sprites con fondo transparente: quita el halo claro que deja el recorte (restos del fondo blanco)
# pintando de oscuro los píxeles claros pegados al exterior, y suaviza el escalón del borde (antialias de un píxel).
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File tools\defringe.ps1 -Path assets\sprites\eco [-Strength 0.9] [-Soften 0.5] [-Recurse]
param(
  [string[]]$Path = @(),
  [string]$ListFile = "",   # archivo de texto con una ruta por línea (para listas largas)
  [double]$Strength = 0.9,   # cuánto se oscurece un píxel claro del borde (0-1)
  [double]$Soften = 0.5,     # cuánto se suaviza el alfa del borde (0 = nada)
  [int]$Threshold = 110,     # luminosidad (0-255) a partir de la cual un píxel del borde se considera halo
  [int]$Band = 2,            # grosor del borde (píxeles desde el exterior) que se revisa
  [switch]$Recurse
)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging;
public static class Defringe {
  public static bool Run(string file, double strength, double soften, int threshold, int band) {
    Bitmap src;
    using (var original = new Bitmap(file)) src = original.Clone(new Rectangle(0, 0, original.Width, original.Height), PixelFormat.Format32bppArgb);
    int w = src.Width, h = src.Height;
    var data = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride; var buf = new byte[stride * h];
    System.Runtime.InteropServices.Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    // distancia (en píxeles, hasta 'band') de cada píxel al exterior transparente
    var dist = new int[w * h];
    for (int i = 0; i < dist.Length; i++) dist[i] = 99;
    var queue = new System.Collections.Generic.Queue<int>();
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      if (buf[y * stride + x * 4 + 3] < 40) { dist[y * w + x] = 0; queue.Enqueue(y * w + x); }
    }
    int[] dx = { 1, -1, 0, 0 }, dy = { 0, 0, 1, -1 };
    while (queue.Count > 0) {
      int p = queue.Dequeue(); int px = p % w, py = p / w;
      if (dist[p] >= band) continue;
      for (int k = 0; k < 4; k++) {
        int nx = px + dx[k], ny = py + dy[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        int n = ny * w + nx;
        if (dist[n] > dist[p] + 1) { dist[n] = dist[p] + 1; queue.Enqueue(n); }
      }
    }
    var result = (byte[])buf.Clone();
    bool changed = false;
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      int i = y * stride + x * 4; int d = dist[y * w + x];
      int a = buf[i + 3];
      if (a == 0 || d > band) continue;
      // halo: píxel claro en la banda exterior -> se pinta del color del contorno
      double lum = 0.299 * buf[i + 2] + 0.587 * buf[i + 1] + 0.114 * buf[i];
      int sat = Math.Max(buf[i], Math.Max(buf[i + 1], buf[i + 2])) - Math.Min(buf[i], Math.Min(buf[i + 1], buf[i + 2]));
      if (lum > threshold && sat < 70) { // solo blancos y grises: los destellos de color (cian, rojo, amarillo) se respetan
        double t = strength * (d == 0 ? 1.0 : (d == 1 ? 0.9 : 0.5)) * Math.Min(1.0, (lum - threshold) / 60.0 + 0.4);
        result[i] = (byte)(buf[i] + (14 - buf[i]) * t);
        result[i + 1] = (byte)(buf[i + 1] + (12 - buf[i + 1]) * t);
        result[i + 2] = (byte)(buf[i + 2] + (22 - buf[i + 2]) * t);
        changed = true;
      }
      // antialias: el alfa del borde se mezcla con el de sus vecinos
      if (soften > 0 && a > 40) {
        int sum = 0;
        for (int k = 0; k < 4; k++) {
          int nx = x + dx[k], ny = y + dy[k];
          sum += (nx < 0 || ny < 0 || nx >= w || ny >= h) ? 0 : buf[ny * stride + nx * 4 + 3];
        }
        double avg = sum / 4.0;
        double na = a + (avg - a) * soften * (d == 0 ? 0.9 : 0.6);
        if (na < a) { result[i + 3] = (byte)Math.Max(0, na); changed = true; }
      }
    }
    if (changed) {
      System.Runtime.InteropServices.Marshal.Copy(result, 0, data.Scan0, result.Length);
      src.UnlockBits(data);
      string temp = file + ".tmp";
      src.Save(temp, ImageFormat.Png); src.Dispose();
      System.IO.File.Delete(file); System.IO.File.Move(temp, file);
      return true;
    }
    src.UnlockBits(data); src.Dispose();
    return false;
  }
}
"@ -ReferencedAssemblies System.Drawing

$count = 0
if ($ListFile) { $Path += Get-Content $ListFile }
foreach ($p in $Path) {
  $files = if (Test-Path $p -PathType Leaf) { Get-Item $p } else { Get-ChildItem $p -Filter *.png -Recurse:$Recurse }
  foreach ($f in $files) { if ([Defringe]::Run($f.FullName, $Strength, $Soften, $Threshold, $Band)) { $count++ } }
}
Write-Output "Procesados: $count"
