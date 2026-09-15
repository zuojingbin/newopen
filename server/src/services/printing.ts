import { Bonjour } from "bonjour-service";
// @ts-expect-error no bundled types for the `ipp` package
import ipp from "ipp";

export interface DiscoveredPrinter {
  name: string;
  host: string;
  port: number;
  uri: string;
}

/** Browse the LAN for IPP printers (mDNS `_ipp._tcp` / `_ipps._tcp`, the
 *  standard advertisement most network and cloud-enabled printers use). */
export function discoverLanPrinters(timeoutMs = 4000): Promise<DiscoveredPrinter[]> {
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const found = new Map<string, DiscoveredPrinter>();

    const onUp = (service: any, secure: boolean) => {
      const host: string = service.referer?.address ?? service.host;
      const port: number = service.port;
      const rp: string = service.txt?.rp ?? "ipp/print";
      const scheme = secure ? "ipps" : "ipp";
      const uri = `${scheme}://${host}:${port}/${rp}`.replace(/\/$/, "");
      found.set(uri, { name: service.name, host, port, uri });
    };

    const ippBrowser = bonjour.find({ type: "ipp" }, (s) => onUp(s, false));
    const ippsBrowser = bonjour.find({ type: "ipps" }, (s) => onUp(s, true));

    setTimeout(() => {
      ippBrowser.stop();
      ippsBrowser.stop();
      bonjour.destroy();
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

/** Send a ready-to-print PDF to an IPP-capable printer (LAN or, if reachable,
 *  a printer exposed over VPN/port-forward at a routable ipp(s):// URI). */
export function sendIppPrintJob(
  printerUri: string,
  pdfBytes: Uint8Array,
  jobName: string,
  copies = 1
): Promise<{ statusCode: string }> {
  return new Promise((resolve, reject) => {
    const printer = new ipp.Printer(printerUri);
    const msg = {
      "operation-attributes-tag": {
        "requesting-user-name": "printer-app",
        "job-name": jobName,
        "document-format": "application/pdf",
      },
      "job-attributes-tag": {
        copies,
      },
      data: Buffer.from(pdfBytes),
    };
    printer.execute("Print-Job", msg, (err: Error | null, res: any) => {
      if (err) return reject(err);
      resolve({ statusCode: res?.statusCode ?? "unknown" });
    });
  });
}
