param([string]$Src, [string]$OutPrefix, [string]$Cuts, [int]$Window = 150, [double]$Scale = 0.5,
      [int]$Threshold = 238, [int]$PocketThr = 250, [int]$MinPocket = 300, [double]$FragFrac = 0.01, [string]$Overrides = "", [switch]$AlignBottom, [switch]$Matte, [switch]$EyeAlign)
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Drawing2D; using System.Drawing.Imaging;
public static class Frames {
  public static bool AlignBottom = false;
  public static bool Matte = false;
  public static bool EyeAlign = false;
  static bool Cyan(byte[] px, int i) { int B=px[i*4], G=px[i*4+1], R=px[i*4+2]; return B>190 && G>170 && R<120; }
  // Centro del ojo: la mancha cian mas grande y compacta (los propulsores son alargados y dentados)
  static double[] FindEye(bool[] keep, int[] frameOf, int f, byte[] px, int w, int h) {
    var seen = new bool[w*h]; double[] best = null; double bestArea = 0; int[] ddx={1,-1,0,0}, ddy={0,0,1,-1};
    for (int s=0; s<w*h; s++) {
      if (!keep[s] || frameOf[s]!=f || seen[s] || !Cyan(px, s)) continue;
      var q = new Queue<int>(); q.Enqueue(s); seen[s]=true; int area=0,x0=w,y0=h,x1=0,y1=0;
      while (q.Count>0) { int i=q.Dequeue(); area++; int cx=i%w, cy=i/w; if(cx<x0)x0=cx; if(cx>x1)x1=cx; if(cy<y0)y0=cy; if(cy>y1)y1=cy;
        for (int k=0;k<4;k++){ int nx=cx+ddx[k], ny=cy+ddy[k]; if(nx<0||ny<0||nx>=w||ny>=h) continue; int ni=ny*w+nx; if(keep[ni]&&frameOf[ni]==f&&!seen[ni]&&Cyan(px,ni)){seen[ni]=true;q.Enqueue(ni);} } }
      int bw=x1-x0+1, bh=y1-y0+1; double fill=area/(double)(bw*bh); double asp=Math.Min(bw,bh)/(double)Math.Max(bw,bh);
      if (asp>0.6 && fill>0.3 && area>bestArea) { bestArea=area; best=new double[]{(x0+x1)/2.0,(y0+y1)/2.0}; }
    }
    return best;
  }
  public static void Run(string src, string prefix, int[] cuts, int win, double scale, int thr, int pocketThr, int minPocket, double fragFrac, int[][] overrides) {
    using (var bmp = new Bitmap(src)) {
      int w = bmp.Width, h = bmp.Height; var px = new byte[w*h*4];
      var d = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d);
      Func<int,int,bool> white = (i,t) => Math.Min(px[i*4], Math.Min(px[i*4+1], px[i*4+2])) >= t;
      var bg = new bool[w*h]; var q = new Queue<int>();
      Action<int> seed = i => { if (!bg[i] && white(i, thr)) { bg[i] = true; q.Enqueue(i); } };
      for (int x=0;x<w;x++){seed(x);seed((h-1)*w+x);} for(int y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
      int[] dx={1,-1,0,0,1,1,-1,-1}, dy={0,0,1,-1,1,-1,1,-1};
      while(q.Count>0){int i=q.Dequeue();int cx=i%w,cy=i/w;for(int k=0;k<4;k++){int nx=cx+dx[k],ny=cy+dy[k];if(nx>=0&&ny>=0&&nx<w&&ny<h)seed(ny*w+nx);}}
      // huecos blancos cerrados
      var seen = new bool[w*h];
      for (int s=0;s<w*h;s++){ if(bg[s]||seen[s]||!white(s,pocketThr)) continue; var comp=new List<int>(); var cq=new Queue<int>(); cq.Enqueue(s); seen[s]=true;
        while(cq.Count>0){int i=cq.Dequeue();comp.Add(i);int cx=i%w,cy=i/w;for(int k=0;k<4;k++){int nx=cx+dx[k],ny=cy+dy[k];if(nx<0||ny<0||nx>=w||ny>=h)continue;int ni=ny*w+nx;if(!bg[ni]&&!seen[ni]&&white(ni,pocketThr)){seen[ni]=true;cq.Enqueue(ni);}}}
        if (comp.Count>=minPocket) foreach(int i in comp) bg[i]=true; }

      // Costuras de coste minimo entre cuadros: atraviesan fondo siempre que se pueda
      int n = cuts.Length + 1; var seam = new int[cuts.Length][];
      int slope = 10;
      for (int c=0;c<cuts.Length;c++) {
        int x0 = Math.Max(0, cuts[c]-win), x1 = Math.Min(w-1, cuts[c]+win), width = x1-x0+1;
        var cost = new double[h*width]; var from = new int[h*width];
        for (int y=0;y<h;y++) for (int xi=0;xi<width;xi++) {
          double best = 0; int bf = xi;
          if (y>0) { best = double.MaxValue; for (int s=-slope;s<=slope;s++){ int pj=xi+s; if(pj<0||pj>=width) continue; double v=cost[(y-1)*width+pj] + 0.02*Math.Abs(s); if(v<best){best=v;bf=pj;} } }
          double here = bg[y*w + x0+xi] ? 0.0 : 1.0; here += 0.0004*Math.Abs((x0+xi)-cuts[c]);
          cost[y*width+xi] = best + here; from[y*width+xi] = bf;
        }
        int bx = 0; double bestEnd = double.MaxValue; for (int xi=0;xi<width;xi++) if (cost[(h-1)*width+xi]<bestEnd){bestEnd=cost[(h-1)*width+xi];bx=xi;}
        seam[c] = new int[h]; for (int y=h-1;y>=0;y--){ seam[c][y]=x0+bx; bx=from[y*width+bx]; }
        Console.WriteLine("costura " + c + ": pixeles de figura cortados = " + (int)bestEnd);
      }
      // Asigna cada pixel a un cuadro
      var frameOf = new int[w*h];
      for (int y=0;y<h;y++) for (int x=0;x<w;x++){ int f=0; for(int c=0;c<cuts.Length;c++) if (x>seam[c][y]) f=c+1; frameOf[y*w+x]=f; }

      // Piezas sueltas grandes y oscuras (mastil, cabeza de guitarra, pierna) que cruzaron una costura vuelven al cuadro que tocan
      {
        var lab = new int[w*h]; var labFrame = new List<int>{0}; var labArea = new List<int>{0}; var labBright = new List<double>{0}; int nl = 0;
        for (int s=0;s<w*h;s++){ if(bg[s]||lab[s]!=0) continue; nl++; int fr=frameOf[s]; int area=0; double bs=0; var cq=new Queue<int>(); cq.Enqueue(s); lab[s]=nl;
          while(cq.Count>0){int i=cq.Dequeue();area++; bs+=(px[i*4]+px[i*4+1]+px[i*4+2])/3.0; int cx=i%w,cy=i/w;for(int k=0;k<8;k++){int nx=cx+dx[k],ny=cy+dy[k];if(nx<0||ny<0||nx>=w||ny>=h)continue;int ni=ny*w+nx;if(!bg[ni]&&lab[ni]==0&&frameOf[ni]==fr){lab[ni]=nl;cq.Enqueue(ni);}}}
          labFrame.Add(fr); labArea.Add(area); labBright.Add(bs/area); }
        var mainOf = new int[n]; for (int l=1;l<=nl;l++){ int fr=labFrame[l]; if (mainOf[fr]==0 || labArea[l]>labArea[mainOf[fr]]) mainOf[fr]=l; }
        var touch = new Dictionary<int,int[]>();
        for (int i=0;i<w*h;i++){ int l=lab[i]; if(l==0||mainOf[labFrame[l]]==l||labArea[l]<200||labBright[l]>=150) continue; int x=i%w,y=i/w;
          for(int k=0;k<8;k++){int nx=x+dx[k],ny=y+dy[k];if(nx<0||ny<0||nx>=w||ny>=h)continue;int j=ny*w+nx;if(!bg[j]&&frameOf[j]!=labFrame[l]){ if(!touch.ContainsKey(l)) touch[l]=new int[n]; touch[l][frameOf[j]]++; }} }
        var newFrame = new int[nl+1]; for (int l=1;l<=nl;l++) newFrame[l]=labFrame[l];
        foreach (var kv in touch){ int best=0; for(int g=1;g<n;g++) if(kv.Value[g]>kv.Value[best]) best=g; newFrame[kv.Key]=best; Console.WriteLine("pieza de " + labArea[kv.Key] + " px del cuadro " + (labFrame[kv.Key]+1) + " vuelve al cuadro " + (best+1)); }
        for (int i=0;i<w*h;i++){ int l=lab[i]; if(l!=0) frameOf[i]=newFrame[l]; }
      }

      // Reasignaciones manuales: piezas de un cuadro que invaden a su vecino (cabeza de guitarra, patada)
      foreach (var r in overrides) {
        for (int y=Math.Max(0,r[1]); y<=Math.Min(h-1,r[3]); y++) for (int x=Math.Max(0,r[0]); x<=Math.Min(w-1,r[2]); x++) if (!bg[y*w+x]) {
          if (r.Length > 5) { int i2=(y*w+x)*4; int B2=px[i2],G2=px[i2+1],R2=px[i2+2]; int mean=(R2+G2+B2)/3;
            bool fx = mean>140 || (B2>R2+40 && G2>R2+30) || (R2>200 && G2>150 && B2<R2-90);
            if ((r[5]==1 && !fx) || (r[5]==2 && fx)) continue; }
          frameOf[y*w+x] = r[4]; }
      }

      // Por cuadro: figura principal, caja y centroide de la mitad inferior
      var minX=new int[n]; var maxX=new int[n]; var minY=new int[n]; var maxY=new int[n]; var cen=new double[n]; var eyeY=new double[n];
      var keep = new bool[w*h];
      for (int f=0; f<n; f++) {
        var label = new int[w*h]; var areas = new List<int>{0}; var bright = new List<double>{0}; int next=0; int mainL=0;
        for (int s=0;s<w*h;s++){ if(bg[s]||frameOf[s]!=f||label[s]!=0) continue; next++; int area=0; double bsum=0; var cq=new Queue<int>(); cq.Enqueue(s); label[s]=next;
          while(cq.Count>0){int i=cq.Dequeue();area++; bsum += (px[i*4]+px[i*4+1]+px[i*4+2])/3.0; int cx=i%w,cy=i/w;for(int k=0;k<8;k++){int nx=cx+dx[k],ny=cy+dy[k];if(nx<0||ny<0||nx>=w||ny>=h)continue;int ni=ny*w+nx;if(!bg[ni]&&frameOf[ni]==f&&label[ni]==0){label[ni]=next;cq.Enqueue(ni);}}}
          areas.Add(area); bright.Add(bsum/area); if (mainL==0 || area>areas[mainL]) mainL=next; }
        int mnx=w,mxx=0,mny=h,mxy=0;
        for (int i=0;i<w*h;i++) if (label[i]==mainL){ int x=i%w,y=i/w; if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y; }
        // fragmentos pequenos dentro de la caja (cintas, chispas)
        for (int i=0;i<w*h;i++){ int l=label[i]; if(l==0) continue; if(l==mainL){keep[i]=true;continue;} int x=i%w,y=i/w; if (areas[l] < areas[mainL]*fragFrac && bright[l] > 150 && x>mnx && x<mxx && y>mny && y<mxy) keep[i]=true; }
        minX[f]=mnx;maxX[f]=mxx;minY[f]=mny;maxY[f]=mxy;
        double sum=0; int cnt=0; int yLow = mny + (int)((mxy-mny)*0.45);
        for (int i=0;i<w*h;i++) if (keep[i] && frameOf[i]==f && i/w>=yLow){ sum += i%w; cnt++; }
        cen[f] = cnt>0 ? sum/cnt : (mnx+mxx)/2.0;
        eyeY[f] = (mny+mxy)/2.0;
        if (EyeAlign) { var e = FindEye(keep, frameOf, f, px, w, h); if (e != null) { cen[f]=e[0]; eyeY[f]=e[1]; } else Console.WriteLine("cuadro " + (f+1) + ": ojo NO encontrado"); }
        Console.WriteLine("cuadro " + (f+1) + ": x " + mnx + "-" + mxx + "  y " + mny + "-" + mxy + "  centroide " + (int)cen[f]);
      }
      // Lienzo comun: el centroide queda en el mismo punto de todos los cuadros
      int maxL=0, maxR=0, top=h, bottom=0;
      for (int f=0;f<n;f++){ maxL=Math.Max(maxL,(int)(cen[f]-minX[f])+2); maxR=Math.Max(maxR,(int)(maxX[f]-cen[f])+2); top=Math.Min(top,minY[f]); bottom=Math.Max(bottom,maxY[f]); }
      int cw=maxL+maxR+1, ch=bottom-top+1;
      int maxU=0, maxD=0;
      if (EyeAlign) { for (int f=0;f<n;f++){ maxU=Math.Max(maxU,(int)(eyeY[f]-minY[f])+2); maxD=Math.Max(maxD,(int)(maxY[f]-eyeY[f])+2); } ch=maxU+maxD+1; Console.WriteLine("ojo en x=" + (int)Math.Round(maxL*scale) + " y=" + (int)Math.Round(maxU*scale)); }
      if (AlignBottom) { ch=0; for (int f=0;f<n;f++) ch=Math.Max(ch, maxY[f]-minY[f]+1); }
      int ow=(int)Math.Round(cw*scale), oh=(int)Math.Round(ch*scale);
      Console.WriteLine("lienzo comun: " + ow + "x" + oh + " (origen " + cw + "x" + ch + "), centroide en x=" + (int)Math.Round(maxL*scale));
      for (int f=0; f<n; f++) {
        using (var full = new Bitmap(cw, ch, PixelFormat.Format32bppArgb)) {
          var o = new byte[cw*ch*4];
          for (int y=0;y<ch;y++) for (int x=0;x<cw;x++){
            int sx=(int)Math.Round(cen[f])-maxL+x, sy=EyeAlign ? (int)Math.Round(eyeY[f])-maxU+y : (AlignBottom ? maxY[f]-ch+1+y : top+y); if(sx<0||sx>=w||sy<0||sy>=h) continue;
            int i=sy*w+sx; if(!keep[i]||frameOf[i]!=f) continue;
            int so=i*4, oo=(y*cw+x)*4; o[oo]=px[so];o[oo+1]=px[so+1];o[oo+2]=px[so+2];
            bool edge=false; for(int yy=Math.Max(0,sy-1);yy<=Math.Min(h-1,sy+1)&&!edge;yy++)for(int xx=Math.Max(0,sx-1);xx<=Math.Min(w-1,sx+1);xx++){int j=yy*w+xx; if(!keep[j]||frameOf[j]!=f){edge=true;break;}}
            double a=1.0; if(edge){int m=Math.Min(px[so],Math.Min(px[so+1],px[so+2])); a=1.0-Math.Max(0,m-190)/(double)(thr-190+1);}
            if (Matte) {
              int B=px[so], G=px[so+1], R=px[so+2]; int mn=Math.Min(B,Math.Min(G,R));
              bool cyan = B>R+40 && G>R+30; bool gold = R>200 && G>150 && B<R-110 && G>B+60;
              if (cyan || gold) { double ga=1.0-mn/255.0; if (ga<0.03){ o[oo+3]=0; continue; } o[oo]=(byte)Math.Min(255,(B-mn)/ga); o[oo+1]=(byte)Math.Min(255,(G-mn)/ga); o[oo+2]=(byte)Math.Min(255,(R-mn)/ga); a=ga; }
            }
            o[oo+3]=(byte)Math.Max(0,Math.Min(255,a*255));
          }
          var dd=full.LockBits(new Rectangle(0,0,cw,ch),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb); System.Runtime.InteropServices.Marshal.Copy(o,0,dd.Scan0,o.Length); full.UnlockBits(dd);
          using (var outBmp=new Bitmap(ow,oh,PixelFormat.Format32bppArgb)) using (var g=Graphics.FromImage(outBmp)) {
            g.InterpolationMode=InterpolationMode.HighQualityBicubic; g.PixelOffsetMode=PixelOffsetMode.HighQuality;
            g.DrawImage(full,new Rectangle(0,0,ow,oh),new Rectangle(0,0,cw,ch),GraphicsUnit.Pixel);
            outBmp.Save(prefix + (f+1) + ".png", ImageFormat.Png);
          }
        }
      }
    }
  }
}
"@
$cutArr = [int[]]($Cuts.Split(",") | ForEach-Object { [int]$_ })
[Frames]::AlignBottom = $AlignBottom.IsPresent
[Frames]::Matte = $Matte.IsPresent
[Frames]::EyeAlign = $EyeAlign.IsPresent
$ovr = New-Object 'System.Collections.Generic.List[int[]]'
if ($Overrides -ne "") { foreach ($part in $Overrides.Split(";")) { $ovr.Add([int[]]($part.Split(",") | ForEach-Object { [int]$_ })) } }
try { [Frames]::Run($Src, $OutPrefix, $cutArr, $Window, $Scale, $Threshold, $PocketThr, $MinPocket, $FragFrac, $ovr.ToArray()) } catch { $_.Exception.InnerException.ToString() }
