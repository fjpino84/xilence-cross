param([string]$Src, [string]$Dst, [int]$MaxHeight = 512, [int]$Threshold = 238, [int]$MinPocket = 0, [double]$ProtectTop = 0.0, [int]$PocketThr = 0, [int]$FadeEdge = 0)
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class Cutout {
  public static void Run(string src, string dst, int maxH, int thr, int minPocket, double protectTop, int pocketThr, int fadeEdge) {
      if (pocketThr <= 0) pocketThr = thr;
    using (var bmp = new Bitmap(src)) {
      int w = bmp.Width, h = bmp.Height;
      var px = new byte[w * h * 4];
      var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);
      bmp.UnlockBits(data);
      var bg = new bool[w * h];
      Func<int, bool> isPocket = i => Math.Min(px[i*4], Math.Min(px[i*4+1], px[i*4+2])) >= pocketThr;
      var q = new Queue<int>();
      Func<int, bool> isBg = i => Math.Min(px[i*4], Math.Min(px[i*4+1], px[i*4+2])) >= thr;
      Action<int> seed = i => { if (!bg[i] && isBg(i)) { bg[i] = true; q.Enqueue(i); } };
      for (int x = 0; x < w; x++) { seed(x); seed((h-1)*w + x); }
      for (int y = 0; y < h; y++) { seed(y*w); seed(y*w + w-1); }
      int[] dx = {1,-1,0,0}, dy = {0,0,1,-1};
      while (q.Count > 0) {
        int i = q.Dequeue(); int cx = i % w, cy = i / w;
        for (int k = 0; k < 4; k++) {
          int nx = cx + dx[k], ny = cy + dy[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          seed(ny*w + nx);
        }
      }
      if (minPocket > 0) {
        var seen = new bool[w * h];
        for (int s = 0; s < w * h; s++) {
          if (bg[s] || seen[s] || !isPocket(s)) continue;
          var comp = new List<int>(); var cq = new Queue<int>(); cq.Enqueue(s); seen[s] = true; long sumY = 0;
          while (cq.Count > 0) {
            int i = cq.Dequeue(); comp.Add(i); sumY += i / w;
            int cx = i % w, cy = i / w;
            for (int k = 0; k < 4; k++) {
              int nx = cx + dx[k], ny = cy + dy[k];
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              int ni = ny*w + nx;
              if (!bg[ni] && !seen[ni] && isPocket(ni)) { seen[ni] = true; cq.Enqueue(ni); }
            }
          }
          double centroid = sumY / (double)comp.Count / h;
          if (comp.Count >= minPocket && centroid >= protectTop) foreach (int i in comp) bg[i] = true;
        }
      }
      // Alfa: fondo = 0; borde = degradado según blancura
      int minX = w, minY = h, maxX = 0, maxY = 0;
      for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
        int i = y*w + x; int o = i*4;
        if (bg[i]) { px[o+3] = 0; continue; }
        bool edge = false;
        for (int yy = Math.Max(0,y-1); yy <= Math.Min(h-1,y+1) && !edge; yy++)
          for (int xx = Math.Max(0,x-1); xx <= Math.Min(w-1,x+1); xx++) if (bg[yy*w+xx]) { edge = true; break; }
        if (edge) {
          int m = Math.Min(px[o], Math.Min(px[o+1], px[o+2]));
          double a = 1.0 - Math.Max(0, m - 190) / (double)(thr - 190 + 1);
          px[o+3] = (byte)Math.Max(0, Math.Min(255, a * 255));
        }
        if (fadeEdge > 0 && px[o+3] > 0) { double d = Math.Min(Math.Min(x, w-1-x), Math.Min(y, h-1-y)); if (d < fadeEdge) px[o+3] = (byte)(px[o+3] * (d / fadeEdge)); }
        if (px[o+3] > 8) { if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y; }
      }
      using (var full = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        var d2 = full.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        System.Runtime.InteropServices.Marshal.Copy(px, 0, d2.Scan0, px.Length);
        full.UnlockBits(d2);
        Console.WriteLine("bbox " + minX + "," + minY + " " + maxX + "," + maxY + " of " + w + "x" + h); var crop = new Rectangle(minX, minY, maxX-minX+1, maxY-minY+1);
        double scale = Math.Min(1.0, maxH / (double)crop.Height);
        int ow = (int)Math.Round(crop.Width * scale), oh = (int)Math.Round(crop.Height * scale);
        using (var outBmp = new Bitmap(ow, oh, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(outBmp)) {
          g.InterpolationMode = InterpolationMode.HighQualityBicubic;
          g.PixelOffsetMode = PixelOffsetMode.HighQuality;
          g.DrawImage(full, new Rectangle(0,0,ow,oh), crop, GraphicsUnit.Pixel);
          outBmp.Save(dst, ImageFormat.Png);
        }
        Console.WriteLine(dst + " -> " + ow + "x" + oh);
      }
    }
  }
}
"@
try { [Cutout]::Run($Src, $Dst, $MaxHeight, $Threshold, $MinPocket, $ProtectTop, $PocketThr, $FadeEdge) } catch { $_.Exception.InnerException.ToString() }
