param([string]$Source, [string]$Out, [int]$Cols = 3, [int]$Rows = 2, [int]$Inset = 8, [int]$Gap = 60)
# Corta una hoja con cuadricula de celdas iguales (una pose por celda). Quita el borde de cada celda (-Inset px) y las coloca
# separadas sobre fondo blanco en -Out; despues se pasa por extract.ps1 (con -Rows) para recortar y alinear los pies.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging;
public static class GridCut {
  public static string Run(string src, string dst, int cols, int rows, int inset, int gap) {
    using (var img = new Bitmap(src)) {
      int cw = img.Width / cols, ch = img.Height / rows;
      int sw = cw - 2 * inset, sh = ch - 2 * inset;
      int w = (sw + gap) * cols, h = (sh + gap) * rows;
      using (var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
        using (var g = Graphics.FromImage(bmp)) {
          g.Clear(Color.White);
          for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++) {
            var from = new Rectangle(c * cw + inset, r * ch + inset, sw, sh);
            var to = new Rectangle(c * (sw + gap) + gap / 2, r * (sh + gap) + gap / 2, sw, sh);
            g.DrawImage(img, to, from.X, from.Y, from.Width, from.Height, GraphicsUnit.Pixel);
          }
        }
        bmp.Save(dst, ImageFormat.Png);
      }
      return "celdas " + cw + "x" + ch + " -> hoja " + w + "x" + h;
    }
  }
}
"@
Write-Output ([GridCut]::Run((Resolve-Path $Source).Path, [IO.Path]::GetFullPath($Out), $Cols, $Rows, $Inset, $Gap))
