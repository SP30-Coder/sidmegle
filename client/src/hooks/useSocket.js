import { useEffect, useRef, useState, useCallback } from 'react';
import { createSocket, disconnectSocket } from '../services/socket';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected'); // connected|connecting|disconnected
  const [sessionId, setSessionId] = useState(null);
  const [online, setOnline] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const s = createSocket();
    ref.current = s;
    setSocket(s);
    setConnectionState(s.connected ? 'connected' : 'connecting');

    const onConnect = () => setConnectionState('connected');
    const onDisconnect = () => setConnectionState('disconnected');
    const onConnectError = () => setConnectionState('disconnected');
    const onSession = ({ sessionId }) => setSessionId(sessionId);
    const onOnline = (d) => setOnline(d);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.on('session', onSession);
    s.on('onlineCount', onOnline);
    // reconnecting state
    s.io.on('reconnect_attempt', () => setConnectionState('connecting'));

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off('session', onSession);
      s.off('onlineCount', onOnline);
    };
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
    setSocket(null);
    setConnectionState('disconnected');
  }, []);

  return { socket, connectionState, sessionId, online, disconnect };
}
