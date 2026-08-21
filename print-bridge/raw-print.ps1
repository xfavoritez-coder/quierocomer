# raw-print.ps1 — Envía bytes ESC/POS directo al spooler de Windows (modo RAW)
# Uso: powershell -File raw-print.ps1 <rutaArchivo> <nombreImpresora>
param(
  [Parameter(Mandatory=$true)] [string]$FilePath,
  [Parameter(Mandatory=$true)] [string]$PrinterName
)

$bytes = [System.IO.File]::ReadAllBytes($FilePath)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrint {
  [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DocInfo di);

  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public class DocInfo {
  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
"@ -ErrorAction Stop

$hPrinter = [IntPtr]::Zero
$di       = New-Object DocInfo
$di.pDocName  = "POS-Comanda"
$di.pDataType = "RAW"

if (-not [RawPrint]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)) {
  Write-Error "No se pudo abrir la impresora: $PrinterName"
  exit 1
}

[RawPrint]::StartDocPrinter($hPrinter, 1, $di)  | Out-Null
[RawPrint]::StartPagePrinter($hPrinter)          | Out-Null

$ptr     = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
$written = 0
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
[RawPrint]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)

[RawPrint]::EndPagePrinter($hPrinter)  | Out-Null
[RawPrint]::EndDocPrinter($hPrinter)   | Out-Null
[RawPrint]::ClosePrinter($hPrinter)    | Out-Null

Write-Output "OK:$written"
exit 0
