// Genera el INSTALADOR del agente de impresión de comandas (ESC/POS directo).
// Se descarga desde Configuración → Impresión con el token y la URL ya embebidos.
//
// El instalador es un .bat que NO requiere instalar nada:
//  1. Extrae de sí mismo un código C# (que va después del marcador #CSHARP).
//  2. Lo compila con el csc.exe de .NET Framework (viene con todo Windows) a un
//     .exe de bandeja (winexe, SIN ventana de consola).
//  3. Lo registra en el arranque de Windows (HKCU\...\Run) y lo lanza.
//
// Resultado: un icono silencioso junto al reloj que imprime cada pedido nuevo
// y arranca solo con Windows. El .exe habla con /api/print/queue y /api/print/ack.
//
// Estructura del archivo (polyglot):
//   <lineas .bat>           -> cmd ejecuta solo esto (termina en "exit /b")
//   #INSTALL                -> inicio del instalador PowerShell (lo corre el .bat via iex)
//   <PowerShell instalador>
//   #CSHARP                 -> inicio del código C# del agente (lo extrae el instalador)
//   <C# del agente>
// Los marcadores #INSTALL y #CSHARP aparecen UNA sola vez (se referencian con
// [char]35 + 'INSTALL' / 'CSHARP'), por eso IndexOf los ubica sin ambigüedad.
// Los bloques PowerShell/C# viven en String.raw (backslashes intactos, sin backticks).

export function buildPrintAgentInstaller(token: string, baseUrl: string): string {
  const csharp = buildAgentCSharp(token, baseUrl);
  const installer = INSTALLER_PS;

  const header = [
    "@echo off",
    "title Instalador del agente de impresion - quierocomer",
    "echo.",
    "echo   Instalando el agente de impresion de quierocomer...",
    "echo   (esto tarda unos segundos, no cierres la ventana)",
    "echo.",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$bat='%~f0'; $f=[IO.File]::ReadAllText($bat); $a=$f.IndexOf([char]35+'INSTALL')+8; $b=$f.IndexOf([char]35+'CSHARP'); iex $f.Substring($a,$b-$a)"`,
    "echo.",
    "pause",
    "exit /b",
  ].join("\r\n");

  const file = header + "\r\n#INSTALL\r\n" + installer + "\r\n#CSHARP\r\n" + csharp;
  // Normaliza a CRLF (cmd es quisquilloso; PowerShell y csc toleran CRLF sin problema).
  return file.replace(/\r?\n/g, "\r\n");
}

// ─── Instalador PowerShell (corre en el mismo scope del .bat: $f y $bat existen) ───
const INSTALLER_PS = String.raw`$ErrorActionPreference = 'Stop'
try {
  $src = $f.Substring($f.IndexOf([char]35 + 'CSHARP') + 7)
  $dir = Join-Path $env:LOCALAPPDATA 'QuieroComerAgente'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $cs  = Join-Path $dir 'Agente.cs'
  $exe = Join-Path $dir 'AgenteImpresion.exe'
  [IO.File]::WriteAllText($cs, $src, (New-Object System.Text.UTF8Encoding($false)))

  # Cierra una instancia previa para poder recompilar sobre el mismo .exe
  Get-Process -Name 'AgenteImpresion' -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 400

  $csc = Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
  if (-not (Test-Path $csc)) {
    Write-Host ''
    Write-Host 'ERROR: no se encontro el compilador de .NET Framework (csc.exe).' -ForegroundColor Red
    Write-Host 'Instala .NET Framework 4.x (viene incluido en Windows 10 y 11) y vuelve a intentarlo.'
    return
  }

  $refs = @('/r:System.dll','/r:System.Drawing.dll','/r:System.Windows.Forms.dll','/r:System.Runtime.Serialization.dll')
  & $csc /nologo /target:winexe /optimize+ "/out:$exe" $refs $cs 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $exe)) {
    Write-Host ''
    Write-Host 'ERROR: no se pudo compilar el agente. Detalle:' -ForegroundColor Red
    & $csc /nologo /target:winexe "/out:$exe" $refs $cs
    return
  }

  # Arranque automatico con Windows (por usuario, sin permisos de administrador)
  $run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  Set-ItemProperty -Path $run -Name 'QuieroComerAgente' -Value ('"' + $exe + '"')

  Start-Process $exe

  Write-Host ''
  Write-Host 'LISTO! El agente quedo corriendo en la barra de tareas (junto al reloj).' -ForegroundColor Green
  Write-Host 'Arrancara solo cada vez que enciendas este equipo.'
  Write-Host 'Clic derecho en su icono para "Imprimir prueba local" o "Salir".'
  Write-Host ('Ubicacion: ' + $exe)
} catch {
  Write-Host ''
  Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
}`;

// ─── Código C# del agente de bandeja (ASCII puro; token/URL embebidos) ───
function buildAgentCSharp(token: string, baseUrl: string): string {
  const t = token.replace(/["\\]/g, "");
  const b = baseUrl.replace(/["\\]/g, "");
  return String.raw`using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace QuieroComerAgente {

  [DataContract] public class Opt { [DataMember(Name="optionName")] public string optionName; }

  [DataContract] public class Item {
    [DataMember(Name="dishName")] public string dishName;
    [DataMember(Name="name")] public string name;
    [DataMember(Name="quantity")] public double? quantity;
    [DataMember(Name="unitTotal")] public double? unitTotal;
    [DataMember(Name="unit_price")] public double? unit_price;
    [DataMember(Name="selectedOptions")] public Opt[] selectedOptions;
    [DataMember(Name="notes")] public string notes;
  }

  [DataContract] public class Order {
    [DataMember(Name="id")] public string id;
    [DataMember(Name="orderNumber")] public double? orderNumber;
    [DataMember(Name="customerName")] public string customerName;
    [DataMember(Name="customerPhone")] public string customerPhone;
    [DataMember(Name="orderType")] public string orderType;
    [DataMember(Name="deliveryAddress")] public string deliveryAddress;
    [DataMember(Name="paymentMethod")] public string paymentMethod;
    [DataMember(Name="paymentStatus")] public string paymentStatus;
    [DataMember(Name="items")] public Item[] items;
    [DataMember(Name="total")] public double? total;
    [DataMember(Name="deliveryFee")] public double? deliveryFee;
    [DataMember(Name="discount")] public double? discount;
    [DataMember(Name="couponCode")] public string couponCode;
    [DataMember(Name="notes")] public string notes;
    [DataMember(Name="createdAt")] public string createdAt;
  }

  [DataContract] public class QueueResp {
    [DataMember(Name="ok")] public bool ok;
    [DataMember(Name="store")] public string store;
    [DataMember(Name="paperWidth")] public double? paperWidth;
    [DataMember(Name="orders")] public Order[] orders;
  }

  // Impresion RAW por winspool (bypassa el driver: manda ESC/POS crudo).
  public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool StartDocPrinter(IntPtr h, int level, ref DOCINFO di);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int count, out int written);
    public static bool Send(string printer, byte[] bytes) {
      if (string.IsNullOrEmpty(printer)) return false;
      IntPtr h; if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
      DOCINFO di = new DOCINFO(); di.pDocName = "Comanda"; di.pDataType = "RAW"; bool ok = false;
      if (StartDocPrinter(h, 1, ref di)) { if (StartPagePrinter(h)) { int w; ok = WritePrinter(h, bytes, bytes.Length, out w); EndPagePrinter(h); } EndDocPrinter(h); }
      ClosePrinter(h); return ok;
    }
  }

  public class TrayApp : ApplicationContext {
    const string TOKEN   = "${t}";
    const string BASEURL = "${b}";
    const int EscT     = 2;    // tabla de codigos ESC/POS (2 = PC850, acentos)
    const int CodePage = 850;  // code page .NET para codificar el texto
    const int PollSec  = 5;    // cada cuantos segundos consulta pedidos

    NotifyIcon ni;
    Control sync;
    Thread worker;
    volatile bool running = true;
    Encoding enc;
    CultureInfo clCL = CultureInfo.GetCultureInfo("es-CL");

    public TrayApp() {
      try { enc = Encoding.GetEncoding(CodePage); } catch { enc = Encoding.GetEncoding(1252); }
      try { ServicePointManager.SecurityProtocol = ServicePointManager.SecurityProtocol | (SecurityProtocolType)3072 | (SecurityProtocolType)768; } catch {}

      sync = new Control(); IntPtr forceHandle = sync.Handle;

      ContextMenuStrip menu = new ContextMenuStrip();
      menu.Items.Add("Imprimir prueba local", null, delegate { TestPrint(); });
      menu.Items.Add("Salir", null, delegate { ExitApp(); });

      ni = new NotifyIcon();
      ni.Icon = SystemIcons.Information;
      ni.Text = "Agente de impresion quierocomer";
      ni.Visible = true;
      ni.ContextMenuStrip = menu;

      worker = new Thread(new ThreadStart(Loop)); worker.IsBackground = true; worker.Start();
      Balloon("Agente activo", "Esperando pedidos de quierocomer.");
    }

    void Balloon(string title, string text) {
      try { sync.BeginInvoke((MethodInvoker)delegate {
        ni.BalloonTipTitle = title; ni.BalloonTipText = text; ni.ShowBalloonTip(3000);
      }); } catch {}
    }
    void SetTip(string t) {
      try { sync.BeginInvoke((MethodInvoker)delegate {
        ni.Text = t.Length > 63 ? t.Substring(0, 63) : t;
      }); } catch {}
    }

    void ExitApp() {
      running = false;
      try { ni.Visible = false; } catch {}
      Application.Exit();
    }

    string DefaultPrinter() {
      try { return new PrinterSettings().PrinterName; } catch { return ""; }
    }

    void Loop() {
      while (running) {
        try {
          WebClient wc = new WebClient(); wc.Encoding = Encoding.UTF8;
          string json = wc.DownloadString(BASEURL + "/api/print/queue?token=" + TOKEN);
          DataContractJsonSerializer ser = new DataContractJsonSerializer(typeof(QueueResp));
          QueueResp resp;
          using (MemoryStream ms = new MemoryStream(Encoding.UTF8.GetBytes(json))) { resp = (QueueResp)ser.ReadObject(ms); }
          if (resp != null && resp.ok && resp.orders != null) {
            int width = (resp.paperWidth.HasValue && (int)resp.paperWidth.Value == 58) ? 58 : 80;
            foreach (Order o in resp.orders) {
              try {
                byte[] bytes = BuildTicket(o, resp.store, width);
                string printer = DefaultPrinter();
                bool ok = RawPrinter.Send(printer, bytes);
                if (ok) { Ack(o.id); Balloon("Comanda impresa", "Pedido #" + NumStr(o.orderNumber)); }
                else { Balloon("Error de impresion", "Revisa la impresora: " + printer); }
              } catch (Exception ex) { Balloon("Error con un pedido", ex.Message); }
            }
          }
          SetTip("Agente activo - " + DateTime.Now.ToString("HH:mm"));
        } catch (Exception) {
          SetTip("Sin conexion - reintentando");
        }
        for (int i = 0; i < PollSec * 2 && running; i++) Thread.Sleep(500);
      }
    }

    void Ack(string orderId) {
      try {
        WebClient wc = new WebClient(); wc.Encoding = Encoding.UTF8;
        wc.Headers[HttpRequestHeader.ContentType] = "application/json";
        string body = "{\"token\":\"" + TOKEN + "\",\"orderId\":\"" + JsonEsc(orderId) + "\"}";
        wc.UploadString(BASEURL + "/api/print/ack", "POST", body);
      } catch {}
    }

    static string JsonEsc(string s) { if (s == null) return ""; return s.Replace("\\", "\\\\").Replace("\"", "\\\""); }
    string NumStr(double? n) { if (!n.HasValue) return "0"; return ((long)Math.Round(n.Value)).ToString(); }
    string Money(double? n) { double v = n.HasValue ? n.Value : 0; return "$" + Math.Round(v).ToString("N0", clCL); }

    void TestPrint() {
      try {
        Order o = new Order();
        o.orderNumber = 0; o.customerName = "*** PRUEBA LOCAL ***"; o.orderType = "PICKUP";
        o.paymentMethod = "efectivo"; o.paymentStatus = "paid"; o.createdAt = DateTime.Now.ToString("o");
        o.total = 0; o.deliveryFee = 0; o.discount = 0;
        Item it = new Item(); it.dishName = "Ticket de prueba"; it.quantity = 1; it.unitTotal = 0;
        o.items = new Item[] { it };
        o.notes = "Si lees este ticket, la impresora funciona.";
        string printer = DefaultPrinter();
        bool ok = RawPrinter.Send(printer, BuildTicket(o, "QUIEROCOMER", 80));
        Balloon(ok ? "Prueba enviada" : "Error", ok ? ("Impresora: " + printer) : ("Revisa la impresora: " + printer));
      } catch (Exception ex) { Balloon("Error", ex.Message); }
    }

    // ---- Construccion del ticket ESC/POS ----
    byte[] BuildTicket(Order o, string store, int width) {
      int cols = width == 58 ? 32 : 48;
      List<byte> bt = new List<byte>();
      Action<string> T = delegate(string t) { if (t == null) t = ""; foreach (byte x in enc.GetBytes(t)) bt.Add(x); };
      Action<byte[]> B = delegate(byte[] arr) { foreach (byte x in arr) bt.Add(x); };
      Action NL = delegate { bt.Add(10); };
      Action Line = delegate { for (int i = 0; i < cols; i++) bt.Add(45); bt.Add(10); };
      Action<string, string> Row = delegate(string l, string r) {
        if (l == null) l = ""; if (r == null) r = "";
        int sp = cols - l.Length - r.Length; if (sp < 1) sp = 1;
        T(l); for (int i = 0; i < sp; i++) bt.Add(32); T(r); bt.Add(10);
      };

      B(new byte[] { 27, 64 });            // ESC @  init
      B(new byte[] { 27, 116, (byte)EscT });// ESC t  tabla de codigos
      B(new byte[] { 27, 97, 1 });         // centrar
      B(new byte[] { 29, 33, 17 });        // doble ancho + alto
      T((store == null ? "" : store).ToUpper()); NL();
      B(new byte[] { 29, 33, 0 });         // normal
      T("COMANDA  Pedido #" + NumStr(o.orderNumber)); NL();
      string d = ""; try { d = DateTime.Parse(o.createdAt).ToLocalTime().ToString("dd/MM/yy HH:mm"); } catch {}
      T(d); NL();
      B(new byte[] { 27, 97, 0 });         // izquierda
      Line();

      if (o.orderType == "DELIVERY") { B(new byte[] { 27, 69, 1 }); T("DELIVERY"); NL(); B(new byte[] { 27, 69, 0 }); }
      else { B(new byte[] { 27, 69, 1 }); T("RETIRO EN LOCAL"); NL(); B(new byte[] { 27, 69, 0 }); }
      T(o.customerName); NL();
      if (!string.IsNullOrEmpty(o.customerPhone)) { T("Tel: " + o.customerPhone); NL(); }
      if (o.orderType == "DELIVERY" && !string.IsNullOrEmpty(o.deliveryAddress)) { T("Dir: " + o.deliveryAddress); NL(); }
      Line();

      double subtotal = 0;
      if (o.items != null) foreach (Item it in o.items) {
        string name = !string.IsNullOrEmpty(it.dishName) ? it.dishName : (!string.IsNullOrEmpty(it.name) ? it.name : "Producto");
        double unit = it.unitTotal.HasValue ? it.unitTotal.Value : (it.unit_price.HasValue ? it.unit_price.Value : 0);
        double qty = it.quantity.HasValue ? it.quantity.Value : 1;
        double lt = unit * qty; subtotal += lt;
        B(new byte[] { 27, 69, 1 }); Row(((long)qty).ToString() + "x " + name, Money(lt)); B(new byte[] { 27, 69, 0 });
        if (it.selectedOptions != null) foreach (Opt op in it.selectedOptions) { if (op != null && !string.IsNullOrEmpty(op.optionName)) { T("  - " + op.optionName); NL(); } }
        if (!string.IsNullOrEmpty(it.notes)) { T("  * " + it.notes); NL(); }
      }
      Line();
      double total = o.total.HasValue ? o.total.Value : 0;
      if (total != subtotal) Row("Subtotal", Money(subtotal));
      if (o.deliveryFee.HasValue && o.deliveryFee.Value > 0) Row("Despacho", Money(o.deliveryFee));
      if (o.discount.HasValue && o.discount.Value > 0) { string lab = "Descuento"; if (!string.IsNullOrEmpty(o.couponCode)) lab += " (" + o.couponCode + ")"; Row(lab, "-" + Money(o.discount)); }
      B(new byte[] { 29, 33, 16 });        // doble alto
      Row("TOTAL", Money(o.total));
      B(new byte[] { 29, 33, 0 });
      Line();
      Dictionary<string, string> pm = new Dictionary<string, string>() {
        { "webpay", "Webpay" }, { "flow", "Flow" }, { "mercadopago", "MercadoPago" },
        { "efectivo", "Efectivo" }, { "transferencia", "Transferencia" }, { "tarjeta", "Tarjeta" }
      };
      string pl = o.paymentMethod;
      if (o.paymentMethod != null && pm.ContainsKey(o.paymentMethod)) pl = pm[o.paymentMethod];
      string pst = o.paymentStatus == "paid" ? "PAGADO" : "PENDIENTE";
      T("Pago: " + pl + " - " + pst); NL();
      if (!string.IsNullOrEmpty(o.notes)) { T("Notas: " + o.notes); NL(); }

      B(new byte[] { 27, 100, 4 });        // feed 4 lineas
      B(new byte[] { 29, 86, 66, 0 });     // GS V B 0  -> corte
      return bt.ToArray();
    }

    [STAThread]
    public static void Main() {
      Application.EnableVisualStyles();
      Application.Run(new TrayApp());
    }
  }
}`;
}
