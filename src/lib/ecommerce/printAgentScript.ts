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

/** Sufijo único por local, derivado del token → permite varios agentes (locales
 *  distintos) conviviendo en el MISMO computador sin pisarse. */
function agentSlug(token: string): string {
  const s = (token || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return s ? `_${s}` : "";
}

export function buildPrintAgentInstaller(token: string, baseUrl: string, label?: string): string {
  const slug = agentSlug(token);
  const csharp = buildAgentCSharp(token, baseUrl, label);
  const installer = INSTALLER_PS.replace(/__SLUG__/g, slug);

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

// Desinstalador: detiene el agente, lo quita del arranque de Windows y borra la
// carpeta. Solo comandos nativos de cmd (no necesita token ni compilar nada).
export function buildPrintAgentUninstaller(token?: string): string {
  const slug = token ? agentSlug(token) : "";
  return [
    "@echo off",
    "title Desinstalar agente de impresion - quierocomer",
    "echo.",
    "echo   Desinstalando el agente de impresion de este local...",
    `taskkill /IM AgenteImpresion${slug}.exe /F >nul 2>&1`,
    `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v QuieroComerAgente${slug} /f >nul 2>&1`,
    `rmdir /s /q "%LOCALAPPDATA%\\QuieroComerAgente${slug}" >nul 2>&1`,
    "echo.",
    "echo   Listo. El agente de este local se detuvo, se quito del arranque y se borro.",
    "echo   Ya puedes cerrar esta ventana.",
    "echo.",
    "pause",
    "exit /b",
  ].join("\r\n");
}

// ─── Instalador PowerShell (corre en el mismo scope del .bat: $f y $bat existen) ───
const INSTALLER_PS = String.raw`$ErrorActionPreference = 'Stop'
try {
  $src = $f.Substring($f.IndexOf([char]35 + 'CSHARP') + 7)
  $dir = Join-Path $env:LOCALAPPDATA 'QuieroComerAgente__SLUG__'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $cs  = Join-Path $dir 'Agente.cs'
  $exe = Join-Path $dir 'AgenteImpresion__SLUG__.exe'
  [IO.File]::WriteAllText($cs, $src, (New-Object System.Text.UTF8Encoding($false)))

  # Cierra una instancia previa (de ESTE local) para recompilar sobre el mismo .exe
  Get-Process -Name 'AgenteImpresion__SLUG__' -ErrorAction SilentlyContinue | Stop-Process -Force
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
  Set-ItemProperty -Path $run -Name 'QuieroComerAgente__SLUG__' -Value ('"' + $exe + '"')

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

// Ícono de bandeja (logo QuieroComer) en .ico multi-tamaño, base64. Va embebido
// como constante en el C#; si por algo falla la decodificación, cae a un ícono del sistema.
const AGENT_ICON_B64 = "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";

// ─── Código C# del agente de bandeja (ASCII puro; token/URL embebidos) ───
function buildAgentCSharp(token: string, baseUrl: string, label?: string): string {
  const t = token.replace(/["\\]/g, "");
  const b = baseUrl.replace(/["\\]/g, "");
  // Etiqueta visible en el tooltip/globo (ASCII, sin comillas) para distinguir
  // varios agentes en un mismo PC. Ej: "Haruna", "Hand Roll".
  const lbl = (label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^ -~]/g, "").replace(/["\\]/g, "").trim().slice(0, 40);
  const suffix = lbl ? ` - ${lbl}` : "";
  return String.raw`using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
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

  [DataContract] public class PrinterCfg {
    [DataMember(Name="target")] public string target; // "default" | "name" | "ip"
    [DataMember(Name="name")] public string name;     // nombre exacto de la impresora de Windows
    [DataMember(Name="ip")] public string ip;         // IP o IP:puerto (ESC/POS directo, 9100 por defecto)
  }

  [DataContract] public class QueueResp {
    [DataMember(Name="ok")] public bool ok;
    [DataMember(Name="store")] public string store;
    [DataMember(Name="paperWidth")] public double? paperWidth;
    [DataMember(Name="printer")] public PrinterCfg printer;
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
    const string ICON    = "${AGENT_ICON_B64}";
    const int EscT     = 2;    // tabla de codigos ESC/POS (2 = PC850, acentos)
    const int CodePage = 850;  // code page .NET para codificar el texto
    const int PollSec  = 5;    // cada cuantos segundos consulta pedidos

    NotifyIcon ni;
    Control sync;
    Thread worker;
    volatile bool running = true;
    volatile PrinterCfg lastPrinter; // ultima config de impresora vista en la cola (para la prueba local)
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
      try {
        byte[] icoBytes = Convert.FromBase64String(ICON);
        using (MemoryStream ims = new MemoryStream(icoBytes)) { ni.Icon = new Icon(ims, SystemInformation.SmallIconSize); }
      } catch { ni.Icon = SystemIcons.Information; }
      ni.Text = "Agente de impresion quierocomer${suffix}";
      ni.Visible = true;
      ni.ContextMenuStrip = menu;

      worker = new Thread(new ThreadStart(Loop)); worker.IsBackground = true; worker.Start();
      Balloon("Agente activo${suffix}", "Esperando pedidos de quierocomer.");
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

    // ESC/POS directo por socket TCP (impresoras de red, tipico puerto 9100). Sin driver.
    static bool SendTcp(string host, int port, byte[] bytes) {
      try {
        using (TcpClient c = new TcpClient()) {
          IAsyncResult ar = c.BeginConnect(host, port, null, null);
          if (!ar.AsyncWaitHandle.WaitOne(4000)) return false; // timeout de conexion
          c.EndConnect(ar);
          using (NetworkStream s = c.GetStream()) { s.Write(bytes, 0, bytes.Length); s.Flush(); }
        }
        return true;
      } catch { return false; }
    }

    // Imprime segun la config vista en la cola: ip -> socket 9100 | name -> por nombre | default.
    // Devuelve en 'target' a donde se envio (para los avisos).
    bool PrintBytes(byte[] bytes, out string target) {
      PrinterCfg pc = lastPrinter;
      if (pc != null && pc.target == "ip" && !string.IsNullOrEmpty(pc.ip)) {
        string host = pc.ip.Trim(); int port = 9100;
        int idx = host.IndexOf(':');
        if (idx > 0) {
          string ps = host.Substring(idx + 1); host = host.Substring(0, idx);
          int pp; if (int.TryParse(ps, out pp) && pp > 0) port = pp;
        }
        target = host + ":" + port;
        return SendTcp(host, port, bytes);
      }
      if (pc != null && pc.target == "name" && !string.IsNullOrEmpty(pc.name)) {
        target = pc.name;
        return RawPrinter.Send(pc.name, bytes);
      }
      string dp = DefaultPrinter();
      target = string.IsNullOrEmpty(dp) ? "(predeterminada)" : dp;
      return RawPrinter.Send(dp, bytes);
    }

    void Loop() {
      while (running) {
        try {
          WebClient wc = new WebClient(); wc.Encoding = Encoding.UTF8;
          string json = wc.DownloadString(BASEURL + "/api/print/queue?token=" + TOKEN);
          DataContractJsonSerializer ser = new DataContractJsonSerializer(typeof(QueueResp));
          QueueResp resp;
          using (MemoryStream ms = new MemoryStream(Encoding.UTF8.GetBytes(json))) { resp = (QueueResp)ser.ReadObject(ms); }
          if (resp != null && resp.ok) {
            lastPrinter = resp.printer; // recordar la config para la prueba local
          }
          if (resp != null && resp.ok && resp.orders != null) {
            int width = (resp.paperWidth.HasValue && (int)resp.paperWidth.Value == 58) ? 58 : 80;
            foreach (Order o in resp.orders) {
              try {
                byte[] bytes = BuildTicket(o, resp.store, width);
                string target;
                bool ok = PrintBytes(bytes, out target);
                if (ok) { Ack(o.id); Balloon("Comanda impresa", "Pedido #" + NumStr(o.orderNumber)); }
                else { Balloon("Error de impresion", "Revisa la impresora: " + target); }
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
        string target;
        bool ok = PrintBytes(BuildTicket(o, "QUIEROCOMER", 80), out target);
        Balloon(ok ? "Prueba enviada" : "Error", ok ? ("Impresora: " + target) : ("Revisa la impresora: " + target));
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
