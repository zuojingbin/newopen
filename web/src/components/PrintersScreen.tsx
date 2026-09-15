import { useEffect, useState } from "react";
import {
  deletePrinter,
  getPrintJob,
  listPrinters,
  saveLanPrinter,
  scanLanPrinters,
  sendPrint,
} from "../lib/api";
import type { DiscoveredPrinter, Printer, PrintJobStatus } from "../lib/types";

export function PrintersScreen({ batchCode }: { batchCode: string }) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState("");
  const [copies, setCopies] = useState(1);
  const [job, setJob] = useState<PrintJobStatus | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const { printers } = await listPrinters();
      setPrinters(printers);
      if (!selected && printers.length) setSelected(printers[0].id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleScan() {
    setScanning(true);
    setError("");
    try {
      const { printers } = await scanLanPrinters();
      setDiscovered(printers);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function handleAdd(p: DiscoveredPrinter) {
    await saveLanPrinter(p.name, p.uri);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deletePrinter(id);
    await refresh();
  }

  async function handlePrint() {
    if (!batchCode || !selected) return;
    setError("");
    setJob(null);
    try {
      const res = await sendPrint(batchCode, selected, copies);
      const status = await getPrintJob(res.jobId);
      setJob(status);
      if (status.status === "pending" || status.status === "in_progress") {
        const t = setInterval(async () => {
          const s = await getPrintJob(res.jobId);
          setJob(s);
          if (s.status === "done" || s.status === "error") clearInterval(t);
        }, 3000);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>局域网打印机</h2>
      <p className="hint">手机/电脑需要和打印机在同一个 WiFi/局域网下才能扫描到。</p>
      <div className="toolbar">
        <button onClick={handleScan} disabled={scanning}>
          {scanning ? "扫描中…" : "扫描局域网打印机"}
        </button>
      </div>
      {discovered.length > 0 && (
        <ul className="printer-list">
          {discovered.map((p) => (
            <li key={p.uri}>
              <span>
                {p.name} <span className="hint">{p.uri}</span>
              </span>
              <button onClick={() => handleAdd(p)}>添加</button>
            </li>
          ))}
        </ul>
      )}

      <h2>远程打印机</h2>
      <p className="hint">
        跨网络打印（比如打印机在家里，人在学校）需要先在打印机所在的局域网内运行一次{" "}
        <code>printer-agent</code>（见项目 <code>printer-agent/README.md</code>），注册成功后会自动出现在下面的打印机列表里。
      </p>

      <h2>已保存的打印机</h2>
      {error && <p className="error">{error}</p>}
      <ul className="printer-list">
        {printers.map((p) => (
          <li key={p.id}>
            <span>
              <span className={`dot ${p.online ? "online" : "offline"}`} />
              {p.name} <span className="hint">({p.kind === "lan" ? "局域网" : "远程"})</span>
            </span>
            <button className="link-danger" onClick={() => handleDelete(p.id)}>
              移除
            </button>
          </li>
        ))}
      </ul>

      <h2>打印</h2>
      {!batchCode && <p className="hint">请先在"导入排版"页生成打印 PDF。</p>}
      {batchCode && (
        <div className="toolbar">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label>
            份数{" "}
            <input
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Number(e.target.value) || 1)}
              style={{ width: 60 }}
            />
          </label>
          <button className="primary" onClick={handlePrint} disabled={!selected}>
            打印批次 {batchCode}
          </button>
          {job && (
            <span className="hint">
              任务状态：{job.status}
              {job.error ? ` (${job.error})` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
