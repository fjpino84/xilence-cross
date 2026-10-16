param([string]$Dir, [string]$Filter = "*.png", [int]$MinLight = 120)
# Quita el blanco del fondo que quedo atrapado en los efectos luminosos (rayos del cetro de Rex Vane).
# Cada pixel claro se trata como "color sobre blanco": se recupera el color puro y su cobertura (alfa), de modo que
# el blanco puro pasa a ser transparente y los bordes rosados se funden con cualquier fondo.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging;
public static class Unmatte {
  public static int Run(string path, int minLight) {
    byte[] px; int w, h;
    using (var bmp = new Bitmap(path)) {
      w = bmp.Width; h = bmp.Height; px = new byte[w*h*4];
      var d = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d);
    }
    int changed = 0;
    for (int i=0;i<w*h;i++){
      int A=px[i*4+3]; if (A<8) continue;
      int B=px[i*4],G=px[i*4+1],R=px[i*4+2]; int mn=Math.Min(R,Math.Min(G,B)), mx=Math.Max(R,Math.Max(G,B));
      if (mn < minLight) continue;                    // oscuro o saturado: cuerpo y trazos de color, no se toca
      // Cobertura: el color puro del rayo es un rosa fuerte (canal minimo ~ 50). Blanco = nada de cobertura.
      double a = (255.0 - mn) / (255.0 - 50.0); if (a < 0.02) { px[i*4+3]=0; changed++; continue; } if (a > 1) a = 1;
      double r = (R - (1-a)*255) / a, g = (G - (1-a)*255) / a, b = (B - (1-a)*255) / a;
      px[i*4+2]=(byte)Math.Max(0,Math.Min(255,r)); px[i*4+1]=(byte)Math.Max(0,Math.Min(255,g)); px[i*4]=(byte)Math.Max(0,Math.Min(255,b));
      px[i*4+3]=(byte)Math.Max(0,Math.Min(255, A*a)); changed++;
    }
    using (var outBmp = new Bitmap(w,h,PixelFormat.Format32bppArgb)) {
      var d = outBmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(px,0,d.Scan0,px.Length); outBmp.UnlockBits(d);
      outBmp.Save(path + ".tmp", ImageFormat.Png);
    }
    System.IO.File.Delete(path); System.IO.File.Move(path + ".tmp", path);
    return changed;
  }
}
"@
foreach ($f in Get-ChildItem $Dir -Filter $Filter | Where-Object { $_.Name -ne 'retrato.png' }) { Write-Output ($f.Name + ": " + [Unmatte]::Run($f.FullName, $MinLight) + " px") }
