# 🔨 Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io)

**Track:** Backend & Real-Time Web | **Level:** Advanced | **Estimated Time:** 8–10 Hours  
**Tech Stack:** Node.js, Express.js, Socket.io, In-Memory State Engine, Timer Synchronizer, CORS  
**Live Deployment:** [https://assignment-15-realtime-auction-platform-t577.onrender.com](https://assignment-15-realtime-auction-platform-t577.onrender.com/)

---

## 📌 1. Objective & Overview

Architect a mission-critical, low-latency Real-Time Live Auction & Bidding Platform using **Node.js**, **Express.js**, and **Socket.io**. Build an authoritative bidding engine that prevents race conditions, enforces minimum bid increments, broadcasts real-time outbid notifications, synchronizes live countdown timers across all connected bidders, and implements **Anti-Snipe Timer Extensions** (extending auction time if a bid arrives in the final seconds).

### Key Learning Outcomes:
- Managing high-concurrency real-time transactional actions without race conditions.
- Broadcasting instantaneous outbid alerts and live ticker price updates.
- Implementing server-side countdown clocks and anti-sniping rules (soft-close timer reset).
- Building an authoritative bid validation engine (min increment check, self-outbid prohibition, wallet balance simulation).
- Maintaining an auditable live bid activity history feed per auction room.

---

## 🛠️ 2. Tech Stack & Dependencies

### Project Initialization & Dependencies
```bash
# Initialize project
npm init -y

# Install production dependencies
npm install express socket.io cors dotenv uuid

# Install development tools
npm install -D nodemon
```

### Running the Server
```bash
# Start production server
npm start

# Start with nodemon (development mode)
npm run dev
```

---

## 🏷️ 3. Auction Data Model & Room State

```javascript
// In-Memory Auction Room State
const auctions = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active", // "upcoming", "active", "ended", "sold"
    bidHistory: [],
    timerInterval: null
  }
};
```

---

## 📡 4. Real-Time Socket Event Protocol

### 🔄 Room & Stream Events

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `auction:join` | Client -> Server | `{ "auctionId": "AUC_VINTAGE_99", "username": "Vikram" }` | Join the live bidding floor room |
| `auction:init` | Server -> Client | `{ "item": { ... }, "bidHistory": [...], "timeRemaining": 45 }` | Hydrates current auction status to newly joined bidder |
| `auction:time_tick` | Server -> Room | `{ "auctionId": "...", "timeRemaining": 44 }` | Broadcasted every 1 second by authoritative server clock |
| `user:joined` | Server -> Room | `{ "username": "Vikram", "totalViewers": 14 }` | Updates live audience count when a participant joins |
| `user:left` | Server -> Room | `{ "username": "Vikram", "totalViewers": 13 }` | Updates live audience count when a participant leaves |

### 💰 Live Bidding Actions

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `bid:place` | Client -> Server | `{ "auctionId": "AUC_VINTAGE_99", "amount": 54000 }` | Bidder places a higher bid |
| `bid:success` | Server -> Room | `{ "newBid": 54000, "highestBidder": "Vikram", "timeRemaining": 30 }` | Broadcasts new leading price to all participants |
| `bid:outbid` | Server -> Client | `{ "message": "You have been outbid by Vikram at ₹54,000!" }` | Targeted alert sent strictly to the previous highest bidder |
| `bid:rejected` | Server -> Client | `{ "reason": "Bid must be at least ₹56,000" }` | Rejection error sent to invalid bid attempt |
| `auction:extended` | Server -> Room | `{ "message": "Anti-snipe triggered: +20 seconds added!" }` | Emitted when late bid extends the clock |
| `auction:sold` | Server -> Room | `{ "winner": "Vikram", "finalPrice": 62000, "status": "sold" }` | Emitted when clock hits 0 and reserve met |
| `auction:ended` | Server -> Room | `{ "winner": null, "finalPrice": 50000, "status": "ended" }` | Emitted when clock hits 0 without bids |

---

## 🛡️ 5. Authoritative Bidding & Anti-Snipe Engine

```javascript
// sockets/auctionEngine.js
function handleBidPlacement(io, socket, auction, bidAmount, username) {
  // 1. Check if auction is active
  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { reason: 'Auction is closed' });
  }

  // 2. Check if bidder is already the highest bidder
  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
  }

  // 3. Check minimum increment
  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit('bid:rejected', { 
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired}` 
    });
  }

  // 4. Capture previous highest bidder to notify outbid
  const previousBidder = auction.highestBidder;

  // 5. Update State
  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString()
  });

  // 6. Anti-Snipe Rule: If bid placed within last 15s, extend timer back to 20s
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    io.to(auction.id).emit('auction:extended', {
      timeRemaining: 20,
      message: 'Anti-snipe triggered: +20 seconds added!'
    });
  }

  // 7. Broadcast new top bid to room
  io.to(auction.id).emit('bid:success', {
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  // 8. Send private alert to outbid user
  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      message: `You were outbid by ${username} with ₹${bidAmount}!`
    });
  }
}
```

---

## 🏗️ 6. Directory Structure

```
assignment-15-auction-socket/
├── public/
│   ├── index.html           # Live bidding floor UI
│   ├── app.js               # Client socket handlers & bid buttons
│   └── style.css            # Dark trading floor aesthetic & animations
├── sockets/
│   ├── auctionEngine.js     # Bid validation, outbid alerts & anti-snipe logic
│   └── timerManager.js      # Server-side 1s interval countdown clock
├── server.js                # Server setup
├── package.json
└── README.md
```
