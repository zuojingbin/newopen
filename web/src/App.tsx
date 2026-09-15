import { useState } from "react";
import { BatchScreen } from "./components/BatchScreen";
import { PrintersScreen } from "./components/PrintersScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { getServerUrl } from "./lib/api";

type Tab = "batch" | "print" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>(getServerUrl() ? "batch" : "settings");
  const [printBatchCode, setPrintBatchCode] = useState("");
  const [hasServer, setHasServer] = useState(!!getServerUrl());

  return (
    <div className="app">
      <header className="app-header">
        <h1>作业打印助手</h1>
        <nav className="tabs">
          <button className={tab === "batch" ? "active" : ""} onClick={() => setTab("batch")}>
            导入排版
          </button>
          <button className={tab === "print" ? "active" : ""} onClick={() => setTab("print")}>
            打印机
          </button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
            设置
          </button>
        </nav>
      </header>

      <main>
        {!hasServer ? (
          <SettingsPanel
            onSaved={() => {
              setHasServer(true);
              setTab("batch");
            }}
          />
        ) : tab === "batch" ? (
          <BatchScreen
            onGoPrint={(code) => {
              setPrintBatchCode(code);
              setTab("print");
            }}
          />
        ) : tab === "print" ? (
          <PrintersScreen batchCode={printBatchCode} />
        ) : (
          <SettingsPanel onSaved={() => setTab("batch")} />
        )}
      </main>
    </div>
  );
}
