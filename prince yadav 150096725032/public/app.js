/**
 * AUCTIO//PULSE — Real-Time Live Auction & Bidding Engine Client
 * Socket.io handlers, Web Audio synthesizers, countdown dial, and audit feed
 */

// ---------------- STATE ---------------- //
const state = {
  currentAuctionId: 'AUC_VINTAGE_99',
  currentUser: {
    username: 'Vikram',
    balance: 500000
  },
  auction: null,
  timeRemaining: 60,
  maxDuration: 60,
  selectedIncrementMultiplier: 1, // 1 = +min, 2 = +2x, 5 = +5x, 'custom'
  selectedBidAmount: 52000,
  feedFilter: 'all',
  soundEnabled: true,
  botSimActive: false,
  botSimTimer: null,
  allAuctions: []
};

// ---------------- WEB AUDIO SYNTHESIZERS ---------------- //
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

const soundFX = {
  bidSuccess() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Melodic arpeggio (C5 -> E5 -> G5)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch (e) {
      console.warn('Audio error:', e);
    }
  },

  outbidAlert() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Urgent dissonance alarm (F4 + B4 tritone)
      [349.23, 493.88].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch (e) {}
  },

  antiSnipeSiren() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.25);
      osc.frequency.linearRampToValueAtTime(500, now + 0.45);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  },

  timerTick() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  },

  victoryGavel() {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Heavy wooden gavel impact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);

      // Fanfare chord after impact
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const chordOsc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        chordOsc.type = 'sine';
        chordOsc.frequency.setValueAtTime(freq, now + 0.15 + idx * 0.05);

        chordGain.gain.setValueAtTime(0.2, now + 0.15 + idx * 0.05);
        chordGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        chordOsc.connect(chordGain);
        chordGain.connect(ctx.destination);

        chordOsc.start(now + 0.15 + idx * 0.05);
        chordOsc.stop(now + 1.2);
      });
    } catch (e) {}
  }
};

// ---------------- DOM ELEMENTS ---------------- //
const dom = {
  // Navigation & Header
  roomNav: document.getElementById('roomNav'),
  walletAmount: document.getElementById('walletAmount'),
  btnAddFunds: document.getElementById('btnAddFunds'),
  walletChip: document.getElementById('walletChip'),
  userAvatar: document.getElementById('userAvatar'),
  userHandle: document.getElementById('userHandle'),
  btnChangeUser: document.getElementById('btnChangeUser'),
  btnSoundToggle: document.getElementById('btnSoundToggle'),
  soundIcon: document.getElementById('soundIcon'),
  networkPing: document.getElementById('networkPing'),
  tickerContent: document.getElementById('tickerContent'),

  // Lot Info
  lotIdBadge: document.getElementById('lotIdBadge'),
  lotCategoryBadge: document.getElementById('lotCategoryBadge'),
  lotStatusBadge: document.getElementById('lotStatusBadge'),
  viewersCount: document.getElementById('viewersCount'),
  lotHeroGraphic: document.getElementById('lotHeroGraphic'),
  antiSnipeBanner: document.getElementById('antiSnipeBanner'),
  lotTitle: document.getElementById('lotTitle'),
  lotDescription: document.getElementById('lotDescription'),
  specStartingPrice: document.getElementById('specStartingPrice'),
  specMinIncrement: document.getElementById('specMinIncrement'),

  // HUD & Price
  timerDialCard: document.getElementById('timerDialCard'),
  timerProgress: document.getElementById('timerProgress'),
  timerTime: document.getElementById('timerTime'),
  timerCaption: document.getElementById('timerCaption'),
  priceBoard: document.getElementById('priceBoard'),
  yourStatusPill: document.getElementById('yourStatusPill'),
  currentPrice: document.getElementById('currentPrice'),
  highestBidderName: document.getElementById('highestBidderName'),

  // Bidding Deck
  biddingDeck: document.getElementById('biddingDeck'),
  deckMinHint: document.getElementById('deckMinHint'),
  btnIncMin: document.getElementById('btnIncMin'),
  incMinVal: document.getElementById('incMinVal'),
  btnInc2x: document.getElementById('btnInc2x'),
  inc2xVal: document.getElementById('inc2xVal'),
  btnInc5x: document.getElementById('btnInc5x'),
  inc5xVal: document.getElementById('inc5xVal'),
  customBidInput: document.getElementById('customBidInput'),
  btnPlaceBid: document.getElementById('btnPlaceBid'),
  btnBidAmount: document.getElementById('btnBidAmount'),
  bidFeedbackBox: document.getElementById('bidFeedbackBox'),
  bidFeedbackText: document.getElementById('bidFeedbackText'),

  // Admin & Bot Controls
  btnResetAuction: document.getElementById('btnResetAuction'),
  btnAntiSnipeTest: document.getElementById('btnAntiSnipeTest'),
  botSimToggle: document.getElementById('botSimToggle'),
  btnSimSingleBid: document.getElementById('btnSimSingleBid'),

  // Audit Feed
  feedStream: document.getElementById('feedStream'),
  feedEmptyState: document.getElementById('feedEmptyState'),
  bidCountBadge: document.getElementById('bidCountBadge'),
  filterTabs: document.querySelectorAll('.filter-tab'),

  // Modals & Toasts
  outbidToast: document.getElementById('outbidToast'),
  toastMessage: document.getElementById('toastMessage'),
  btnCounterBid: document.getElementById('btnCounterBid'),
  btnCloseToast: document.getElementById('btnCloseToast'),

  victoryModal: document.getElementById('victoryModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalWinnerName: document.getElementById('modalWinnerName'),
  modalFinalPrice: document.getElementById('modalFinalPrice'),
  modalItemTitle: document.getElementById('modalItemTitle'),
  btnModalReset: document.getElementById('btnModalReset'),
  btnModalClose: document.getElementById('btnModalClose'),

  userModal: document.getElementById('userModal'),
  inputUsername: document.getElementById('inputUsername'),
  btnSaveUsername: document.getElementById('btnSaveUsername'),
  btnCloseUserModal: document.getElementById('btnCloseUserModal')
};

// ---------------- INITIALIZATION & SOCKET.IO SETUP ---------------- //
const socket = io();

// Monitor network ping latency
setInterval(() => {
  const start = Date.now();
  socket.volatile.emit('ping_test', () => {
    const latency = Date.now() - start;
    if (dom.networkPing) dom.networkPing.textContent = `${latency}ms`;
  });
}, 5000);

socket.on('connect', () => {
  console.log('⚡ Connected to auction server with ID:', socket.id);
  joinRoom(state.currentAuctionId);
  fetchAuctionRooms();
});

// ---------------- SOCKET EVENT LISTENERS ---------------- //

// 1. Initial hydration when joining an auction
socket.on('auction:init', (data) => {
  console.log('📦 Auction Initialized:', data);
  state.auction = data.item;
  state.timeRemaining = data.timeRemaining;
  state.maxDuration = data.item.initialDuration || 60;

  renderLotDetails(data.item);
  renderPriceAndBidder(data.currentBid, data.highestBidder);
  renderTimer(data.timeRemaining);
  renderBidHistory(data.bidHistory || []);
  updateBiddingDeckValues();

  if (dom.viewersCount && data.totalViewers) {
    dom.viewersCount.textContent = data.totalViewers;
  }

  appendSystemNotice(`Joined live floor for lot #${data.item.id}`);
});

// 2. 1-Second Time Tick Broadcast
socket.on('auction:time_tick', (data) => {
  if (data.auctionId !== state.currentAuctionId) return;
  state.timeRemaining = data.timeRemaining;
  renderTimer(data.timeRemaining);

  // Play urgent tick sound when <= 10 seconds
  if (data.timeRemaining <= 10 && data.timeRemaining > 0) {
    soundFX.timerTick();
  }
});

// 3. New Winning Bid Broadcast
socket.on('bid:success', (data) => {
  if (data.auctionId !== state.currentAuctionId) return;

  renderPriceAndBidder(data.newBid, data.highestBidder);
  renderTimer(data.timeRemaining);

  // Flash price marquee
  dom.currentPrice.classList.remove('flash');
  void dom.currentPrice.offsetWidth; // trigger reflow
  dom.currentPrice.classList.add('flash');

  // Add bid item to audit feed
  if (data.latestBidEntry) {
    addBidToFeed(data.latestBidEntry);
  } else if (data.bidHistory && data.bidHistory[0]) {
    addBidToFeed(data.bidHistory[0]);
  }

  // Update quick increment buttons
  updateBiddingDeckValues();

  // Ticker marquee update
  addTickerItem(`💰 New bid: ₹${data.newBid.toLocaleString('en-IN')} by ${data.highestBidder}`);

  // Sound feedback
  soundFX.bidSuccess();

  // If this was our bid, show success feedback
  if (data.highestBidder === state.currentUser.username) {
    showBidFeedback('Your bid is currently leading the floor!', 'success');
  }
});

// 4. Targeted Private Outbid Notification
socket.on('bid:outbid', (data) => {
  console.log('🚨 YOU HAVE BEEN OUTBID:', data);
  soundFX.outbidAlert();

  // Show outbid toast
  dom.toastMessage.textContent = data.message;
  dom.outbidToast.classList.add('show');

  // Update status pill to OUTBID
  updateYourStatusPill('outbid');

  // Add system notice to feed
  appendSystemNotice(`⚠️ You were outbid by ${data.outbidBy}!`, true);
  addTickerItem(`⚠️ ${state.currentUser.username} was outbid on #${data.auctionId}`);
});

// 5. Bid Rejected Feedback
socket.on('bid:rejected', (data) => {
  console.warn('❌ Bid Rejected:', data);
  showBidFeedback(data.reason || 'Invalid bid attempt', 'error');
  soundFX.outbidAlert();
});

// 6. Anti-Snipe Extension Broadcast
socket.on('auction:extended', (data) => {
  if (data.auctionId !== state.currentAuctionId) return;
  state.timeRemaining = data.timeRemaining;
  renderTimer(data.timeRemaining);

  soundFX.antiSnipeSiren();

  // Highlight anti-snipe banner
  dom.antiSnipeBanner.classList.add('pulse');
  setTimeout(() => dom.antiSnipeBanner.classList.remove('pulse'), 2500);

  appendSystemNotice(`🛡️ ${data.message}`);
  addTickerItem(`🛡️ Anti-snipe triggered on #${data.auctionId}: +20s added!`);
});

// 7. Auction Sold Broadcast
socket.on('auction:sold', (data) => {
  if (data.auctionId !== state.currentAuctionId) return;

  soundFX.victoryGavel();
  setAuctionEndedUI('sold', data.winner, data.finalPrice);

  // Show victory modal
  dom.modalTitle.textContent = 'LOT OFFICIALLY SOLD!';
  dom.modalSubtitle.textContent = `The auction hammer has fallen. Sold to highest bidder.`;
  dom.modalWinnerName.textContent = data.winner;
  dom.modalFinalPrice.textContent = `₹${data.finalPrice.toLocaleString('en-IN')}`;
  dom.modalItemTitle.textContent = state.auction?.title || state.currentAuctionId;
  dom.victoryModal.classList.add('show');

  appendSystemNotice(`🏆 SOLD: ${data.winner} won for ₹${data.finalPrice.toLocaleString('en-IN')}!`);
  addTickerItem(`🏆 LOT SOLD: ${data.winner} won #${data.auctionId} at ₹${data.finalPrice.toLocaleString('en-IN')}`);
});

// 8. Auction Ended Unsold
socket.on('auction:ended', (data) => {
  if (data.auctionId !== state.currentAuctionId) return;

  setAuctionEndedUI('ended', null, data.finalPrice);
  appendSystemNotice(`⛔ Lot closed without reaching winning bids.`);
  addTickerItem(`⛔ #${data.auctionId} closed with no winning bids.`);
});

// 9. Audience / Viewers Count Updates
socket.on('user:joined', (data) => {
  if (dom.viewersCount && data.totalViewers) {
    dom.viewersCount.textContent = data.totalViewers;
  }
  appendSystemNotice(`👋 ${data.username} joined the bidding floor.`);
});

socket.on('user:left', (data) => {
  if (dom.viewersCount && data.totalViewers) {
    dom.viewersCount.textContent = data.totalViewers;
  }
});

socket.on('viewers:updated', (data) => {
  if (data.auctionId === state.currentAuctionId && dom.viewersCount) {
    dom.viewersCount.textContent = data.totalViewers;
  }
});

// 10. Auction Reset
socket.on('auction:reset', (data) => {
  if (data.auctionId !== state.currentAuctionId) return;
  state.auction = data.item;
  state.timeRemaining = data.timeRemaining;

  renderLotDetails(data.item);
  renderPriceAndBidder(data.item.startingPrice, null);
  renderTimer(data.timeRemaining);
  renderBidHistory([]);
  updateBiddingDeckValues();

  // Reset UI status badges
  dom.lotStatusBadge.className = 'badge live-badge';
  dom.lotStatusBadge.innerHTML = `<span class="pulse-indicator"></span> LIVE AUCTION`;
  dom.btnPlaceBid.disabled = false;
  dom.victoryModal.classList.remove('show');
  dom.outbidToast.classList.remove('show');

  appendSystemNotice(`🔄 Auction has been reset.`);
});

// ---------------- CORE ACTIONS & LOGIC ---------------- //

function joinRoom(auctionId) {
  state.currentAuctionId = auctionId;
  socket.emit('auction:join', {
    auctionId,
    username: state.currentUser.username
  });
  updateActiveRoomTabUI();
}

function placeBid(customAmount = null) {
  // Resume Web Audio context on user gesture
  getAudioContext();

  const amount = customAmount || state.selectedBidAmount;
  if (!amount || isNaN(amount)) {
    return showBidFeedback('Please enter a valid bid amount', 'error');
  }

  // Prevent self-outbid locally for instant feedback
  if (state.auction && state.auction.highestBidder && state.auction.highestBidder.username === state.currentUser.username) {
    return showBidFeedback('You are already holding the highest bid!', 'error');
  }

  // Balance check
  if (state.currentUser.balance < amount) {
    return showBidFeedback(`Insufficient simulated balance (₹${state.currentUser.balance.toLocaleString('en-IN')})`, 'error');
  }

  // Emit to authoritative server
  socket.emit('bid:place', {
    auctionId: state.currentAuctionId,
    amount: Number(amount),
    username: state.currentUser.username,
    balance: state.currentUser.balance
  });

  // Close outbid toast if open
  dom.outbidToast.classList.remove('show');
}

function updateBiddingDeckValues() {
  if (!state.auction) return;

  const current = state.auction.currentBid || state.auction.startingPrice || 50000;
  const inc = state.auction.minIncrement || 2000;

  const minBid = current + inc;
  const inc2xBid = current + inc * 2;
  const inc5xBid = current + inc * 5;

  dom.deckMinHint.textContent = `Minimum valid bid: ₹${minBid.toLocaleString('en-IN')}`;
  dom.incMinVal.textContent = `₹${minBid.toLocaleString('en-IN')}`;
  dom.inc2xVal.textContent = `₹${inc2xBid.toLocaleString('en-IN')}`;
  dom.inc5xVal.textContent = `₹${inc5xBid.toLocaleString('en-IN')}`;

  // Update selected bid based on active multiplier
  if (state.selectedIncrementMultiplier === 1) {
    state.selectedBidAmount = minBid;
  } else if (state.selectedIncrementMultiplier === 2) {
    state.selectedBidAmount = inc2xBid;
  } else if (state.selectedIncrementMultiplier === 5) {
    state.selectedBidAmount = inc5xBid;
  } else if (state.selectedIncrementMultiplier === 'custom') {
    const val = Number(dom.customBidInput.value);
    state.selectedBidAmount = val > 0 ? val : minBid;
  }

  dom.btnBidAmount.textContent = `₹${state.selectedBidAmount.toLocaleString('en-IN')}`;
}

// ---------------- UI RENDERING HELPERS ---------------- //

function renderLotDetails(item) {
  dom.lotIdBadge.textContent = item.id;
  dom.lotCategoryBadge.textContent = item.category || 'Featured Lot';
  dom.lotHeroGraphic.textContent = item.image || '🏷️';
  dom.lotTitle.textContent = item.title;
  dom.lotDescription.textContent = item.description;
  dom.specStartingPrice.textContent = `₹${item.startingPrice.toLocaleString('en-IN')}`;
  dom.specMinIncrement.textContent = `+₹${item.minIncrement.toLocaleString('en-IN')}`;
}

function renderPriceAndBidder(price, highestBidder) {
  if (!state.auction) return;
  state.auction.currentBid = price;
  state.auction.highestBidder = highestBidder ? { username: highestBidder } : null;

  dom.currentPrice.textContent = Number(price).toLocaleString('en-IN');

  if (highestBidder) {
    dom.highestBidderName.textContent = highestBidder;
  } else {
    dom.highestBidderName.textContent = 'None yet (Opening Price)';
  }

  // Update status pill
  if (highestBidder === state.currentUser.username) {
    updateYourStatusPill('winning');
  } else if (highestBidder) {
    updateYourStatusPill('outbid');
  } else {
    updateYourStatusPill('spectating');
  }
}

function updateYourStatusPill(status) {
  dom.yourStatusPill.className = 'your-status-pill';
  if (status === 'winning') {
    dom.yourStatusPill.classList.add('winning');
    dom.yourStatusPill.innerHTML = `<span>👑 YOU ARE WINNING</span>`;
  } else if (status === 'outbid') {
    dom.yourStatusPill.classList.add('outbid');
    dom.yourStatusPill.innerHTML = `<span>⚠️ OUTBID</span>`;
  } else {
    dom.yourStatusPill.innerHTML = `<span>SPECTATING</span>`;
  }
}

function renderTimer(seconds) {
  const s = Math.max(0, seconds);
  const mins = Math.floor(s / 60);
  const remSecs = s % 60;
  dom.timerTime.textContent = `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;

  // SVG Circular dial calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.292
  const maxDur = state.maxDuration || 60;
  const percent = Math.min(1, Math.max(0, s / maxDur));
  const offset = circumference - percent * circumference;
  dom.timerProgress.style.strokeDashoffset = offset;

  // Danger state (< 15 seconds) - Anti-snipe zone
  if (s > 0 && s < 15) {
    dom.timerDialCard.classList.add('danger');
    dom.timerCaption.textContent = '⚠️ ANTI-SNIPE ZONE (<15s)';
    dom.lotStatusBadge.className = 'badge live-badge urgent';
    dom.lotStatusBadge.innerHTML = `<span class="pulse-indicator"></span> FINAL SECONDS`;
  } else if (s <= 0) {
    dom.timerDialCard.classList.remove('danger');
    dom.timerCaption.textContent = 'AUCTION CLOSED';
  } else {
    dom.timerDialCard.classList.remove('danger');
    dom.timerCaption.textContent = 'Official Server Clock';
    dom.lotStatusBadge.className = 'badge live-badge';
    dom.lotStatusBadge.innerHTML = `<span class="pulse-indicator"></span> LIVE AUCTION`;
  }
}

function renderBidHistory(history) {
  dom.feedStream.innerHTML = '';
  if (!history || history.length === 0) {
    dom.feedEmptyState.style.display = 'block';
    dom.feedStream.appendChild(dom.feedEmptyState);
    dom.bidCountBadge.textContent = '0 Bids';
    return;
  }

  dom.feedEmptyState.style.display = 'none';
  dom.bidCountBadge.textContent = `${history.length} Bid${history.length === 1 ? '' : 's'}`;

  history.forEach(entry => {
    addBidToFeed(entry, false);
  });
}

function addBidToFeed(entry, prepend = true) {
  dom.feedEmptyState.style.display = 'none';

  const isMe = entry.bidder === state.currentUser.username;
  const item = document.createElement('div');
  item.className = `bid-item ${isMe ? 'is-me' : ''}`;
  item.dataset.bidder = entry.bidder;
  item.dataset.type = 'bid';

  const deltaText = entry.increment ? `+₹${Number(entry.increment).toLocaleString('en-IN')}` : '+Min';

  item.innerHTML = `
    <div class="bid-item-top">
      <div class="bidder-name-group">
        <span class="bidder-tag">${escapeHTML(entry.bidder)}</span>
        ${isMe ? '<span class="you-badge">YOU</span>' : ''}
      </div>
      <span class="bid-item-amount">₹${Number(entry.amount).toLocaleString('en-IN')}</span>
    </div>
    <div class="bid-item-bottom">
      <span class="bid-delta">${deltaText}</span>
      <span class="bid-time">${entry.timestamp || 'Just now'}</span>
    </div>
  `;

  if (prepend && dom.feedStream.firstChild) {
    dom.feedStream.insertBefore(item, dom.feedStream.firstChild);
  } else {
    dom.feedStream.appendChild(item);
  }

  // Update bids counter
  const totalBids = dom.feedStream.querySelectorAll('.bid-item').length;
  dom.bidCountBadge.textContent = `${totalBids} Bid${totalBids === 1 ? '' : 's'}`;

  applyFeedFilter();
}

function appendSystemNotice(text, isAlert = false) {
  const notice = document.createElement('div');
  notice.className = `feed-notice ${isAlert ? 'text-crimson' : ''}`;
  notice.dataset.type = 'system';
  notice.innerHTML = `<span>${text}</span>`;

  if (dom.feedStream.firstChild) {
    dom.feedStream.insertBefore(notice, dom.feedStream.firstChild);
  } else {
    dom.feedStream.appendChild(notice);
  }
}

function addTickerItem(text) {
  const item = document.createElement('span');
  item.className = 'ticker-item';
  item.textContent = text;
  dom.tickerContent.appendChild(item);
}

function showBidFeedback(msg, type = 'error') {
  dom.bidFeedbackText.textContent = msg;
  dom.bidFeedbackBox.className = `bid-feedback-box ${type}`;
  setTimeout(() => {
    dom.bidFeedbackBox.className = 'bid-feedback-box';
  }, 4500);
}

function setAuctionEndedUI(status, winner, price) {
  dom.btnPlaceBid.disabled = true;
  dom.lotStatusBadge.className = 'badge live-badge ended';
  dom.lotStatusBadge.innerHTML = status === 'sold' ? `🏆 SOLD` : `⛔ ENDED`;

  if (status === 'sold') {
    dom.highestBidderName.textContent = `Won by ${winner} (₹${Number(price).toLocaleString('en-IN')})`;
    if (winner === state.currentUser.username) {
      updateYourStatusPill('winning');
    }
  }
}

// ---------------- ROOM SWITCHER & REST API ---------------- //

async function fetchAuctionRooms() {
  try {
    const res = await fetch('/api/auctions');
    const data = await res.json();
    if (data.success && data.auctions) {
      state.allAuctions = data.auctions;
      renderRoomTabs(data.auctions);
    }
  } catch (err) {
    console.error('Failed to load auction rooms:', err);
  }
}

function renderRoomTabs(auctions) {
  dom.roomNav.innerHTML = '';
  auctions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = `room-tab ${a.id === state.currentAuctionId ? 'active' : ''}`;
    btn.dataset.id = a.id;
    btn.innerHTML = `
      <span>${a.image || '🏷️'}</span>
      <span>${escapeHTML(a.title.split(' ')[0] + ' ' + (a.title.split(' ')[1] || ''))}</span>
      <span class="room-tab-badge">₹${(a.currentBid / 1000).toFixed(0)}k</span>
    `;
    btn.addEventListener('click', () => {
      if (a.id !== state.currentAuctionId) {
        joinRoom(a.id);
      }
    });
    dom.roomNav.appendChild(btn);
  });
}

function updateActiveRoomTabUI() {
  document.querySelectorAll('.room-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.id === state.currentAuctionId);
  });
}

// ---------------- AUDIT FEED FILTERING ---------------- //

function applyFeedFilter() {
  const items = dom.feedStream.children;
  for (let el of items) {
    if (state.feedFilter === 'all') {
      el.style.display = 'flex';
    } else if (state.feedFilter === 'my') {
      if (el.dataset.type === 'bid' && el.dataset.bidder === state.currentUser.username) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    } else if (state.feedFilter === 'system') {
      if (el.dataset.type === 'system') {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    }
  }
}

// ---------------- EVENT LISTENERS ---------------- //

// Quick Increment Buttons
dom.btnIncMin.addEventListener('click', () => {
  setActiveIncrementButton(dom.btnIncMin, 1);
});
dom.btnInc2x.addEventListener('click', () => {
  setActiveIncrementButton(dom.btnInc2x, 2);
});
dom.btnInc5x.addEventListener('click', () => {
  setActiveIncrementButton(dom.btnInc5x, 5);
});

function setActiveIncrementButton(btn, multiplier) {
  document.querySelectorAll('.btn-increment').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.selectedIncrementMultiplier = multiplier;
  dom.customBidInput.value = '';
  updateBiddingDeckValues();
}

dom.customBidInput.addEventListener('input', (e) => {
  document.querySelectorAll('.btn-increment').forEach(b => b.classList.remove('active'));
  state.selectedIncrementMultiplier = 'custom';
  const val = Number(e.target.value);
  if (val > 0) {
    state.selectedBidAmount = val;
    dom.btnBidAmount.textContent = `₹${val.toLocaleString('en-IN')}`;
  } else {
    updateBiddingDeckValues();
  }
});

// Primary Place Bid Button
dom.btnPlaceBid.addEventListener('click', () => {
  placeBid();
});

// Outbid Toast Counter-Bid Button
dom.btnCounterBid.addEventListener('click', () => {
  if (state.auction) {
    const minCounter = state.auction.currentBid + state.auction.minIncrement;
    placeBid(minCounter);
  }
});

dom.btnCloseToast.addEventListener('click', () => {
  dom.outbidToast.classList.remove('show');
});

// Wallet Add Funds
dom.btnAddFunds.addEventListener('click', (e) => {
  e.stopPropagation();
  state.currentUser.balance += 100000;
  dom.walletAmount.textContent = `₹${state.currentUser.balance.toLocaleString('en-IN')}`;
  showBidFeedback('+₹100,000 credited to simulated wallet', 'success');
  soundFX.bidSuccess();
});

// Sound Toggle
dom.btnSoundToggle.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  dom.btnSoundToggle.classList.toggle('active', state.soundEnabled);
  dom.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
  if (state.soundEnabled) soundFX.bidSuccess();
});

// User Identity Modal
dom.btnChangeUser.addEventListener('click', () => {
  dom.inputUsername.value = state.currentUser.username;
  dom.userModal.classList.add('show');
});

dom.btnCloseUserModal.addEventListener('click', () => {
  dom.userModal.classList.remove('show');
});

dom.btnSaveUsername.addEventListener('click', () => {
  const newName = dom.inputUsername.value.trim();
  if (newName) {
    state.currentUser.username = newName;
    dom.userHandle.textContent = newName;
    dom.userAvatar.textContent = newName.charAt(0).toUpperCase();
    dom.userModal.classList.remove('show');
    joinRoom(state.currentAuctionId);
  }
});

// Admin Reset Auction
dom.btnResetAuction.addEventListener('click', () => {
  socket.emit('auction:reset', {
    auctionId: state.currentAuctionId,
    seconds: 60
  });
});

// Admin Jump to 10s (Anti-Snipe Test)
dom.btnAntiSnipeTest.addEventListener('click', () => {
  socket.emit('auction:set_timer', {
    auctionId: state.currentAuctionId,
    seconds: 10
  });
  showBidFeedback('Timer jumped to 10s. Place a bid to observe Anti-Snipe +20s extension!', 'success');
});

// Feed Filter Tabs
dom.filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.feedFilter = tab.dataset.filter;
    applyFeedFilter();
  });
});

// Victory Modal Buttons
dom.btnModalReset.addEventListener('click', () => {
  socket.emit('auction:reset', { auctionId: state.currentAuctionId, seconds: 60 });
  dom.victoryModal.classList.remove('show');
});

dom.btnModalClose.addEventListener('click', () => {
  dom.victoryModal.classList.remove('show');
});

// ---------------- COMPETITOR BOT SIMULATOR ---------------- //
const botNames = ['Elena', 'Marcus', 'Aria', 'Siddharth', 'Zack'];

function triggerSingleCompetitorBid() {
  if (!state.auction || state.timeRemaining <= 0) return;

  const botName = botNames[Math.floor(Math.random() * botNames.length)];
  // If bot is already highest bidder, pick another
  if (state.auction.highestBidder && state.auction.highestBidder.username === botName) {
    return;
  }

  const inc = state.auction.minIncrement || 2000;
  const current = state.auction.currentBid || state.auction.startingPrice || 50000;
  const botBid = current + inc * (Math.random() > 0.6 ? 2 : 1);

  socket.emit('bid:place', {
    auctionId: state.currentAuctionId,
    amount: botBid,
    username: botName,
    balance: 10000000
  });
}

dom.btnSimSingleBid.addEventListener('click', () => {
  triggerSingleCompetitorBid();
});

dom.botSimToggle.addEventListener('change', (e) => {
  state.botSimActive = e.target.checked;
  if (state.botSimActive) {
    showBidFeedback('Multi-bidder simulator ACTIVE. Competitors will bid dynamically!', 'success');
    state.botSimTimer = setInterval(() => {
      if (Math.random() > 0.3) {
        triggerSingleCompetitorBid();
      }
    }, 4000);
  } else {
    clearInterval(state.botSimTimer);
    state.botSimTimer = null;
    showBidFeedback('Multi-bidder simulator STOPPED', 'success');
  }
});

// ---------------- UTILS ---------------- //
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// Initial balance setup
dom.walletAmount.textContent = `₹${state.currentUser.balance.toLocaleString('en-IN')}`;
dom.userHandle.textContent = state.currentUser.username;
dom.userAvatar.textContent = state.currentUser.username.charAt(0).toUpperCase();
