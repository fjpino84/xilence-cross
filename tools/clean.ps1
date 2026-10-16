param([string]$Dir, [string]$Filter = "*.png", [double]$MinFraction = 0.06, [int]$Reach = 5)
# Quita fragmentos sueltos (restos de las figuras vecinas en el borde del cuadro): conserva la figura principal y las
# piezas cuyo tamano sea al menos -MinFraction de ella, uniendo las que esten a menos de -Reach pixeles.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging;
public static class Clean {
  public static string Run(string path, double minFraction, int reach) {
    byte[] px; int w, h;
    using (var bmp = new Bitmap(path)) {
      w = bmp.Width; h = bmp.Height; px = new byte[w*h*4];
      var d = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d);
    }
    var solid = new bool[w*h]; for (int i=0;i<w*h;i++) solid[i] = px[i*4+3] > 20;
    var near = new bool[w*h];
    for (int y=0;y<h;y++) for (int x=0;x<w;x++) if (solid[y*w+x]) for (int yy=Math.Max(0,y-reach);yy<=Math.Min(h-1,y+reach);yy++) for (int xx=Math.Max(0,x-reach);xx<=Math.Min(w-1,x+reach);xx++) near[yy*w+xx]=true;
    var label = new int[w*h]; var areas = new List<int>{0}; int n = 0;
    for (int s=0;s<w*h;s++){ if(!near[s]||label[s]!=0) continue; n++; areas.Add(0); var q=new Queue<int>(); q.Enqueue(s); label[s]=n;
      while(q.Count>0){ int i=q.Dequeue(); int cx=i%w, cy=i/w; for(int k=0;k<4;k++){ int nx=cx+(k==0?1:k==1?-1:0), ny=cy+(k==2?1:k==3?-1:0); if(nx<0||ny<0||nx>=w||ny>=h) continue; int ni=ny*w+nx; if(near[ni]&&label[ni]==0){label[ni]=n;q.Enqueue(ni);} } } }
    for (int i=0;i<w*h;i++) if (solid[i]) areas[label[i]]++;
    int max=0; for (int l=1;l<=n;l++) max=Math.Max(max,areas[l]);
    int removed=0;
    for (int i=0;i<w*h;i++) if (solid[i] && areas[label[i]] < max*minFraction) { px[i*4+3]=0; removed++; }
    using (var outBmp = new Bitmap(w,h,PixelFormat.Format32bppArgb)) {
      var d = outBmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(px,0,d.Scan0,px.Length); outBmp.UnlockBits(d);
      outBmp.Save(path + ".tmp", ImageFormat.Png);
    }
    System.IO.File.Delete(path); System.IO.File.Move(path + ".tmp", path);
    return removed + " px quitados";
  }
}
"@
foreach ($f in Get-ChildItem $Dir -Filter $Filter) { Write-Output ($f.Name + ": " + [Clean]::Run($f.FullName, $MinFraction, $Reach)) }
