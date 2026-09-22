/**
 * Live Stage & Projector Visualizer Logic
 * - Dual Arena Support (Mode 1: Awards Ceremony vs Mode 2: Live Solo Performer)
 * - Alphabetically sorted nominees (Name & Image only)
 * - Winner reveal displays only winner name and votes
 * - QR code loaded from custom image only when uploaded
 */

(function(){
  let appState = null;
  let currentActiveCategory = null;
  let isAudioEnabled = true;

  // DOM Elements
  const stageEventName = document.getElementById('stageEventName');
  const stageConnectionBadge = document.getElementById('stageConnectionBadge');
  const stageVotesPill = document.getElementById('stageVotesPill');
  const btnToggleAudio = document.getElementById('btnToggleAudio');
  const audioIcon = document.getElementById('audioIcon');
  const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');

  const stageCategorySymbol = document.getElementById('stageCategorySymbol');
  const stageCategoryTitleText = document.getElementById('stageCategoryTitleText');
  const stageCategoryTitle = document.getElementById('stageCategoryTitle');
  const stageCategoryDesc = document.getElementById('stageCategoryDesc');
  const stageNomineesContainer = document.getElementById('stageNomineesContainer');
  const stageQrBox = document.getElementById('stageQrBox');
  const stageQrImg = document.getElementById('stageQrImg');

  function extractSymbol(badge) {
    if (!badge) return '👑';
    const match = badge.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic}|[\u2600-\u27BF])/u);
    if (match) return match[0];
    const trimmed = badge.trim();
    if (trimmed.length > 0) return trimmed.split(' ')[0];
    return '👑';
  }

  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNumber = document.getElementById('countdownNumber');
  const countdownTeaserText = document.getElementById('countdownTeaserText');

  const winnerRevealOverlay = document.getElementById('winnerRevealOverlay');
  const revealWinnerAvatar = document.getElementById('revealWinnerAvatar');
  const revealCategoryBadge = document.getElementById('revealCategoryBadge');
  const revealWinnerName = document.getElementById('revealWinnerName');
  const revealWinnerVotes = document.getElementById('revealWinnerVotes');
  const btnCloseReveal = document.getElementById('btnCloseReveal');

  // DOM Elements for Arenas
  const stageOnlineCount = document.getElementById('stageOnlineCount');
  const stageCategoryArena = document.getElementById('stageCategoryArena');
  const stagePerformerArena = document.getElementById('stagePerformerArena');
  const stagePerformerPhoto = document.getElementById('stagePerformerPhoto');
  const stagePerformerName = document.getElementById('stagePerformerName');
  const stagePerformerRatingTally = document.getElementById('stagePerformerRatingTally');
  const performerLineStatusBadge = document.getElementById('performerLineStatusBadge');
  const stageHeader = document.querySelector('.stage-header');
  const stageLatentArena = document.getElementById('stageLatentArena');
  const stageCustomImageBox = document.getElementById('stageCustomImageBox');
  const stageCustomImg = document.getElementById('stageCustomImg');
  const stageLatentHeroText = document.getElementById('stageLatentHeroText');
  const stageLatentLine1 = document.getElementById('stageLatentLine1');
  const stageLatentLine2 = document.getElementById('stageLatentLine2');
  const stageTaskArena = document.getElementById('stageTaskArena');
  const stageTaskTitle = document.getElementById('stageTaskTitle');

  // Fullscreen button (if present)
  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });
  }

  // Sound toggle
  btnToggleAudio.addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    if (window.soundFx) window.soundFx.enabled = isAudioEnabled;
    audioIcon.textContent = isAudioEnabled ? '🔊' : '🔇';
    btnToggleAudio.innerHTML = `<span id="audioIcon">${isAudioEnabled ? '🔊' : '🔇'}</span> Sound ${isAudioEnabled ? 'ON' : 'OFF'}`;
  });

  // Close reveal overlay manually
  btnCloseReveal.addEventListener('click', () => {
    winnerRevealOverlay.classList.remove('active');
  });

  function renderStageArena() {
    if (!appState || !appState.settings) return;

    if (appState.settings.eventName) {
      stageEventName.textContent = appState.settings.eventName;
    }

    // Toggle Floating QR Code only if custom QR is uploaded
    const hasCustomQr = Boolean(appState.settings && appState.settings.hasCustomQr);
    const customQrUrl = appState.settings ? appState.settings.customQrUrl : null;
    if (stageQrBox) {
      stageQrBox.style.display = hasCustomQr ? 'flex' : 'none';
      if (stageQrImg && customQrUrl) {
        if (stageQrImg.dataset.loadedUrl !== customQrUrl) {
          stageQrImg.src = customQrUrl;
          stageQrImg.dataset.loadedUrl = customQrUrl;
        }
      }
    }
    const stageQrSubText = document.getElementById('stageQrSubText');
    const stageQrActionText = document.getElementById('stageQrActionText');
    if (stageQrSubText) stageQrSubText.textContent = 'Audience Poll';
    if (stageQrActionText) stageQrActionText.textContent = 'Scan to Vote';

    const stageMode = appState.settings.stageMode || 'category';

    // Hide all arenas first
    stageCategoryArena.style.display = 'none';
    stagePerformerArena.style.display = 'none';
    if (stageLatentArena) stageLatentArena.style.display = 'none';
    if (stageTaskArena) stageTaskArena.style.display = 'none';

    // Navbar visibility: MUST BE HIDDEN for intermission modes (Option 1: Title/Image, Option 2: Task)
    if (stageMode === 'latent_title' || stageMode === 'task') {
      document.body.classList.add('hide-stage-nav');
      document.documentElement.setAttribute('data-stage-mode', stageMode);
      document.body.setAttribute('data-stage-mode', stageMode);
      if (stageHeader) {
        stageHeader.classList.add('hidden-nav');
        stageHeader.style.setProperty('display', 'none', 'important');
      }
      if (stageQrBox) stageQrBox.style.display = 'none';
    } else {
      document.body.classList.remove('hide-stage-nav');
      document.documentElement.setAttribute('data-stage-mode', stageMode);
      document.body.setAttribute('data-stage-mode', stageMode);
      if (stageHeader) {
        stageHeader.classList.remove('hidden-nav');
        stageHeader.style.removeProperty('display');
        stageHeader.style.display = 'flex';
      }
    }

    if (stageMode === 'latent_title') {
      if (stageTaskArena) stageTaskArena.style.setProperty('display', 'none', 'important');
      if (stageLatentArena) stageLatentArena.style.setProperty('display', 'flex', 'important');
      window.scrollTo(0, 0);
      renderLatentTitleStage();
      return;
    }

    if (stageMode === 'task') {
      if (stageLatentArena) stageLatentArena.style.setProperty('display', 'none', 'important');
      if (stageTaskArena) stageTaskArena.style.setProperty('display', 'flex', 'important');
      window.scrollTo(0, 0);
      renderTaskStage();
      return;
    }

    if (stageMode === 'live_rating') {
      stagePerformerArena.style.display = 'block';
      renderLivePerformerStage();
      return;
    }

    // Default: Category Arena
    stageCategoryArena.style.display = 'block';

    const categories = appState.categories || [];
    const activeCatId = appState.settings ? appState.settings.activeCategoryId : null;
    currentActiveCategory = categories.find(c => c.id === activeCatId) || categories[0] || null;

    if (!currentActiveCategory) {
      stageCategoryTitle.textContent = 'Welcome to Freshers\' Night';
      stageCategoryDesc.textContent = 'The host will open the first award round shortly.';
      stageVotesPill.className = 'badge badge-gold';
      stageVotesPill.textContent = '🔥 Ceremony Starting';
      stageNomineesContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">👑</div>
          <h3 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 0.5rem;">Awards Ceremony</h3>
          <p style="font-size: 1rem; max-width: 500px; margin: 0 auto;">
            The host will activate categories and nominees shortly.
          </p>
        </div>
      `;
      return;
    }

    // Category Info (No symbol/emoji in title as requested)
    stageCategoryTitle.textContent = currentActiveCategory.title;
    stageCategoryDesc.textContent = currentActiveCategory.description || 'Cast your votes now from your mobile screen!';

    // Vote Count for this category
    const catVotes = (appState.votes || []).filter(v => v.categoryId === currentActiveCategory.id);
    stageVotesPill.className = 'badge badge-gold';
    stageVotesPill.textContent = `🔥 ${catVotes.length} Vote${catVotes.length === 1 ? '' : 's'} Cast`;

    // Nominees (Sorted Alphabetically, Name and Photo/Avatar ONLY)
    const candidates = (appState.candidates || []).filter(c => c.categoryId === currentActiveCategory.id);
    candidates.sort((a, b) => a.name.localeCompare(b.name));

    stageNomineesContainer.innerHTML = '';
    if (candidates.length === 0) {
      stageNomineesContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          No nominees selected for this category yet.
        </div>
      `;
      return;
    }

    candidates.forEach(cand => {
      const card = document.createElement('div');
      card.className = 'stage-nominee-card';
      card.id = `stage-card-${cand.id}`;

      const photoUrl = (appState.personPhotos && cand.roll_no) ? appState.personPhotos[cand.roll_no] : cand.photo;

      let avatarHtml = '';
      if (photoUrl) {
        avatarHtml = `<div class="stage-nominee-avatar" style="background-image: url('${photoUrl}');"></div>`;
      } else {
        const initials = cand.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        const bg = cand.avatarColor || 'var(--primary)';
        avatarHtml = `<div class="stage-nominee-avatar" style="background-color: ${bg};">${initials}</div>`;
      }

      card.innerHTML = `
        ${avatarHtml}
        <div class="stage-nominee-name">${cand.name}</div>
      `;

      stageNomineesContainer.appendChild(card);
    });
  }

  function renderLivePerformerStage() {
    const liveRating = appState.settings.liveRating || {};
    const activeRoll = liveRating.activePerformerRoll;
    const isOpen = liveRating.isOpen;

    // Toggle Floating QR Code & text based on Mode 2
    const hasCustomQr = Boolean(appState.settings && appState.settings.hasCustomQr);
    const customQrUrl = appState.settings ? appState.settings.customQrUrl : null;
    if (stageQrBox) {
      stageQrBox.style.display = hasCustomQr ? 'flex' : 'none';
      if (stageQrImg && customQrUrl) {
        if (stageQrImg.dataset.loadedUrl !== customQrUrl) {
          stageQrImg.src = customQrUrl;
          stageQrImg.dataset.loadedUrl = customQrUrl;
        }
      }
    }
    const stageQrSubText = document.getElementById('stageQrSubText');
    const stageQrActionText = document.getElementById('stageQrActionText');
    if (stageQrSubText) stageQrSubText.textContent = 'Live Voting';
    if (stageQrActionText) stageQrActionText.textContent = 'Scan to Vote (1–10)';

    if (!activeRoll) {
      stagePerformerName.textContent = 'Awaiting Next Performer';
      stagePerformerPhoto.style.backgroundImage = 'none';
      stagePerformerPhoto.textContent = '🎤';
      if (stagePerformerRatingTally) stagePerformerRatingTally.textContent = '';
      performerLineStatusBadge.className = 'badge';
      performerLineStatusBadge.textContent = 'Line Paused';
      stageVotesPill.className = 'badge badge-gold';
      stageVotesPill.textContent = '🔥 0 Votes Cast';
      return;
    }

    const performer = (appState.roster || []).find(p => String(p.roll_no) === String(activeRoll));
    if (!performer) return;

    stagePerformerName.textContent = performer.name;
    const photoUrl = (appState.personPhotos && (appState.personPhotos[String(activeRoll)] || appState.personPhotos[performer.roll_no])) || performer.photo;
    if (photoUrl) {
      if (stagePerformerPhoto.dataset.loadedPhoto !== photoUrl) {
        stagePerformerPhoto.style.backgroundImage = `url('${photoUrl}')`;
        stagePerformerPhoto.textContent = '';
        stagePerformerPhoto.dataset.loadedPhoto = photoUrl;
      }
    } else {
      if (stagePerformerPhoto.dataset.loadedPhoto !== 'avatar') {
        stagePerformerPhoto.style.backgroundImage = 'none';
        stagePerformerPhoto.style.backgroundColor = performer.avatarColor || '#6366f1';
        stagePerformerPhoto.textContent = performer.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        stagePerformerPhoto.dataset.loadedPhoto = 'avatar';
      }
    }

    // Number of people rated is hidden on the card as requested
    if (stagePerformerRatingTally) stagePerformerRatingTally.textContent = '';

    // Top navbar: Votes Cast (matching Mode 1 exactly)
    const ratings = (appState.performerRatings || []).filter(r => (r.rollNo === activeRoll || r.roll_no === activeRoll));
    const voteCount = ratings.length;
    stageVotesPill.className = 'badge badge-gold';
    stageVotesPill.textContent = `🔥 ${voteCount} Vote${voteCount === 1 ? '' : 's'} Cast`;

    if (isOpen) {
      performerLineStatusBadge.className = 'badge badge-live';
      performerLineStatusBadge.textContent = '🔴 Live on Stage • Rating Open (1 - 10)';
    } else {
      performerLineStatusBadge.className = 'badge badge-locked';
      performerLineStatusBadge.textContent = '🔒 Rating Line Closed';
    }
  }

  function renderLatentTitleStage() {
    stageVotesPill.className = 'badge badge-gold';
    stageVotesPill.textContent = '⭐ Stage Intermission';

    const customImgUrl = appState.settings && appState.settings.stageCustomImage;
    if (customImgUrl && stageCustomImageBox && stageCustomImg) {
      if (stageCustomImg.getAttribute('src') !== customImgUrl) {
        stageCustomImg.src = customImgUrl;
      }
      stageCustomImageBox.style.display = 'flex';
      if (stageLatentHeroText) stageLatentHeroText.style.display = 'none';
    } else {
      if (stageCustomImageBox) stageCustomImageBox.style.display = 'none';
      if (stageLatentHeroText) stageLatentHeroText.style.display = 'flex';

      const titles = (appState && appState.settings && appState.settings.latentTitle) || {};
      const l1 = titles.line1 || "FRESHERS'";
      const l2 = titles.line2 || "GOT LATENT";

      if (stageLatentLine1) stageLatentLine1.textContent = l1;
      if (stageLatentLine2) stageLatentLine2.textContent = l2;
    }
  }

  function renderTaskStage() {
    stageVotesPill.className = 'badge badge-live';
    stageVotesPill.textContent = '🎯 Stage Challenge';

    const tasks = (appState && appState.tasks) || [];
    const activeTaskId = appState && appState.settings && appState.settings.activeTaskId;
    let activeTask = tasks.find(t => String(t.id) === String(activeTaskId));
    if (!activeTask && tasks.length > 0) activeTask = tasks[0];

    let taskText = 'Stage Challenge';
    if (activeTask && activeTask.title) {
      taskText = activeTask.title;
    } else if (appState && appState.settings && appState.settings.activeTaskTitle) {
      taskText = appState.settings.activeTaskTitle;
    }

    if (stageTaskTitle) {
      stageTaskTitle.textContent = taskText;
    }
  }

  function handleCountdown(seconds, mode, awardTitle) {
    winnerRevealOverlay.classList.remove('active');
    countdownOverlay.classList.add('active');
    countdownNumber.textContent = seconds;

    if (countdownTeaserText) {
      if (awardTitle) {
        countdownTeaserText.textContent = `Revealing ${awardTitle} In`;
      } else if (mode === 'live_rating') {
        countdownTeaserText.textContent = 'Revealing Performance Champion In';
      } else {
        countdownTeaserText.textContent = 'Revealing The Winner In';
      }
    }

    // Trigger visual tick animation
    countdownNumber.style.animation = 'none';
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = 'zoom-tick 1s infinite cubic-bezier(0.16, 1, 0.3, 1)';

    try {
      if (window.soundFx) {
        window.soundFx.playCountdownTick(seconds);
        if (seconds === 3) {
          window.soundFx.playTensionRiser(3.2);
        }
      }
    } catch (e) {}
  }

  function handleReveal(data) {
    countdownOverlay.classList.remove('active');

    const catId = (data && data.categoryId) || (currentActiveCategory ? currentActiveCategory.id : null);
    const category = (appState.categories || []).find(c => c.id === catId);
    
    // Find winner
    let winner = data && data.winner;
    if (!winner) {
      const candidates = (appState.candidates || []).filter(c => c.categoryId === catId);
      const votes = (appState.votes || []).filter(v => v.categoryId === catId);
      const tally = candidates.map(c => ({
        ...c,
        votes: votes.filter(v => v.candidateId === c.id).length
      }));
      tally.sort((a, b) => b.votes - a.votes);
      winner = tally[0] || (candidates[0] || null);
    }

    if (!winner) return;

    winnerRevealOverlay.classList.add('active');

    revealCategoryBadge.textContent = `Award Winner • ${category ? category.title : 'Award Category'}`;
    revealWinnerName.textContent = winner.name;
    revealWinnerVotes.textContent = `${winner.votes !== undefined ? winner.votes : 0} Votes`;

    const photoUrl = (appState.personPhotos && winner.roll_no) ? appState.personPhotos[winner.roll_no] : winner.photo;
    if (photoUrl) {
      revealWinnerAvatar.style.backgroundImage = `url('${photoUrl}')`;
      revealWinnerAvatar.textContent = '';
    } else {
      revealWinnerAvatar.style.backgroundImage = 'none';
      revealWinnerAvatar.style.backgroundColor = winner.avatarColor || '#6366f1';
      revealWinnerAvatar.textContent = (winner.name || '').split(' ').map(n => n[0]).join('').substring(0, 2);
    }

    // Play fanfare and burst confetti
    try {
      if (window.soundFx) window.soundFx.playGrandRevealFanfare();
    } catch (e) {}
    try {
      if (window.confettiBurst) window.confettiBurst();
    } catch (e) {}
  }

  function handlePerformerReveal(data) {
    countdownOverlay.classList.remove('active');

    let winner = data && data.winner;
    if (!winner) {
      winnerRevealOverlay.classList.remove('active');
      return;
    }

    winnerRevealOverlay.classList.add('active');

    const awardTitle = (data && data.awardTitle) || (winner && winner.awardTitle) || (appState && appState.settings && appState.settings.liveRating && appState.settings.liveRating.revealState && appState.settings.liveRating.revealState.awardTitle) || '👑 Stage Performance Champion';

    revealCategoryBadge.textContent = awardTitle;
    revealWinnerName.textContent = winner.name;
    const avg = winner.avgScore !== undefined ? winner.avgScore : 10;
    const count = winner.ratingsCount || 0;
    revealWinnerVotes.textContent = `⭐ Average Score: ${avg} / 10 (${count} Rating${count === 1 ? '' : 's'})`;

    const photoUrl = (appState.personPhotos && winner.roll_no) ? appState.personPhotos[winner.roll_no] : winner.photo;
    if (photoUrl) {
      revealWinnerAvatar.style.backgroundImage = `url('${photoUrl}')`;
      revealWinnerAvatar.textContent = '';
    } else {
      revealWinnerAvatar.style.backgroundImage = 'none';
      revealWinnerAvatar.style.backgroundColor = winner.avatarColor || '#6366f1';
      revealWinnerAvatar.textContent = (winner.name || '').split(' ').map(n => n[0]).join('').substring(0, 2);
    }

    try {
      if (window.soundFx) window.soundFx.playGrandRevealFanfare();
    } catch (e) {}
    try {
      if (window.confettiBurst) window.confettiBurst();
    } catch (e) {}
  }

  // Connect WebSocket
  const socket = new VotingSocket({
    onConnect: () => {
      stageConnectionBadge.className = 'badge badge-live';
      stageConnectionBadge.textContent = 'Live Broadcast';
    },
    onDisconnect: () => {
      stageConnectionBadge.className = 'badge badge-locked';
      stageConnectionBadge.textContent = 'Reconnecting...';
    },
    onStateUpdate: (state) => {
      appState = state;
      if (stageOnlineCount && state.onlineCount !== undefined) {
        stageOnlineCount.textContent = state.onlineCount;
      }
      renderStageArena();

      const isLiveRatingMode = state.settings && state.settings.stageMode === 'live_rating';

      if (isLiveRatingMode) {
        const lr = state.settings.liveRating || {};
        if (lr.revealState && lr.revealState.isRevealed && lr.revealState.winner) {
          if (!winnerRevealOverlay.classList.contains('active')) {
            handlePerformerReveal({ winner: lr.revealState.winner, awardTitle: lr.revealState.awardTitle });
          }
        } else if (!lr.revealState || !lr.revealState.isRevealed) {
          winnerRevealOverlay.classList.remove('active');
        }
      } else {
        const rs = state.settings && state.settings.revealState;
        if (rs && rs.isRevealed) {
          if (!winnerRevealOverlay.classList.contains('active')) {
            handleReveal({ categoryId: rs.categoryId });
          }
        } else if (!rs || !rs.isRevealed) {
          winnerRevealOverlay.classList.remove('active');
        }
      }
    },
    onOnlineCount: (data) => {
      if (stageOnlineCount && data && data.count !== undefined) {
        stageOnlineCount.textContent = data.count;
      }
    },
    onCountdown: (data) => {
      handleCountdown(data.seconds, data.mode, data.awardTitle);
    },
    onReveal: (data) => {
      handleReveal(data);
    },
    onPerformerReveal: (data) => {
      handlePerformerReveal(data);
    },
    onQrUpdated: (data) => {
      if (!appState) appState = {};
      if (!appState.settings) appState.settings = {};
      const hasCustom = Boolean(data && data.hasCustomQr);
      const qrUrl = data ? (data.customQrUrl || data.qrUrl) : null;
      appState.settings.hasCustomQr = hasCustom;
      appState.settings.customQrUrl = qrUrl;
      appState.settings.qrUrl = qrUrl;

      if (stageQrBox) {
        stageQrBox.style.display = hasCustom ? 'flex' : 'none';
      }
      if (stageQrImg && qrUrl) {
        if (stageQrImg.dataset.loadedUrl !== qrUrl) {
          stageQrImg.src = qrUrl;
          stageQrImg.dataset.loadedUrl = qrUrl;
        }
      }
    }
  });

  // Instant state fetch so presentation screens apply layout without waiting for socket handshake
  fetch('/api/state')
    .then(res => res.json())
    .then(initialState => {
      if (initialState && initialState.settings) {
        appState = initialState;
        renderStageArena();
      }
    })
    .catch(() => {});
})();
