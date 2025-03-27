import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

    // シートに書き込み
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
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-4">
          <Input
            ref={inputRef}
            placeholder="バーコードを入力またはスキャン"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchProduct()}
          />
          <Button onClick={fetchProduct}>スキャン</Button>

          <video ref={videoRef} width="100%" className="rounded-md" muted playsInline style={{ maxHeight: 200 }} />

          {product && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-lg font-semibold">{product.name}</p>
              <p className={alert ? "text-red-500 font-bold" : ""}>
                現在の在庫：{product.stock} 個 {alert && "⚠️ 在庫少なめ"}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="add">＋追加</option>
                  <option value="remove">−減少</option>
                </select>
                <Input
                  type="number"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  className="w-20"
                />
                <Button onClick={handleUpdate}>在庫を更新</Button>
              </div>
            </div>
          )}
          {message && <p className="text-sm text-green-600 pt-2">{message}</p>}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="font-semibold pb-2">📋 更新履歴</p>
            <ul className="text-sm space-y-1 max-h-60 overflow-auto">
              {history.map((entry, index) => (
                <li key={index}>
                  [{entry.time}] {entry.name} - {entry.mode === "add" ? "+" : "−"}{entry.adjustment} → {entry.stock}個
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
