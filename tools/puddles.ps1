param([string]$Src, [int]$Merge = 14)
# Detecta los charcos luminosos del suelo (cian/verde brillante) y devuelve elipses normalizadas (0-1) y su color medio.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Text;
public static class Puddles {
  public static string Run(string src, int merge) {
    using (var full = new Bitmap(src)) {
      int w = 688, h = (int)Math.Round(688.0 * full.Height / full.Width);
      using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        using (var g = Graphics.FromImage(bmp)) { g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear; g.DrawImage(full, 0, 0, w, h); }
        var px = new byte[w*h*4];
        var d = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d);
        var mask = new bool[w*h];
        int yMin = (int)(h * 0.52);
        for (int y = yMin; y < h; y++) for (int x = 0; x < w; x++) {
          int o = (y*w+x)*4; int B=px[o], G=px[o+1], R=px[o+2];
          // agua luminosa: verde/cian vivo (el reflejo rojo/rosa del charco se une por cercania)
          if (G > 130 && B > 90 && R < 150 && G - R > 55) mask[y*w+x] = true;
        }
        // une trozos cercanos (dilatacion cuadrada)
        var dil = new bool[w*h];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (mask[y*w+x]) {
          for (int yy = Math.Max(0,y-merge); yy <= Math.Min(h-1,y+merge); yy++) for (int xx = Math.Max(0,x-merge); xx <= Math.Min(w-1,x+merge); xx++) dil[yy*w+xx] = true;
        }
        var seen = new bool[w*h]; var sb = new StringBuilder(); int count = 0;
        int[] dx = {1,-1,0,0,1,1,-1,-1}, dy = {0,0,1,-1,1,-1,1,-1};
        for (int s = 0; s < w*h; s++) {
          if (!dil[s] || seen[s]) continue;
          var q = new Queue<int>(); q.Enqueue(s); seen[s] = true; int area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0; double sr=0,sg=0,sbb=0;
          while (q.Count > 0) { int i = q.Dequeue(); int cx = i%w, cy = i/w;
            if (mask[i]) { area++; if(cx<x0)x0=cx; if(cx>x1)x1=cx; if(cy<y0)y0=cy; if(cy>y1)y1=cy; sr+=px[i*4+2]; sg+=px[i*4+1]; sbb+=px[i*4]; }
            for (int k=0;k<8;k++){ int nx=cx+dx[k], ny=cy+dy[k]; if(nx<0||ny<0||nx>=w||ny>=h) continue; int ni=ny*w+nx; if(dil[ni]&&!seen[ni]){seen[ni]=true;q.Enqueue(ni);} } }
          if (area < 90) continue;
          double fx = (x0+x1)/2.0/w, fy = (y0+y1)/2.0/h, rx = (x1-x0+1)/2.0/w, ry = (y1-y0+1)/2.0/h;
          if (count++ > 0) sb.Append(",\n");
          sb.AppendFormat("      {{ x: {0:F3}, y: {1:F3}, rx: {2:F3}, ry: {3:F3}, color: '#{4:x2}{5:x2}{6:x2}' }}", fx, fy, rx, ry, (int)(sr/area), (int)(sg/area), (int)(sbb/area));
        }
        return sb.ToString();
      }
    }
  }
}
"@
try { [Puddles]::Run($Src, $Merge) } catch { $_.Exception.InnerException.ToString() }
