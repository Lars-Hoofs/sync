import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from '../shared/utils/logger.js';
import { EventEmitter } from 'events';

const logger = createLogger('WebSocketService');

interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  userId: string;
  chatBotId?: string;
  subscriptions: Set<string>;
}

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, WebSocketConnection>();
  private userConnections = new Map<string, Set<string>>();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    
    this.wss.on('connection', (socket, request) => {
      this.handleConnection(socket, request);
    });

    logger.info(`WebSocket server started on port ${port}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: any) {
    const connectionId = this.generateConnectionId();
    
    // Extract user info from query parameters or headers
    const url = new URL(request.url, `http://${request.headers.host}`);
    const userId = url.searchParams.get('userId');
    const chatBotId = url.searchParams.get('chatBotId');

    if (!userId) {
      socket.close(1008, 'User ID is required');
      return;
    }

    const connection: WebSocketConnection = {
      id: connectionId,
      socket,
      userId,
      chatBotId: chatBotId || undefined,
      subscriptions: new Set()
    };

    this.connections.set(connectionId, connection);
    
    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    logger.info(`WebSocket connection established: ${connectionId} for user ${userId}`);

    socket.on('message', (data) => {
      this.handleMessage(connectionId, data);
    });

    socket.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    socket.on('error', (error) => {
      logger.error({ error, connectionId }, 'WebSocket error');
      this.handleDisconnection(connectionId);
    });

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connected',
      data: {
        connectionId,
        message: 'WebSocket connection established'
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(connectionId: string, data: any) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(connectionId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(connectionId, message.data);
          break;
        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong' });
          break;
        default:
          logger.warn({ connectionId, messageType: message.type }, 'Unknown message type');
      }
    } catch (error) {
      logger.error({ error, connectionId }, 'Error handling WebSocket message');
    }
  }

  /**
   * Handle subscription to events
   */
  private handleSubscription(connectionId: string, data: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { eventType, resourceId } = data;
    const subscriptionKey = `${eventType}:${resourceId}`;
    
    connection.subscriptions.add(subscriptionKey);
    
    this.sendToConnection(connectionId, {
      type: 'subscribed',
      data: {
        eventType,
        resourceId,
        message: `Subscribed to ${eventType} events for ${resourceId}`
      }
    });

    logger.info({ connectionId, subscriptionKey }, 'Client subscribed to events');
  }

  /**
   * Handle unsubscription from events
   */
  private handleUnsubscription(connectionId: string, data: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { eventType, resourceId } = data;
    const subscriptionKey = `${eventType}:${resourceId}`;
    
    connection.subscriptions.delete(subscriptionKey);
    
    this.sendToConnection(connectionId, {
      type: 'unsubscribed',
      data: {
        eventType,
        resourceId,
        message: `Unsubscribed from ${eventType} events for ${resourceId}`
      }
    });

    logger.info({ connectionId, subscriptionKey }, 'Client unsubscribed from events');
  }

  /**
   * Handle connection disconnect
   */
  private handleDisconnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    this.connections.delete(connectionId);
    
    logger.info(`WebSocket connection closed: ${connectionId}`);
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(connectionId: string, message: any) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error({ error, connectionId }, 'Error sending message');
      return false;
    }
  }

  /**
   * Broadcast message to all connections subscribed to an event
   */
  public broadcast(eventType: string, resourceId: string, data: any) {
    const subscriptionKey = `${eventType}:${resourceId}`;
    let sentCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(subscriptionKey)) {
        const sent = this.sendToConnection(connection.id, {
          type: eventType,
          resourceId,
          data,
          timestamp: new Date().toISOString()
        });
        if (sent) sentCount++;
      }
    }

    logger.debug({ eventType, resourceId, sentCount }, 'Broadcasted event to subscribers');
    return sentCount;
  }

  /**
   * Send message to all connections of a specific user
   */
  public sendToUser(userId: string, message: any) {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    let sentCount = 0;
    for (const connectionId of userConnections) {
      const sent = this.sendToConnection(connectionId, message);
      if (sent) sentCount++;
    }

    return sentCount;
  }

  /**
   * Send crawl progress update
   */
  public sendCrawlProgress(crawlId: string, progress: any) {
    this.broadcast('crawl_progress', crawlId, progress);
  }

  /**
   * Send crawl completion notification
   */
  public sendCrawlCompleted(crawlId: string, result: any) {
    this.broadcast('crawl_completed', crawlId, result);
  }

  /**
   * Send crawl error notification
   */
  public sendCrawlError(crawlId: string, error: any) {
    this.broadcast('crawl_error', crawlId, error);
  }

  /**
   * Send file processing progress
   */
  public sendFileProgress(fileId: string, progress: any) {
    this.broadcast('file_progress', fileId, progress);
  }

  /**
   * Send file processing completion
   */
  public sendFileCompleted(fileId: string, result: any) {
    this.broadcast('file_completed', fileId, result);
  }

  /**
   * Send file processing error
   */
  public sendFileError(fileId: string, error: any) {
    this.broadcast('file_error', fileId, error);
  }

  /**
   * Setup event handlers for crawl and file processing events
   */
  private setupEventHandlers() {
    // Listen for events from other services
    this.on('crawl:progress', (crawlId: string, progress: any) => {
      this.sendCrawlProgress(crawlId, progress);
    });

    this.on('crawl:completed', (crawlId: string, result: any) => {
      this.sendCrawlCompleted(crawlId, result);
    });

    this.on('crawl:error', (crawlId: string, error: any) => {
      this.sendCrawlError(crawlId, error);
    });

    this.on('file:progress', (fileId: string, progress: any) => {
      this.sendFileProgress(fileId, progress);
    });

    this.on('file:completed', (fileId: string, result: any) => {
      this.sendFileCompleted(fileId, result);
    });

    this.on('file:error', (fileId: string, error: any) => {
      this.sendFileError(fileId, error);
    });
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      totalConnections: this.connections.size,
      totalUsers: this.userConnections.size,
      connections: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        userId: conn.userId,
        chatBotId: conn.chatBotId,
        subscriptions: Array.from(conn.subscriptions)
      }))
    };
  }

  /**
   * Close all connections and shutdown server
   */
  public shutdown() {
    for (const connection of this.connections.values()) {
      connection.socket.close();
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.connections.clear();
    this.userConnections.clear();
    
    logger.info('WebSocket service shut down');
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
