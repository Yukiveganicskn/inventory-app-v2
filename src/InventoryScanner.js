import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function InventoryScanner() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState(null);
  const [adjustment, setAdjustment] = useState(1);
  const [mode, setMode] = useState("add");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [alert, setAlert] = useState(false);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const codeReader = useRef(null);

  const SHEET_POST_URL = "https://script.google.com/macros/s/AKfycbyxds-D5qUSs4oMZ0h_3IuqgFyALVGyaNUqJ4iTSbPd8zckQ1rgGQqiltJMkDXI0zFk/exec";

  const fetchProduct = async () => {
    const res = await fetch(SHEET_POST_URL);
    const data = await res.json();
    const found = data.find(item => item["Product Code"] === barcode.trim().toUpperCase());
    if (found) {
      const stock = Number(found["Stock Quantity"]);
      setProduct({
        name: found["Production"],
        code: found["Product Code"],
        stock
      });
      setAlert(stock <= 10);
      setMessage("");
    } else {
      setProduct(null);
      setMessage("商品が見つかりませんでした。");
    }
  };

  const handleUpdate = async () => {
    if (!product) return;
    let newStock = mode === "add"
      ? product.stock + Number(adjustment)
      : Math.max(product.stock - Number(adjustment), 0);

    const updatedProduct = { ...product, stock: newStock };
    setProduct(updatedProduct);
    setAlert(newStock <= 10);
    setHistory(prev => [...prev, { ...updatedProduct, mode, adjustment: Number(adjustment), time: new Date().toLocaleString() }]);
    setMessage(`在庫を更新しました：${newStock} 個`);

    await fetch(SHEET_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: product.code,
        newStock,
        mode,
        adjustment: Number(adjustment),
        time: new Date().toLocaleString()
      })
    });
  };

  useEffect(() => {
    inputRef.current?.focus();

    if (!codeReader.current) {
      codeReader.current = new BrowserMultiFormatReader();
    }

    const startScan = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length > 0) {
          codeReader.current.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (result, err) => {
            if (result) {
              setBarcode(result.getText());
              fetchProduct();
            }
          });
        }
      } catch (err) {
        console.error("バーコードスキャンに失敗しました", err);
      }
    };

    startScan();

    return () => {
      if (codeReader.current) {
        codeReader.current.reset();
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <div style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8 }}>
        <input
          ref={inputRef}
          placeholder="バーコードを入力またはスキャン"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchProduct()}
          style={{ width: "100%", padding: 8, fontSize: 16, marginBottom: 8 }}
        />
        <button onClick={fetchProduct} style={{ padding: "8px 16px", fontSize: 16 }}>スキャン</button>

        <video ref={videoRef} width="100%" style={{ marginTop: 12, borderRadius: 8, maxHeight: 200 }} muted playsInline />

        {product && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 18, fontWeight: "bold" }}>{product.name}</p>
            <p style={{ color: alert ? "red" : "black" }}>
              現在の在庫：{product.stock} 個 {alert && "⚠️ 在庫少なめ"}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{ padding: 4 }}
              >
                <option value="add">＋追加</option>
                <option value="remove">−減少</option>
              </select>
              <input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                style={{ width: 60, padding: 4 }}
              />
              <button onClick={handleUpdate} style={{ padding: "4px 12px" }}>在庫を更新</button>
            </div>
          </div>
        )}
        {message && <p style={{ color: "green", marginTop: 12 }}>{message}</p>}
      </div>

      {history.length > 0 && (
        <div style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 20 }}>
          <p style={{ fontWeight: "bold" }}>📋 更新履歴</p>
          <ul style={{ fontSize: 14, maxHeight: 200, overflowY: "auto", paddingLeft: 16 }}>
            {history.map((entry, index) => (
              <li key={index}>
                [{entry.time}] {entry.name} - {entry.mode === "add" ? "+" : "−"}{entry.adjustment} → {entry.stock}個
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
