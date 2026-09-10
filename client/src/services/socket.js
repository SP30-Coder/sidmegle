import { io } from 'socket.io-client';

let socket = null;

export function getSocketUrl() {
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
}

export function createSocket() {
  if (socket?.connected) return socket;
  if (socket) {
    try { socket.disconnect(); } catch { /* noop */ }
  }
  socket = io(getSocketUrl(), {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 800,
    timeout: 10000,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  try { socket?.disconnect(); } catch { /* noop */ }
  socket = null;
}

export function getIceServers() {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }
  return servers;
}
