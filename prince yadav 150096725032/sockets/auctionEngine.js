const { v4: uuidv4 } = require('uuid');
const { startAuctionTimer, resetAuctionTimer } = require('./timerManager');

// Initial seed data for live auctions
const initialAuctionData = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original sunburst nitrocellulose finish, rare hand-wound pickups, verified provenance. Museum-grade collector condition with original hardshell case.",
    category: "Vintage Guitars",
    image: "🎸",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    initialDuration: 60,
    status: "active", // "upcoming", "active", "ended", "sold"
    bidHistory: [],
    viewers: 0
  },
  "AUC_ROLEX_PAUL": {
    id: "AUC_ROLEX_PAUL",
    title: "1968 Rolex Daytona 'Paul Newman'",
    description: "Ref. 6239 with iconic exotic tricolor dial, Valjoux 722 manual-wind movement, and stainless steel riveted Oyster bracelet. Pristine historical piece.",
    category: "Horology",
    image: "⌚",
    startingPrice: 250000,
    currentBid: 250000,
    highestBidder: null,
    minIncrement: 10000,
    timeRemainingSeconds: 90,
    initialDuration: 90,
    status: "active",
    bidHistory: [],
    viewers: 0
  },
  "AUC_PORSCHE_911": {
    id: "AUC_PORSCHE_911",
    title: "1989 Porsche 911 Turbo Slantnose",
    description: "Factory Flachbau (M505) in Guards Red. Air-cooled 3.3L turbocharged flat-six with 5-speed G50 manual transmission and 18,000 documented miles.",
    category: "Collector Supercars",
    image: "🏎️",
    startingPrice: 1200000,
    currentBid: 1200000,
    highestBidder: null,
    minIncrement: 50000,
    timeRemainingSeconds: 120,
    initialDuration: 120,
    status: "active",
    bidHistory: [],
    viewers: 0
  }
};

// In-Memory Auction Room State
const auctions = JSON.parse(JSON.stringify(initialAuctionData));

/**
 * Validates and places a bid on an auction
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {object} auction
 * @param {number} bidAmount
 * @param {string} username
 * @param {number} [userBalance]
 */
function handleBidPlacement(io, socket, auction, bidAmount, username = 'Anonymous', userBalance = null) {
  // 1. Check if auction exists
  if (!auction) {
    return socket.emit('bid:rejected', { reason: 'Auction room not found' });
  }

  // 2. Check if auction is active
  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { 
      reason: 'Auction is closed',
      code: 'AUCTION_CLOSED'
    });
  }

  // 3. Check if bidder is already the highest bidder (prevent self-outbid)
  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { 
      reason: 'You are already the highest bidder',
      code: 'SELF_OUTBID_PROHIBITED'
    });
  }

  // Prevent same username from bidding against itself across tabs
  if (auction.highestBidder && auction.highestBidder.username.toLowerCase() === username.trim().toLowerCase()) {
    return socket.emit('bid:rejected', { 
      reason: `You are already holding the highest bid as ${username}`,
      code: 'SELF_OUTBID_PROHIBITED'
    });
  }

  // 4. Check minimum increment
  const numBid = Number(bidAmount);
  if (isNaN(numBid) || numBid <= 0) {
    return socket.emit('bid:rejected', { 
      reason: 'Invalid bid amount',
      code: 'INVALID_AMOUNT'
    });
  }

  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (numBid < minimumRequired) {
    return socket.emit('bid:rejected', { 
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString('en-IN')}`,
      minimumRequired,
      code: 'BID_TOO_LOW'
    });
  }

  // 5. Wallet balance check (if provided)
  if (userBalance !== null && userBalance !== undefined && userBalance < numBid) {
    return socket.emit('bid:rejected', {
      reason: `Insufficient wallet balance. You have ₹${userBalance.toLocaleString('en-IN')}, required: ₹${numBid.toLocaleString('en-IN')}`,
      code: 'INSUFFICIENT_FUNDS'
    });
  }

  // 6. Capture previous highest bidder to notify outbid
  const previousBidder = auction.highestBidder;
  const previousBid = auction.currentBid;

  // 7. Update State
  auction.currentBid = numBid;
  auction.highestBidder = { 
    socketId: socket.id, 
    username: username.trim() 
  };

  const bidEntry = {
    id: uuidv4(),
    bidder: username.trim(),
    amount: numBid,
    increment: numBid - previousBid,
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    fullTimestamp: new Date().toISOString()
  };

  auction.bidHistory.unshift(bidEntry);

  // 8. Anti-Snipe Rule: If bid placed within last 15s, extend timer back to 20s
  let antiSnipeTriggered = false;
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    antiSnipeTriggered = true;
    io.to(auction.id).emit('auction:extended', {
      auctionId: auction.id,
      timeRemaining: 20,
      message: 'Anti-snipe triggered: +20 seconds added!'
    });
  }

  // 9. Broadcast new top bid to room
  io.to(auction.id).emit('bid:success', {
    auctionId: auction.id,
    currentBid: auction.currentBid,
    newBid: auction.currentBid,
    highestBidder: username.trim(),
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds,
    antiSnipeTriggered,
    latestBidEntry: bidEntry
  });

  // 10. Send private targeted alert strictly to the previous highest bidder
  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      auctionId: auction.id,
      itemTitle: auction.title,
      message: `You were outbid by ${username.trim()} with ₹${numBid.toLocaleString('en-IN')}!`,
      newBid: numBid,
      outbidBy: username.trim()
    });
  }

  return { success: true, newBid: numBid, highestBidder: username.trim() };
}

/**
 * Handles client joining an auction room
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {object} payload
 */
function handleRoomJoin(io, socket, payload) {
  const { auctionId = 'AUC_VINTAGE_99', username = 'Bidder' } = payload || {};
  const cleanUsername = String(username).trim() || 'Anonymous';

  // Leave previous room if joined another
  if (socket.currentAuctionId && socket.currentAuctionId !== auctionId) {
    socket.leave(socket.currentAuctionId);
    updateRoomViewers(io, socket.currentAuctionId);
  }

  const auction = auctions[auctionId];
  if (!auction) {
    return socket.emit('auction:error', { message: `Auction ${auctionId} not found` });
  }

  // Join Socket.io room
  socket.join(auctionId);
  socket.currentAuctionId = auctionId;
  socket.username = cleanUsername;

  // Update room viewers count
  const room = io.sockets.adapter.rooms.get(auctionId);
  const totalViewers = room ? room.size : 1;
  auction.viewers = totalViewers;

  // Hydrate current auction status to newly joined bidder
  socket.emit('auction:init', {
    item: {
      id: auction.id,
      title: auction.title,
      description: auction.description,
      category: auction.category,
      image: auction.image,
      startingPrice: auction.startingPrice,
      minIncrement: auction.minIncrement,
      initialDuration: auction.initialDuration,
      status: auction.status
    },
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds,
    currentBid: auction.currentBid,
    highestBidder: auction.highestBidder ? auction.highestBidder.username : null,
    totalViewers
  });

  // Broadcast to room that new user joined
  io.to(auctionId).emit('user:joined', {
    username: cleanUsername,
    totalViewers
  });
}

/**
 * Updates viewer count in a room
 * @param {import('socket.io').Server} io
 * @param {string} auctionId
 */
function updateRoomViewers(io, auctionId) {
  if (!auctions[auctionId]) return;
  const room = io.sockets.adapter.rooms.get(auctionId);
  const totalViewers = room ? room.size : 0;
  auctions[auctionId].viewers = totalViewers;
  io.to(auctionId).emit('viewers:updated', {
    auctionId,
    totalViewers
  });
}

/**
 * Resets an auction to its initial state for demo/re-testing
 * @param {import('socket.io').Server} io
 * @param {string} auctionId
 * @param {number} [customSeconds]
 */
function resetAuction(io, auctionId, customSeconds) {
  const seed = initialAuctionData[auctionId];
  if (!seed || !auctions[auctionId]) return null;

  const seconds = customSeconds || seed.initialDuration || 60;
  auctions[auctionId] = {
    ...JSON.parse(JSON.stringify(seed)),
    timeRemainingSeconds: seconds,
    status: 'active',
    bidHistory: [],
    highestBidder: null,
    currentBid: seed.startingPrice
  };

  resetAuctionTimer(io, auctions[auctionId], seconds);

  io.to(auctionId).emit('auction:reset', {
    auctionId,
    item: auctions[auctionId],
    timeRemaining: seconds,
    message: `Auction for "${seed.title}" has been reset to ₹${seed.startingPrice.toLocaleString('en-IN')}`
  });

  return auctions[auctionId];
}

/**
 * Sets remaining time for an auction without clearing bids
 * @param {import('socket.io').Server} io
 * @param {string} auctionId
 * @param {number} seconds
 */
function setAuctionTime(io, auctionId, seconds) {
  const auction = auctions[auctionId];
  if (!auction) return null;
  auction.timeRemainingSeconds = Math.max(0, Number(seconds));
  io.to(auctionId).emit('auction:time_tick', {
    auctionId,
    timeRemaining: auction.timeRemainingSeconds
  });
  return auction;
}

/**
 * Initializes timers for all active auctions on server start
 * @param {import('socket.io').Server} io
 */
function initAuctionTimers(io) {
  Object.values(auctions).forEach(auction => {
    if (auction.status === 'active') {
      startAuctionTimer(io, auction);
    }
  });
}

module.exports = {
  auctions,
  handleBidPlacement,
  handleRoomJoin,
  updateRoomViewers,
  resetAuction,
  setAuctionTime,
  initAuctionTimers
};
