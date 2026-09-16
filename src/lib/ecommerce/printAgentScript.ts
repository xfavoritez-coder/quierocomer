// Genera el script PowerShell del agente de impresión local (ESC/POS directo).
// Se descarga desde Configuración → Impresión con el token y la URL ya embebidos.
// No requiere instalar nada: PowerShell viene con Windows y la impresión RAW usa
// winspool (P/Invoke). El corte del papel va incluido en el ESC/POS.
// (El script NO contiene backticks para poder vivir dentro de String.raw`...`.)

export function buildPrintAgentPs1(token: string, baseUrl: string): string {
  return String.raw`# ============================================================
#  Agente de impresion de comandas - quierocomer (ESC/POS)
#  Imprime automaticamente cada pedido nuevo en la impresora
#  termica, sin navegador. Dejalo corriendo en segundo plano.
# ============================================================
$Token   = "${token}"
$BaseUrl = "${baseUrl}"
$Printer = ""      # vacio = impresora PREDETERMINADA de Windows. O pon el nombre exacto: "POS-80"
$EscT    = 2       # tabla de codigos ESC/POS para acentos (2=PC850). Si los acentos salen mal, prueba 18, 19 o 16.
$CodePage= 850     # .NET code page para codificar el texto (850=Latin1). Debe ir acorde a $EscT.
$PollSec = 5       # cada cuantos segundos consulta pedidos nuevos

# --- Impresion RAW por winspool (sin dependencias) ---
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool StartDocPrinter(IntPtr h, int l, ref DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
  public static bool Send(string printer, byte[] bytes) {
    IntPtr h; if(!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    DOCINFO di = new DOCINFO(); di.pDocName="Comanda"; di.pDataType="RAW"; bool ok=false;
    if(StartDocPrinter(h,1,ref di)){ if(StartPagePrinter(h)){ int w; ok=WritePrinter(h,bytes,bytes.Length,out w); EndPagePrinter(h);} EndDocPrinter(h);}
    ClosePrinter(h); return ok;
  }
}
"@

function Get-DefaultPrinter { try { (Get-CimInstance Win32_Printer -EA Stop | Where-Object {$_.Default}).Name } catch { (Get-WmiObject Win32_Printer | Where-Object {$_.Default}).Name } }

try { [System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance) } catch {}
$enc = [System.Text.Encoding]::GetEncoding($CodePage)
$clCL = [Globalization.CultureInfo]::GetCultureInfo("es-CL")
function Money($n){ return "$" + ([math]::Round([double]$n)).ToString("N0", $clCL) }

function Build-Ticket($o, $store, $width) {
  $cols = 48; if ($width -eq 58) { $cols = 32 }
  $bytes = New-Object System.Collections.Generic.List[byte]
  function T($t){ foreach($b in $enc.GetBytes([string]$t)){ [void]$bytes.Add($b) } }
  function B($arr){ foreach($b in $arr){ [void]$bytes.Add([byte]$b) } }
  function NL { [void]$bytes.Add(10) }
  function Line { T ("-" * $cols); NL }
  function Row($l, $r){ $l=[string]$l; $r=[string]$r; $sp=$cols - $l.Length - $r.Length; if($sp -lt 1){$sp=1}; T ($l + (" " * $sp) + $r); NL }

  B @(27,64)          # ESC @  init
  B @(27,116,$EscT)   # ESC t  tabla de codigos
  B @(27,97,1)        # centrar
  B @(29,33,17)       # doble ancho + alto
  T ($store.ToUpper()); NL
  B @(29,33,0)        # normal
  T ("COMANDA  Pedido #" + $o.orderNumber); NL
  try { $d = [DateTime]::Parse($o.createdAt).ToLocalTime().ToString("dd/MM/yy HH:mm") } catch { $d = "" }
  T $d; NL
  B @(27,97,0)        # izquierda
  Line

  if ($o.orderType -eq "DELIVERY") { B @(27,69,1); T "DELIVERY"; NL; B @(27,69,0) }
  else { B @(27,69,1); T "RETIRO EN LOCAL"; NL; B @(27,69,0) }
  T $o.customerName; NL
  if ($o.customerPhone) { T ("Tel: " + $o.customerPhone); NL }
  if ($o.orderType -eq "DELIVERY" -and $o.deliveryAddress) { T ("Dir: " + $o.deliveryAddress); NL }
  Line

  $subtotal = 0.0
  foreach ($it in $o.items) {
    $name = "Producto"; if ($it.dishName) { $name = $it.dishName } elseif ($it.name) { $name = $it.name }
    $unit = 0; if ($it.unitTotal -ne $null) { $unit = $it.unitTotal } elseif ($it.unit_price -ne $null) { $unit = $it.unit_price }
    $qty = 1; if ($it.quantity) { $qty = $it.quantity }
    $lt = [double]$unit * [double]$qty
    $subtotal += $lt
    B @(27,69,1); Row (("" + $qty) + "x " + $name) (Money $lt); B @(27,69,0)
    if ($it.selectedOptions) { foreach ($op in $it.selectedOptions) { if ($op.optionName) { T ("  - " + $op.optionName); NL } } }
    if ($it.notes) { T ("  * " + $it.notes); NL }
  }
  Line
  if ([double]$o.total -ne $subtotal) { Row "Subtotal" (Money $subtotal) }
  if ([double]$o.deliveryFee -gt 0) { Row "Despacho" (Money $o.deliveryFee) }
  if ([double]$o.discount -gt 0) { $lab = "Descuento"; if ($o.couponCode) { $lab = $lab + " (" + $o.couponCode + ")" }; Row $lab ("-" + (Money $o.discount)) }
  B @(29,33,16)       # doble alto
  Row "TOTAL" (Money $o.total)
  B @(29,33,0)
  Line
  $pm = @{ webpay="Webpay"; flow="Flow"; mercadopago="MercadoPago"; efectivo="Efectivo"; transferencia="Transferencia"; tarjeta="Tarjeta" }
  $pl = $o.paymentMethod; if ($pm[$o.paymentMethod]) { $pl = $pm[$o.paymentMethod] }
  $pst = "PENDIENTE"; if ($o.paymentStatus -eq "paid") { $pst = "PAGADO" }
  T ("Pago: " + $pl + " - " + $pst); NL
  if ($o.notes) { T ("Notas: " + $o.notes); NL }

  B @(27,100,4)       # feed 4 lineas
  B @(29,86,66,0)     # GS V B 0  -> corte
  return $bytes.ToArray()
}

$printerName = $Printer; if (-not $Printer) { $printerName = Get-DefaultPrinter }
Write-Host ("Agente de impresion iniciado. Impresora: " + $printerName)
Write-Host "Deja esta ventana abierta (o configuralo en Inicio). Ctrl+C para detener."

while ($true) {
  try {
    $resp = Invoke-RestMethod -Uri ($BaseUrl + "/api/print/queue?token=" + $Token) -TimeoutSec 15
    if ($resp.ok -and $resp.orders) {
      foreach ($o in $resp.orders) {
        try {
          $bytes = Build-Ticket $o $resp.store $resp.paperWidth
          $printerName = $Printer; if (-not $Printer) { $printerName = Get-DefaultPrinter }
          $ok = [RawPrinter]::Send($printerName, $bytes)
          if ($ok) {
            $body = @{ token=$Token; orderId=$o.id } | ConvertTo-Json
            Invoke-RestMethod -Uri ($BaseUrl + "/api/print/ack") -Method Post -ContentType "application/json" -Body $body -TimeoutSec 15 | Out-Null
            Write-Host ("Impreso pedido #" + $o.orderNumber)
          } else {
            Write-Host ("ERROR al imprimir pedido #" + $o.orderNumber + " (revisa la impresora: " + $printerName + ")") -ForegroundColor Red
          }
        } catch { Write-Host ("Error con pedido: " + $_.Exception.Message) -ForegroundColor Red }
      }
    }
  } catch { Write-Host ("Sin conexion: " + $_.Exception.Message) -ForegroundColor Yellow }
  Start-Sleep -Seconds $PollSec
}
`;
}
