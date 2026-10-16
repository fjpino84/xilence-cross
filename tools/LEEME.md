# Herramientas de recorte de sprites (Windows PowerShell 5, sin dependencias)

Se ejecutan con `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\<script>.ps1 ...` (no con PowerShell 7).

- **extract.ps1**: separa cada cuadro de una hoja como figura independiente y los alinea por los pies. Para hojas con cuadros sueltos
  (Adversario 2). Parametros utiles: `-Rows` (filas), `-Dilate` (pequeno), `-MinArea`, `-Scale`, `-Matte` (efectos luminosos
  translucidos), `-GroundLine` (quita la linea de sombra), `-Erase` (rectangulos de contacto a borrar).
- **frames.ps1**: corta una tira horizontal en cuadros con costuras de coste minimo (ECO). `-Cuts` = x de corte, `-Overrides`
  = reasignaciones manuales `x0,y0,x1,y1,cuadro[,modo]`.
- **strip.ps1**: convierte una hoja de varias filas en una tira horizontal.
- **puddles.ps1**: detecta charcos luminosos en un fondo (referencia; los charcos se fijaron a mano en src/levels/PuddleData.js).
- **resize.ps1**, **cutout.ps1**: reducir fondos y recortar una sola figura.
- **split.ps1**: para hojas cuyos dibujos se solapan (Adversario 1). Reparte los pixeles por columnas con cortes inclinados (`-Cuts`,
  en fracciones) y deja un hueco blanco entre ellas; despues se pasa por extract.ps1.
- **clean.ps1**: quita los fragmentos sueltos de figuras vecinas que quedan en el borde de un cuadro recortado.
