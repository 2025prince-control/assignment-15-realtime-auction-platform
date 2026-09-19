require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const {
  auctions,
  handleBidPlacement,
  handleRoomJoin,
  updateRoomViewers,
  resetAuction,
  setAuctionTime,
  initAuctionTimers
} = require('./sockets/auctionEngine');

const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Server Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ---------------- REST API ENDPOINTS ---------------- //

// List all auctions
app.get('/api/auctions', (req, res) => {
  const auctionList = Object.values(auctions).map(a => ({
    id: a.id,
    title: a.title,
    category: a.category,
    image: a.image,
    startingPrice: a.startingPrice,
    currentBid: a.currentBid,
    highestBidder: a.highestBidder ? a.highestBidder.username : null,
    minIncrement: a.minIncrement,
    timeRemainingSeconds: a.timeRemainingSeconds,
    status: a.status,
    totalBids: a.bidHistory.length,
    viewers: a.viewers
  }));
  res.json({ success: true, count: auctionList.length, auctions: auctionList });
});

// Get single auction status
app.get('/api/auctions/:id', (req, res) => {
  const auction = auctions[req.params.id];
  if (!auction) {
    return res.status(404).json({ success: false, error: 'Auction not found' });
  }
  res.json({ success: true, auction });
});

// Reset auction state (useful for live demonstrations & tests)
app.post('/api/auctions/:id/reset', (req, res) => {
  const { id } = req.params;
  const { seconds } = req.body || {};
  const updated = resetAuction(io, id, seconds);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Auction not found' });
  }
  res.json({ success: true, message: `Auction ${id} reset successfully`, auction: updated });
});

// ---------------- REAL-TIME SOCKET.IO EVENTS ---------------- //

io.on('connection', (socket) => {
  // 1. Join auction floor room
  socket.on('auction:join', (payload) => {
    handleRoomJoin(io, socket, payload);
  });

  // 2. Place a bid
  socket.on('bid:place', (payload) => {
    const { auctionId, amount, username, balance } = payload || {};
    const auction = auctions[auctionId];
    const bidderName = username || socket.username || 'Anonymous';
    handleBidPlacement(io, socket, auction, amount, bidderName, balance);
  });

  // 3. Reset auction floor (admin / quick test action)
  socket.on('auction:reset', (payload) => {
    const { auctionId, seconds } = payload || {};
    if (auctionId && auctions[auctionId]) {
      resetAuction(io, auctionId, seconds);
    }
  });

  // 4. Adjust auction time dynamically
  socket.on('auction:set_timer', (payload) => {
    const { auctionId, seconds } = payload || {};
    if (auctionId && auctions[auctionId]) {
      setAuctionTime(io, auctionId, seconds);
    }
  });

  // 4. Handle Disconnect
  socket.on('disconnect', () => {
    if (socket.currentAuctionId) {
      updateRoomViewers(io, socket.currentAuctionId);
      io.to(socket.currentAuctionId).emit('user:left', {
        username: socket.username || 'A bidder',
        totalViewers: auctions[socket.currentAuctionId]?.viewers || 0
      });
    }
  });
});

// Initialize countdown timers for active auctions
initAuctionTimers(io);

// Start server only if executed directly
if (require.main === module) {
  const net = require('net');

  function checkPort(port, cb) {
    const tester = net.createServer()
      .once('error', (err) => (err.code === 'EADDRINUSE' ? cb(false) : cb(true)))
      .once('listening', () => tester.once('close', () => cb(true)).close())
      .listen(port);
  }

  const requestedPort = parseInt(process.env.PORT || '5000', 10);
  checkPort(requestedPort, (available) => {
    const finalPort = available ? requestedPort : 5001;
    if (!available) {
      console.warn(`⚠️ Port ${requestedPort} is occupied (macOS AirPlay Receiver reserves port 5000). Serving on http://localhost:${finalPort}`);
    }
    server.listen(finalPort, () => {
      console.log(`=======================================================`);
      console.log(`🔥 Real-Time Live Auction & Bidding Engine running!`);
      console.log(`📡 Server listening on: http://localhost:${finalPort}`);
      console.log(`⚡ Socket.io real-time engine active`);
      console.log(`=======================================================`);
    });
  });
}

module.exports = { app, server, io };
