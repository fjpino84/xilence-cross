param([string]$Src, [string]$OutPrefix, [double]$Scale = 0.5, [int]$Threshold = 238, [int]$PocketThr = 250,
      [int]$MinPocket = 300, [int]$Dilate = 24, [int]$MinArea = 40000, [int]$Rows = 1, [int]$DarkLimit = 130,
      [int]$AttachDist = 140, [string]$Erase = "", [switch]$Matte, [switch]$GroundLine, [string]$Order = "")
# Separa cada cuadro de una hoja como figura independiente (componente conexa con fusion de piezas cercanas),
# los ordena por filas y los deja en un lienzo comun alineados por los pies (x = centro de la armadura oscura).
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Drawing2D; using System.Drawing.Imaging;
public static class Extract {
  public static void Run(string src, string prefix, double scale, int thr, int pocketThr, int minPocket, int dilate, int minArea, int rows, int darkLimit, int attachDist, bool matte, bool groundLine, int[] order, int[][] erase) {
    using (var bmp = new Bitmap(src)) {
      int w = bmp.Width, h = bmp.Height; var px = new byte[w*h*4];
      var d = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d);
      Func<int,int,bool> white = (i,t) => Math.Min(px[i*4], Math.Min(px[i*4+1], px[i*4+2])) >= t;
      var bg = new bool[w*h]; var q = new Queue<int>();
      Action<int> seed = i => { if (!bg[i] && white(i, thr)) { bg[i] = true; q.Enqueue(i); } };
      for (int x=0;x<w;x++){seed(x);seed((h-1)*w+x);} for(int y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
      int[] dx4={1,-1,0,0}, dy4={0,0,1,-1};
      while(q.Count>0){int i=q.Dequeue();int cx=i%w,cy=i/w;for(int k=0;k<4;k++){int nx=cx+dx4[k],ny=cy+dy4[k];if(nx>=0&&ny>=0&&nx<w&&ny<h)seed(ny*w+nx);}}
      // huecos blancos cerrados
      var seen = new bool[w*h];
      for (int s=0;s<w*h;s++){ if(bg[s]||seen[s]||!white(s,pocketThr)) continue; var comp=new List<int>(); var cq=new Queue<int>(); cq.Enqueue(s); seen[s]=true;
        while(cq.Count>0){int i=cq.Dequeue();comp.Add(i);int cx=i%w,cy=i/w;for(int k=0;k<4;k++){int nx=cx+dx4[k],ny=cy+dy4[k];if(nx<0||ny<0||nx>=w||ny>=h)continue;int ni=ny*w+nx;if(!bg[ni]&&!seen[ni]&&white(ni,pocketThr)){seen[ni]=true;cq.Enqueue(ni);}}}
        if (comp.Count>=minPocket) foreach(int i in comp) bg[i]=true; }
      var fg = new bool[w*h]; for (int i=0;i<w*h;i++) fg[i]=!bg[i];
      foreach (var r in erase) for (int y=Math.Max(0,r[1]); y<=Math.Min(h-1,r[3]); y++) for (int x=Math.Max(0,r[0]); x<=Math.Min(w-1,r[2]); x++) { fg[y*w+x]=false; }

      // Linea de sombra bajo los pies (franja oscura, muy fina, que cruza varios cuadros): se quita
      if (groundLine) {
        var vrun = new int[w*h];
        for (int x=0;x<w;x++){ int run=0; for(int y=0;y<h;y++){ if(fg[y*w+x]) run++; else { for(int k=1;k<=run;k++) vrun[(y-k)*w+x]=run; run=0; } } if(run>0) for(int k=1;k<=run;k++) vrun[(h-k)*w+x]=run; }
        for (int y=0;y<h;y++){ int x=0; while(x<w){ if(fg[y*w+x] && vrun[y*w+x]<=12){ int x0=x; while(x<w && fg[y*w+x] && vrun[y*w+x]<=12) x++; if(x-x0>=60) for(int xx=x0;xx<x;xx++) fg[y*w+xx]=false; } else x++; } }
      }

      // Dilatacion cuadrada separable para fusionar piezas cercanas (martillo suelto, chispas)
      var hd = new bool[w*h]; var dil = new bool[w*h];
      for (int y=0;y<h;y++){ var pre=new int[w+1]; for(int x=0;x<w;x++) pre[x+1]=pre[x]+(fg[y*w+x]?1:0); for(int x=0;x<w;x++){ int a=Math.Max(0,x-dilate), b=Math.Min(w-1,x+dilate); hd[y*w+x]=pre[b+1]-pre[a]>0; } }
      for (int x=0;x<w;x++){ var pre=new int[h+1]; for(int y=0;y<h;y++) pre[y+1]=pre[y]+(hd[y*w+x]?1:0); for(int y=0;y<h;y++){ int a=Math.Max(0,y-dilate), b=Math.Min(h-1,y+dilate); dil[y*w+x]=pre[b+1]-pre[a]>0; } }
      var label = new int[w*h]; int n = 0; var areas = new List<int>{0};
      int[] dx8={1,-1,0,0,1,1,-1,-1}, dy8={0,0,1,-1,1,-1,1,-1};
      for (int s=0;s<w*h;s++){ if(!dil[s]||label[s]!=0) continue; n++; var cq=new Queue<int>(); cq.Enqueue(s); label[s]=n;
        while(cq.Count>0){int i=cq.Dequeue();int cx=i%w,cy=i/w;for(int k=0;k<8;k++){int nx=cx+dx8[k],ny=cy+dy8[k];if(nx<0||ny<0||nx>=w||ny>=h)continue;int ni=ny*w+nx;if(dil[ni]&&label[ni]==0){label[ni]=n;cq.Enqueue(ni);}}}
        areas.Add(0); }
      for (int i=0;i<w*h;i++) if (fg[i] && label[i]!=0) areas[label[i]]++;
      var cx0=new int[n+1]; var cy0=new int[n+1]; var cx1=new int[n+1]; var cy1=new int[n+1];
      for (int l=0;l<=n;l++){cx0[l]=w;cy0[l]=h;cx1[l]=0;cy1[l]=0;}
      for (int i=0;i<w*h;i++){ if(!fg[i]) continue; int l=label[i]; if(l==0) continue; int x=i%w,y=i/w; if(x<cx0[l])cx0[l]=x; if(x>cx1[l])cx1[l]=x; if(y<cy0[l])cy0[l]=y; if(y>cy1[l])cy1[l]=y; }
      var keepIds = new List<int>(); for (int l=1;l<=n;l++) if (areas[l]>=minArea) keepIds.Add(l);
      // piezas sueltas (martillo lanzado, chispas, humo) se pegan a la figura principal mas cercana
      var parent = new int[n+1]; int attached=0, dropped=0;
      foreach (int p in keepIds) parent[p]=p;
      for (int l=1;l<=n;l++){ if(parent[l]!=0||areas[l]<150) continue; int best=0; double bd=double.MaxValue;
        foreach (int p in keepIds){ double gx=Math.Max(0,Math.Max(cx0[p]-cx1[l],cx0[l]-cx1[p])), gy=Math.Max(0,Math.Max(cy0[p]-cy1[l],cy0[l]-cy1[p])); double dd=Math.Sqrt(gx*gx+gy*gy); if(dd<bd){bd=dd;best=p;} }
        if (best!=0 && bd<=attachDist){ parent[l]=best; attached++; } else dropped++; }
      for (int i=0;i<w*h;i++) if (fg[i] && label[i]!=0) label[i]=parent[label[i]];
      Console.WriteLine("figuras: " + keepIds.Count + " | piezas pegadas: " + attached + " | descartadas: " + dropped);

      // Caja y centro de cada figura
      int m = keepIds.Count; var bx0=new int[m]; var by0=new int[m]; var bx1=new int[m]; var by1=new int[m];
      for (int c=0;c<m;c++){ bx0[c]=w; by0[c]=h; bx1[c]=0; by1[c]=0; }
      var idx = new Dictionary<int,int>(); for (int c=0;c<m;c++) idx[keepIds[c]]=c;
      for (int i=0;i<w*h;i++){ if(!fg[i]) continue; int l=label[i]; int c; if(l==0||!idx.TryGetValue(l,out c)) continue; int x=i%w,y=i/w; if(x<bx0[c])bx0[c]=x; if(x>bx1[c])bx1[c]=x; if(y<by0[c])by0[c]=y; if(y>by1[c])by1[c]=y; }
      // Orden de lectura: filas (separadas por el mayor hueco vertical) y luego de izquierda a derecha
      var ord = new List<int>(); for (int c=0;c<m;c++) ord.Add(c);
      ord.Sort((a,b)=> ((by0[a]+by1[a])/2).CompareTo((by0[b]+by1[b])/2));
      var rowOf = new int[m];
      if (rows > 1 && m > 1) { int split = 0; double bestGap = -1; for (int k=1;k<m;k++){ double gap=((by0[ord[k]]+by1[ord[k]])/2.0)-((by0[ord[k-1]]+by1[ord[k-1]])/2.0); if(gap>bestGap){bestGap=gap;split=k;} } for (int k=0;k<m;k++) rowOf[ord[k]] = k>=split ? 1 : 0; }
      var final = new List<int>(); for (int c=0;c<m;c++) final.Add(c);
      final.Sort((a,b)=> rowOf[a]!=rowOf[b] ? rowOf[a].CompareTo(rowOf[b]) : ((bx0[a]+bx1[a])/2).CompareTo((bx0[b]+bx1[b])/2));
      if (order != null && order.Length > 0) { var re = new List<int>(); foreach (int o in order) re.Add(final[o-1]); final = re; }

      // Anclas: pies (fila inferior con armadura oscura) y x medio de la armadura oscura de la mitad inferior
      int f = final.Count; var ax=new double[f]; var fy=new int[f];
      for (int k=0;k<f;k++){ int c=final[k]; int id=keepIds[c];
        var rowCount = new int[h]; double sum=0; int cnt=0; int yLow = by0[c] + (int)((by1[c]-by0[c])*0.5);
        for (int y=by0[c]; y<=by1[c]; y++) for (int x=bx0[c]; x<=bx1[c]; x++){ int i=y*w+x; if(!fg[i]||label[i]!=id) continue; int mean=(px[i*4]+px[i*4+1]+px[i*4+2])/3; if(mean<darkLimit){ rowCount[y]++; if(y>=yLow){sum+=x;cnt++;} } }
        int feet=by1[c]; for (int y=by1[c]; y>=by0[c]; y--) if (rowCount[y]>=14){ feet=y; break; }
        fy[k]=feet; ax[k]= cnt>0 ? sum/cnt : (bx0[c]+bx1[c])/2.0;
      }
      int maxL=0,maxR=0,maxU=0,maxD=0;
      for (int k=0;k<f;k++){ int c=final[k]; maxL=Math.Max(maxL,(int)(ax[k]-bx0[c])+2); maxR=Math.Max(maxR,(int)(bx1[c]-ax[k])+2); maxU=Math.Max(maxU,fy[k]-by0[c]+2); maxD=Math.Max(maxD,Math.Max(0,by1[c]-fy[k])+2); }
      int cw=maxL+maxR+1, ch=maxU+maxD+1; int ow=(int)Math.Round(cw*scale), oh=(int)Math.Round(ch*scale);
      Console.WriteLine("lienzo comun: " + ow + "x" + oh + " | pies en y=" + (int)Math.Round(maxU*scale) + " (fraccion " + ((maxU+0.0)/ch).ToString("F4", System.Globalization.CultureInfo.InvariantCulture) + ") | centro en x=" + (int)Math.Round(maxL*scale) + " (fraccion " + ((maxL+0.0)/cw).ToString("F4", System.Globalization.CultureInfo.InvariantCulture) + ")");
      for (int k=0;k<f;k++){ int c=final[k]; int id=keepIds[c];
        Console.WriteLine("cuadro " + (k+1) + ": x " + bx0[c] + "-" + bx1[c] + " y " + by0[c] + "-" + by1[c] + " caja " + (bx1[c]-bx0[c]+1) + "x" + (by1[c]-by0[c]+1) + " | alto pies-cabeza " + (fy[k]-by0[c]) + " | fila " + rowOf[c]);
        var o = new byte[cw*ch*4];
        for (int y=0;y<ch;y++) for (int x=0;x<cw;x++){
          int sx=(int)Math.Round(ax[k])-maxL+x, sy=fy[k]-maxU+y; if(sx<0||sx>=w||sy<0||sy>=h) continue;
          int i=sy*w+sx; if(!fg[i]||label[i]!=id) continue;
          int so=i*4, oo=(y*cw+x)*4; int B=px[so],G=px[so+1],R=px[so+2]; o[oo]=(byte)B; o[oo+1]=(byte)G; o[oo+2]=(byte)R;
          bool edge=false; for(int yy=Math.Max(0,sy-1);yy<=Math.Min(h-1,sy+1)&&!edge;yy++)for(int xx=Math.Max(0,sx-1);xx<=Math.Min(w-1,sx+1);xx++){int j=yy*w+xx; if(!fg[j]||label[j]!=id){edge=true;break;}}
          double a=1.0; int mn=Math.Min(B,Math.Min(G,R)); int mx=Math.Max(B,Math.Max(G,R));
          if(edge){ a=1.0-Math.Max(0,mn-190)/(double)(thr-190+1); }
          // brillos de color sobre blanco (estelas, chispas, polvo luminoso): se vuelven translucidos para fundirse con el fondo
          if (matte && mx-mn>60 && mn>=90) { double ga=1.0-mn/255.0; if(ga<0.03){ o[oo+3]=0; continue; } o[oo]=(byte)Math.Min(255,(B-mn)/ga); o[oo+1]=(byte)Math.Min(255,(G-mn)/ga); o[oo+2]=(byte)Math.Min(255,(R-mn)/ga); a=Math.Min(a,ga*1.15); }
          o[oo+3]=(byte)Math.Max(0,Math.Min(255,a*255));
        }
        using (var full = new Bitmap(cw, ch, PixelFormat.Format32bppArgb)) {
          var dd=full.LockBits(new Rectangle(0,0,cw,ch),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb); System.Runtime.InteropServices.Marshal.Copy(o,0,dd.Scan0,o.Length); full.UnlockBits(dd);
          using (var outBmp=new Bitmap(ow,oh,PixelFormat.Format32bppArgb)) using (var g=Graphics.FromImage(outBmp)) {
            g.InterpolationMode=InterpolationMode.HighQualityBicubic; g.PixelOffsetMode=PixelOffsetMode.HighQuality;
            g.DrawImage(full,new Rectangle(0,0,ow,oh),new Rectangle(0,0,cw,ch),GraphicsUnit.Pixel);
            outBmp.Save(prefix + (k+1) + ".png", ImageFormat.Png);
          }
        }
      }
    }
  }
}
"@
$er = New-Object 'System.Collections.Generic.List[int[]]'
if ($Erase -ne "") { foreach ($part in $Erase.Split(";")) { $er.Add([int[]]($part.Split(",") | ForEach-Object { [int]$_ })) } }
$ord = @(); if ($Order -ne "") { $ord = [int[]]($Order.Split(",") | ForEach-Object { [int]$_ }) }
try { [Extract]::Run($Src, $OutPrefix, $Scale, $Threshold, $PocketThr, $MinPocket, $Dilate, $MinArea, $Rows, $DarkLimit, $AttachDist, $Matte.IsPresent, $GroundLine.IsPresent, $ord, $er.ToArray()) } catch { $_.Exception.InnerException.ToString() }
