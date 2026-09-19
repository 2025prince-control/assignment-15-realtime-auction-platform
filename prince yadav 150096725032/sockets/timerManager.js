/**
 * Timer Manager
 * Authoritative server-side 1-second countdown clock for auction rooms
 */

const roomTimers = new Map();

/**
 * Starts or restarts a server-side countdown timer for an auction
 * @param {import('socket.io').Server} io
 * @param {object} auction
 */
function startAuctionTimer(io, auction) {
  if (!auction) return;
  const auctionId = auction.id;

  // Clear any existing timer interval for this room
  stopAuctionTimer(auctionId);

  // Set active status if not already set
  if (auction.status !== 'ended' && auction.status !== 'sold') {
    auction.status = 'active';
  }

  const intervalId = setInterval(() => {
    if (auction.timeRemainingSeconds > 0 && auction.status === 'active') {
      auction.timeRemainingSeconds -= 1;

      // Broadcast time tick to everyone in the room
      io.to(auctionId).emit('auction:time_tick', {
        auctionId: auction.id,
        timeRemaining: auction.timeRemainingSeconds
      });

      // When countdown reaches 0
      if (auction.timeRemainingSeconds <= 0) {
        stopAuctionTimer(auctionId);

        if (auction.highestBidder) {
          auction.status = 'sold';
          io.to(auctionId).emit('auction:sold', {
            auctionId: auction.id,
            winner: auction.highestBidder.username,
            finalPrice: auction.currentBid,
            status: 'sold',
            message: `Sold to ${auction.highestBidder.username} for ₹${auction.currentBid.toLocaleString('en-IN')}!`
          });
        } else {
          auction.status = 'ended';
          io.to(auctionId).emit('auction:ended', {
            auctionId: auction.id,
            winner: null,
            finalPrice: auction.currentBid,
            status: 'ended',
            message: 'Auction closed without bids.'
          });
        }
      }
    } else {
      stopAuctionTimer(auctionId);
    }
  }, 1000);

  roomTimers.set(auctionId, intervalId);
}

/**
 * Stops an active room timer
 * @param {string} auctionId
 */
function stopAuctionTimer(auctionId) {
  if (roomTimers.has(auctionId)) {
    clearInterval(roomTimers.get(auctionId));
    roomTimers.delete(auctionId);
  }
}

/**
 * Resets an auction timer back to a specific second count
 * @param {import('socket.io').Server} io
 * @param {object} auction
 * @param {number} seconds
 */
function resetAuctionTimer(io, auction, seconds = 60) {
  auction.timeRemainingSeconds = seconds;
  auction.status = 'active';
  startAuctionTimer(io, auction);
  io.to(auction.id).emit('auction:time_tick', {
    auctionId: auction.id,
    timeRemaining: auction.timeRemainingSeconds
  });
}

module.exports = {
  startAuctionTimer,
  stopAuctionTimer,
  resetAuctionTimer,
  roomTimers
};
