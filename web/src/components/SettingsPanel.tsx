import { useState } from "react";
import { getServerUrl, setServerUrl } from "../lib/api";

export function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [value, setValue] = useState(getServerUrl());

  return (
    <div className="panel">
      <h2>服务器设置</h2>
      <p className="hint">
        填写后端服务地址（部署 <code>server/</code> 之后得到的地址），例如{" "}
        <code>https://printer.example.com</code>。手机和电脑打开本页面时都需要填写同一个地址。
      </p>
      <div className="field-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://your-server.example.com"
        />
        <button
          className="primary"
          onClick={() => {
            setServerUrl(value.trim());
            onSaved();
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}
