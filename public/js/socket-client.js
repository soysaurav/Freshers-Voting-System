/**
 * Auto-reconnecting WebSocket Client for Voting System
 */
class VotingSocket {
  constructor(options = {}) {
    this.options = Object.assign({
      url: null,
      onConnect: () => {},
      onDisconnect: () => {},
      onStateUpdate: () => {},
      onCountdown: () => {},
      onReveal: () => {},
      onToast: () => {},
      onError: () => {}
    }, options);

    this.ws = null;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.isConnected = false;
    this.init();
  }

  getWsUrl() {
    if (this.options.url) return this.options.url;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isVoter = window.location.pathname.startsWith('/vote');
    const role = isVoter ? 'voter' : (this.options.role || 'other');
    return `${protocol}//${window.location.host}/ws?role=${role}`;
  }

  init() {
    const url = this.getWsUrl();
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.options.onConnect();
      this.startPing();
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.stopPing();
      this.options.onDisconnect();
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      this.options.onError(err);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('Error parsing WS message:', e, event.data);
      }
    };
  }

  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 15000);
  }

  stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.init();
    }, 2000);
  }

  send(data) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'state':
        this.options.onStateUpdate(msg.data);
        break;
      case 'countdown':
        this.options.onCountdown(msg.data);
        break;
      case 'reveal':
        this.options.onReveal(msg.data);
        break;
      case 'performer_reveal':
        if (this.options.onPerformerReveal) {
          this.options.onPerformerReveal(msg.data);
        } else {
          this.options.onReveal(msg.data);
        }
        break;
      case 'toast':
        this.options.onToast(msg.data);
        break;
      case 'online_count':
        if (this.options.onOnlineCount) {
          this.options.onOnlineCount(msg.data);
        }
        break;
      case 'qr_updated':
        if (this.options.onQrUpdated) {
          this.options.onQrUpdated(msg.data);
        }
        break;
      case 'client_info':
        if (this.options.onClientInfo) {
          this.options.onClientInfo(msg.data);
        }
        break;
      case 'pong':
        break;
      default:
        console.log('Unhandled message:', msg);
    }
  }
}
window.VotingSocket = VotingSocket;
