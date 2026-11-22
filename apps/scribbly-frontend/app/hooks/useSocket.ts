import { useEffect, useState } from "react";
import { WS_URL } from "../config";

// 🔌 Same lifecycle as apps/web's hook: one socket per component mount,
// cleaned up on unmount. The browser attaches the httpOnly auth cookie to the
// WS handshake automatically, so no token handling happens here.
export function useSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setSocket(ws);

    return () => ws.close();
  }, []);

  return socket;
}
