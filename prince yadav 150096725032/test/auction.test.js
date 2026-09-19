/**
 * Automated Verification for Assignment 15: Section 7
 * 
 * Flow:
 * 1. Open three client sockets simulating browser tabs:
 *    - Bidder A (Vikram)
 *    - Bidder B (Ananya)
 *    - Viewer C
 * 2. Place a bid from Vikram: verify all 3 screens update the current highest bid to ₹52,000.
 * 3. Place a higher bid from Ananya: verify Vikram instantly receives an "Outbid Alert" banner.
 * 4. Wait until the timer drops to 10 seconds, then place a bid: verify the clock jumps back to 20 seconds (Anti-Snipe Protection).
 * 5. Let the clock tick down to 0: verify the room emits auction:sold and further bids are rejected.
 */

const { io: Client } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5001';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSection7Tests() {
  console.log('================================================================');
  console.log('🧪 7. Testing & Verification — Real-Time Live Auction Protocol');
  console.log(`📡 Connecting to Server at: ${SERVER_URL}`);
  console.log('================================================================\n');

  let bidderA, bidderB, viewerC;
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, description) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failedCount++;
      process.exitCode = 1;
    }
  }

  try {
    // ---------------- STEP 1: Connect 3 Browser Sessions ---------------- //
    console.log('📋 STEP 1: Open 3 browser tabs: Bidder A (Vikram), Bidder B (Ananya), Viewer C');
    bidderA = Client(SERVER_URL);
    bidderB = Client(SERVER_URL);
    viewerC = Client(SERVER_URL);

    await Promise.all([
      new Promise(res => bidderA.on('connect', res)),
      new Promise(res => bidderB.on('connect', res)),
      new Promise(res => viewerC.on('connect', res))
    ]);
    assert(bidderA.connected, 'Bidder A (Vikram) connected to live floor');
    assert(bidderB.connected, 'Bidder B (Ananya) connected to live floor');
    assert(viewerC.connected, 'Viewer C connected to live floor');

    // Reset auction room to clean state
    bidderA.emit('auction:reset', { auctionId: 'AUC_VINTAGE_99', seconds: 60 });
    await delay(300);

    // Join room AUC_VINTAGE_99
    const initPromises = [
      new Promise(res => bidderA.once('auction:init', res)),
      new Promise(res => bidderB.once('auction:init', res)),
      new Promise(res => viewerC.once('auction:init', res))
    ];

    bidderA.emit('auction:join', { auctionId: 'AUC_VINTAGE_99', username: 'Vikram' });
    bidderB.emit('auction:join', { auctionId: 'AUC_VINTAGE_99', username: 'Ananya' });
    viewerC.emit('auction:join', { auctionId: 'AUC_VINTAGE_99', username: 'Viewer C' });

    const [initA, initB, initC] = await Promise.all(initPromises);
    assert(initA.item.id === 'AUC_VINTAGE_99', 'Room initialized for Vikram with 1967 Stratocaster');
    assert(initA.currentBid === 50000, 'Starting opening price is ₹50,000');
    assert(initA.item.minIncrement === 2000, 'Minimum increment is ₹2,000');

    // ---------------- STEP 2: Place Bid from Vikram ---------------- //
    console.log('\n📋 STEP 2: Place bid from Vikram -> verify all 3 screens update to ₹52,000');
    const updatePromises = [
      new Promise(res => bidderA.once('bid:success', res)),
      new Promise(res => bidderB.once('bid:success', res)),
      new Promise(res => viewerC.once('bid:success', res))
    ];

    bidderA.emit('bid:place', {
      auctionId: 'AUC_VINTAGE_99',
      amount: 52000,
      username: 'Vikram'
    });

    const [resA, resB, resC] = await Promise.all(updatePromises);
    assert(resA.newBid === 52000 && resA.highestBidder === 'Vikram', 'Bidder A screen updated: ₹52,000 by Vikram');
    assert(resB.newBid === 52000 && resB.highestBidder === 'Vikram', 'Bidder B screen updated: ₹52,000 by Vikram');
    assert(resC.newBid === 52000 && resC.highestBidder === 'Vikram', 'Viewer C screen updated: ₹52,000 by Vikram');

    // ---------------- STEP 3: Higher Bid from Ananya -> Vikram Outbid Alert ---------------- //
    console.log('\n📋 STEP 3: Higher bid from Ananya (₹54,000) -> verify Vikram instantly receives Outbid Alert');
    let vikramOutbidAlert = null;
    let viewerCGotOutbid = false;

    bidderA.once('bid:outbid', (data) => {
      vikramOutbidAlert = data;
    });

    viewerC.once('bid:outbid', () => {
      viewerCGotOutbid = true;
    });

    const ananyaSuccessPromise = new Promise(res => bidderB.once('bid:success', res));

    bidderB.emit('bid:place', {
      auctionId: 'AUC_VINTAGE_99',
      amount: 54000,
      username: 'Ananya'
    });

    await ananyaSuccessPromise;
    await delay(300);

    assert(Boolean(vikramOutbidAlert), 'Vikram instantly received private "bid:outbid" alert');
    assert(vikramOutbidAlert.newBid === 54000, 'Outbid alert displays new leading price ₹54,000');
    assert(vikramOutbidAlert.message.includes('outbid by Ananya'), 'Outbid alert specifies outbid by Ananya');
    assert(!viewerCGotOutbid, 'Viewer C did NOT receive private outbid alert (strictly targeted)');

    // ---------------- STEP 4: Timer Drops to 10s, Place Bid -> Anti-Snipe Jump to 20s ---------------- //
    console.log('\n📋 STEP 4: Timer drops to 10s -> place bid -> verify clock jumps back to 20s (Anti-Snipe Protection)');
    // Jump clock to 10 seconds to simulate final seconds
    bidderA.emit('auction:set_timer', { auctionId: 'AUC_VINTAGE_99', seconds: 10 });
    await delay(200);

    const antiSnipePromise = new Promise(res => bidderA.once('auction:extended', res));
    const clockUpdatePromise = new Promise(res => {
      bidderB.once('bid:success', (data) => res(data));
    });

    // Vikram counter-bids with ₹56,000 with 10s remaining
    bidderA.emit('bid:place', {
      auctionId: 'AUC_VINTAGE_99',
      amount: 56000,
      username: 'Vikram'
    });

    const [extendedData, successData] = await Promise.all([antiSnipePromise, clockUpdatePromise]);
    assert(Boolean(extendedData), 'auction:extended event received across all floor participants');
    assert(extendedData.timeRemaining === 20, 'Anti-snipe protection successfully extended clock back to 20 seconds');
    assert(successData.timeRemaining === 20, 'New bid broadcast reflects reset timeRemaining: 20s');

    // ---------------- STEP 5: Clock Ticks Down to 0 -> auction:sold & Further Bids Rejected ---------------- //
    console.log('\n📋 STEP 5: Clock ticks down to 0 -> verify room emits auction:sold and further bids rejected');
    // Set clock to 1s to allow natural countdown expiration to 0s
    const soldPromise = new Promise(res => viewerC.once('auction:sold', res));
    bidderA.emit('auction:set_timer', { auctionId: 'AUC_VINTAGE_99', seconds: 1 });

    const soldData = await soldPromise;
    assert(soldData.status === 'sold', 'Room emitted "auction:sold" event');
    assert(soldData.winner === 'Vikram', 'Winning bidder confirmed as Vikram');
    assert(soldData.finalPrice === 56000, 'Final hammer price confirmed as ₹56,000');

    // Now test that further bids after clock=0 are rejected
    const rejectedPromise = new Promise(res => bidderB.once('bid:rejected', res));
    bidderB.emit('bid:place', {
      auctionId: 'AUC_VINTAGE_99',
      amount: 60000,
      username: 'Ananya'
    });

    const rejectData = await rejectedPromise;
    assert(rejectData.code === 'AUCTION_CLOSED' || rejectData.reason.includes('closed'), 'Post-auction bid strictly rejected: "Auction is closed"');

    // ---------------- SUMMARY ---------------- //
    console.log('\n================================================================');
    console.log(`🏁 SECTION 7 VERIFICATION RESULTS: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Error during verification:', err);
    process.exitCode = 1;
  } finally {
    if (bidderA) bidderA.disconnect();
    if (bidderB) bidderB.disconnect();
    if (viewerC) viewerC.disconnect();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runSection7Tests();
