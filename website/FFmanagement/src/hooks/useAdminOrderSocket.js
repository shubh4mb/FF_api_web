// src/hooks/useAdminOrderSocket.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../utils/axios.config';

/**
 * Socket.IO hook for Admin real-time orders feed.
 * Automatically connects to backend socket server, joins the 'admin:orders' room,
 * and streams newOrder and orderUpdate events across all merchants.
 */
export const useAdminOrderSocket = ({ onNewOrder, onOrderUpdate } = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [lastEventTime, setLastEventTime] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const socketRef = useRef(null);

  // Keep callback refs stable to prevent reconnect churn
  const onNewOrderRef = useRef(onNewOrder);
  const onOrderUpdateRef = useRef(onOrderUpdate);

  useEffect(() => {
    onNewOrderRef.current = onNewOrder;
  }, [onNewOrder]);

  useEffect(() => {
    onOrderUpdateRef.current = onOrderUpdate;
  }, [onOrderUpdate]);

  const connectSocket = useCallback(() => {
    // Derive raw socket host by stripping /api/ from baseURL
    let rawHost = API_URL || 'http://localhost:5000/api/';
    const socketUrl = rawHost.replace(/\/api\/?$/, '');

    console.log(`🔌 [AdminSocket] Connecting to socket URL: ${socketUrl}`);
    setIsConnecting(true);

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(socketUrl, {
      query: { role: 'admin' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`✅ [AdminSocket] Connected successfully with ID: ${socket.id}`);
      setIsConnected(true);
      setIsConnecting(false);
      setSocketId(socket.id);

      // Join the administrative broadcast room
      socket.emit('joinAdminOrders');
    });

    socket.on('disconnect', (reason) => {
      console.warn(`❌ [AdminSocket] Disconnected: ${reason}`);
      setIsConnected(false);
      setIsConnecting(false);
    });

    socket.on('connect_error', (error) => {
      console.error('⚠️ [AdminSocket] Connection error:', error.message);
      setIsConnected(false);
      setIsConnecting(true);
    });

    // Handle incoming new orders from any merchant
    const handleNewOrder = (orderData) => {
      console.log('🚨 [AdminSocket] newOrder received:', orderData);
      setLastEventTime(new Date());
      if (onNewOrderRef.current) {
        onNewOrderRef.current(orderData);
      }
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('newWarehouseOrder', handleNewOrder);

    // Handle status changes (accepted, packed, in_transit, etc.)
    const handleOrderUpdate = (updatePayload) => {
      console.log('🔄 [AdminSocket] orderUpdate received:', updatePayload);
      setLastEventTime(new Date());
      if (onOrderUpdateRef.current) {
        onOrderUpdateRef.current(updatePayload);
      }
    };

    socket.on('orderUpdate', handleOrderUpdate);
    socket.on('warehouseOrderUpdate', handleOrderUpdate);

    return socket;
  }, []);

  useEffect(() => {
    const socket = connectSocket();

    return () => {
      if (socket) {
        socket.emit('leaveAdminOrders');
        socket.disconnect();
      }
    };
  }, [connectSocket]);

  const reconnect = useCallback(() => {
    connectSocket();
  }, [connectSocket]);

  return {
    isConnected,
    isConnecting,
    socketId,
    lastEventTime,
    reconnect,
  };
};

export default useAdminOrderSocket;
