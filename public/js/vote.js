/**
 * Anonymous Attendee Voting & Live Performer Rating Portal
 */

(function(){
  // 100% Anonymous Device Voter ID
  let anonymousVoterId = localStorage.getItem('y26_anon_voter_id');
  if (!anonymousVoterId) {
    anonymousVoterId = 'anon-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4);
    localStorage.setItem('y26_anon_voter_id', anonymousVoterId);
  }
  let myClientIp = null;

  let appState = null;
  let selectedCategory = null;
  let pendingCandidate = null;
  let currentActiveTab = 'category'; // 'category' or 'rating'
  let selectedPerformerScore = null;

  // DOM Elements
  const voteHeaderTitle = document.getElementById('voteHeaderTitle');
  const voteOnlineCount = document.getElementById('voteOnlineCount');
  const voteLockedBanner = document.getElementById('voteLockedBanner');

  const categoryVotingSection = document.getElementById('categoryVotingSection');
  const liveRatingSection = document.getElementById('liveRatingSection');

  // Categories Elements
  const categoriesView = document.getElementById('categoriesView');
  const nomineesView = document.getElementById('nomineesView');
  const categoriesGrid = document.getElementById('categoriesGrid');
  const btnBackToCategories = document.getElementById('btnBackToCategories');
  const activeCategoryBadgeText = document.getElementById('activeCategoryBadgeText');
  const activeCategoryTitleText = document.getElementById('activeCategoryTitleText');
  const activeCategoryDescText = document.getElementById('activeCategoryDescText');
  const categoryVotedBanner = document.getElementById('categoryVotedBanner');
  const nomineesGrid = document.getElementById('nomineesGrid');

  // Live Rating Elements
  const noPerformerBox = document.getElementById('noPerformerBox');
  const activePerformerCard = document.getElementById('activePerformerCard');
  const livePerformerPhoto = document.getElementById('livePerformerPhoto');
  const livePerformerName = document.getElementById('livePerformerName');
  const performerLineStatusVoteBadge = document.getElementById('performerLineStatusVoteBadge');
  const performerScoreSlider = document.getElementById('performerScoreSlider');
  const sliderScoreDisplay = document.getElementById('sliderScoreDisplay');
  const btnSubmitRating = document.getElementById('btnSubmitRating');
  const performerRatingSubmittedBadge = document.getElementById('performerRatingSubmittedBadge');
  const submittedScoreText = document.getElementById('submittedScoreText');

  // Confirmation Modal
  const voteConfirmModal = document.getElementById('voteConfirmModal');
  const modalNomineeName = document.getElementById('modalNomineeName');
  const modalNomineeCategory = document.getElementById('modalNomineeCategory');
  const btnCancelModalVote = document.getElementById('btnCancelModalVote');
  const btnConfirmModalVote = document.getElementById('btnConfirmModalVote');

  // Image Lightbox Elements
  const imageLightboxModal = document.getElementById('imageLightboxModal');
  const imageLightboxBackdrop = document.getElementById('imageLightboxBackdrop');
  const btnCloseImageLightbox = document.getElementById('btnCloseImageLightbox');
  const lightboxExpandedImg = document.getElementById('lightboxExpandedImg');
  const lightboxPerformerName = document.getElementById('lightboxPerformerName');
  let isLightboxOpen = false;

  function extractSymbol(badge) {
    if (!badge) return '👑';
    const match = badge.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic}|[\u2600-\u27BF])/u);
    if (match) return match[0];
    const trimmed = badge.trim();
    if (trimmed.length > 0) return trimmed.split(' ')[0];
    return '👑';
  }

  function showToast(message, type = 'normal') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Setup WebSocket connection
  const socket = new VotingSocket({
    role: 'voter',
    onConnect: () => {
      socket.send({ type: 'register_voter' });
    },
    onDisconnect: () => {},
    onClientInfo: (data) => {
      if (data && data.ip) {
        myClientIp = data.ip;
        renderCurrentView();
      }
    },
    onStateUpdate: (state) => {
      appState = state;
      if (state.myIp) {
        myClientIp = state.myIp;
      }
      if (state.settings && state.settings.eventName) {
        voteHeaderTitle.textContent = state.settings.eventName;
      }
      if (voteOnlineCount && state.onlineCount !== undefined) {
        voteOnlineCount.textContent = state.onlineCount;
      }

      // Check voting lock for category voting
      const isVotingOpen = state.settings ? state.settings.votingOpen : true;
      voteLockedBanner.style.display = isVotingOpen ? 'none' : 'flex';

      renderCurrentView();
    },
    onOnlineCount: (data) => {
      if (voteOnlineCount && data && data.count !== undefined) {
        voteOnlineCount.textContent = data.count;
      }
    },
    onToast: (data) => {
      showToast(data.message, data.type);
    }
  });

  // Strict Host Mode-Driven View Controller
  // When host has Mode 2 active, voters see ONLY live performer rating, not categories!
  function renderCurrentView() {
    if (!appState || !appState.settings) return;
    const stageMode = appState.settings.stageMode || 'category';

    if (stageMode === 'live_rating') {
      categoryVotingSection.style.display = 'none';
      liveRatingSection.style.display = 'block';
      renderLiveRatingUI();
    } else {
      categoryVotingSection.style.display = 'block';
      liveRatingSection.style.display = 'none';
      renderCategoriesView();
    }
  }

  // ==========================================
  // SECTION A: CATEGORIES & NOMINEES
  // ==========================================
  function renderCategoriesView() {
    if (selectedCategory) {
      const exists = (appState.categories || []).find(c => c.id === selectedCategory.id);
      if (exists) {
        selectedCategory = exists;
        showNomineesView(selectedCategory);
      } else {
        showCategoriesView();
      }
    } else {
      showCategoriesView();
    }
  }

  function getMyVoteForCategory(categoryId) {
    if (!appState || !appState.votes) return null;
    return appState.votes.find(v => v.categoryId === categoryId && (
      (myClientIp && v.ipAddress === myClientIp) ||
      (anonymousVoterId && v.voterId === anonymousVoterId)
    ));
  }

  function showCategoriesView() {
    selectedCategory = null;
    nomineesView.style.display = 'none';
    categoriesView.style.display = 'block';

    const categories = appState ? (appState.categories || []) : [];
    categoriesGrid.innerHTML = '';

    if (categories.length === 0) {
      categoriesGrid.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">⏳</div>
          <h3 style="font-size: 1.3rem; margin-bottom: 0.35rem;">Ceremony Starting Soon</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            The host is setting up the award categories. They will appear here live!
          </p>
        </div>
      `;
      return;
    }

    categories.forEach(cat => {
      const candidates = (appState.candidates || []).filter(c => c.categoryId === cat.id);
      const myVote = getMyVoteForCategory(cat.id);
      const isVoted = !!myVote;

      const card = document.createElement('div');
      card.className = `cat-select-card ${isVoted ? 'has-voted' : ''}`;
      card.id = `cat-card-${cat.id}`;

      let votedNomineeName = '';
      if (isVoted) {
        const cand = candidates.find(c => c.id === myVote.candidateId);
        if (cand) votedNomineeName = cand.name;
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 0.5rem;">
          ${isVoted 
            ? '<span class="badge badge-live" style="font-size: 0.75rem;">✓ Voted</span>' 
            : `<span class="badge" style="background: rgba(255, 255, 255, 0.08); font-size: 0.72rem;">${candidates.length} Nominees</span>`
          }
        </div>
        <h3 style="font-size: 1.25rem; margin-bottom: 0.25rem;">${cat.title}</h3>
        ${cat.description ? `<p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem;">${cat.description}</p>` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.6rem; border-top: 1px solid var(--border-subtle);">
          <span style="font-size: 0.85rem; color: ${isVoted ? '#34d399' : 'var(--accent-cyan)'}; font-weight: 600;">
            ${isVoted ? `Choice: ${votedNomineeName}` : 'Browse Nominees &rarr;'}
          </span>
          <span style="font-size: 1.1rem;">${isVoted ? '🔒' : '🗳️'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        showNomineesView(cat);
      });

      categoriesGrid.appendChild(card);
    });
  }

  function showNomineesView(category) {
    selectedCategory = category;
    categoriesView.style.display = 'none';
    nomineesView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (activeCategoryBadgeText) activeCategoryBadgeText.style.display = 'none';
    activeCategoryTitleText.textContent = category.title;
    activeCategoryDescText.textContent = category.description || '';

    const isVotingOpen = appState.settings ? appState.settings.votingOpen : true;
    const myVote = getMyVoteForCategory(category.id);
    const hasVoted = !!myVote;

    categoryVotedBanner.style.display = hasVoted ? 'block' : 'none';

    const candidates = (appState.candidates || []).filter(c => c.categoryId === category.id);
    candidates.sort((a, b) => a.name.localeCompare(b.name));
    nomineesGrid.innerHTML = '';

    if (candidates.length === 0) {
      nomineesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <p>No nominees selected for this category yet.</p>
        </div>
      `;
      return;
    }

    candidates.forEach(cand => {
      const isMyChoice = myVote && myVote.candidateId === cand.id;
      const card = document.createElement('div');
      card.className = `candidate-card ${isMyChoice ? 'is-voted' : ''}`;
      card.id = `cand-card-${cand.id}`;

      let avatarHtml = '';
      if (cand.photo) {
        avatarHtml = `<div class="candidate-avatar" style="background-image: url('${cand.photo}');"></div>`;
      } else {
        const initials = cand.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        const bg = cand.avatarColor || 'var(--primary)';
        avatarHtml = `<div class="candidate-avatar" style="background-color: ${bg};">${initials}</div>`;
      }

      let actionBtnHtml = '';
      if (isMyChoice) {
        actionBtnHtml = `<button class="btn btn-vote" disabled><span>✓</span> Voted</button>`;
      } else if (hasVoted) {
        actionBtnHtml = `<button class="btn btn-secondary btn-vote" disabled>Locked</button>`;
      } else if (!isVotingOpen) {
        actionBtnHtml = `<button class="btn btn-secondary btn-vote" disabled>Voting Locked</button>`;
      } else {
        actionBtnHtml = `<button class="btn btn-primary btn-vote" id="btn-vote-${cand.id}">Vote</button>`;
      }

      card.innerHTML = `
        ${avatarHtml}
        <h3 class="candidate-name">${cand.name}</h3>
        ${actionBtnHtml}
      `;

      if (!hasVoted && isVotingOpen) {
        card.addEventListener('click', () => {
          promptVoteConfirmation(cand, category);
        });
      }

      nomineesGrid.appendChild(card);
    });
  }

  btnBackToCategories.addEventListener('click', () => {
    showCategoriesView();
  });

  function promptVoteConfirmation(candidate, category) {
    pendingCandidate = candidate;
    modalNomineeName.textContent = `Vote for ${candidate.name}?`;
    modalNomineeCategory.innerHTML = `
      You are casting your anonymous vote for <strong>${candidate.name}</strong> in <strong>${category.title}</strong>.
    `;
    voteConfirmModal.classList.add('active');
  }

  btnCancelModalVote.addEventListener('click', () => {
    voteConfirmModal.classList.remove('active');
    pendingCandidate = null;
  });

  btnConfirmModalVote.addEventListener('click', () => {
    if (!pendingCandidate || !selectedCategory) return;

    socket.send({
      type: 'cast_vote',
      data: {
        voterId: anonymousVoterId,
        ipAddress: myClientIp,
        categoryId: selectedCategory.id,
        candidateId: pendingCandidate.id
      }
    });

    if (window.soundFx) window.soundFx.playVoteBeep();
    if (navigator.vibrate) navigator.vibrate([40, 50, 40]);

    voteConfirmModal.classList.remove('active');
    showToast(`Anonymous vote recorded for ${pendingCandidate.name}!`, 'success');
    pendingCandidate = null;
  });

  // ==========================================
  // SECTION B: LIVE PERFORMER RATING (1-10)
  // ==========================================
  function renderLiveRatingUI() {
    if (!appState || !appState.settings) return;
    const liveRating = appState.settings.liveRating || {};
    const activeRoll = liveRating.activePerformerRoll;
    const isOpen = liveRating.isOpen;

    if (!activeRoll) {
      noPerformerBox.style.display = 'block';
      activePerformerCard.style.display = 'none';
      return;
    }

    const performer = (appState.roster || []).find(p => p.roll_no === activeRoll);
    if (!performer) {
      noPerformerBox.style.display = 'block';
      activePerformerCard.style.display = 'none';
      return;
    }

    noPerformerBox.style.display = 'none';
    activePerformerCard.style.display = 'flex';

    livePerformerName.textContent = performer.name;

    // Line status indicator
    if (performerLineStatusVoteBadge) {
      if (isOpen) {
        performerLineStatusVoteBadge.className = 'badge badge-live';
        performerLineStatusVoteBadge.textContent = '🔴 Live on Stage • Rating Open';
      } else {
        performerLineStatusVoteBadge.className = 'badge badge-locked';
        performerLineStatusVoteBadge.textContent = '🔒 Rating Line Paused';
      }
    }

    // Showcase photo (prominent card, cached so it never refreshes or flickers on rating submit)
    const photoUrl = (appState.personPhotos && performer.roll_no) ? appState.personPhotos[performer.roll_no] : performer.photo;
    const showcaseContainer = livePerformerPhoto ? livePerformerPhoto.parentElement : null;

    if (photoUrl) {
      if (showcaseContainer) showcaseContainer.classList.add('has-photo');
      if (livePerformerPhoto.dataset.currentPhoto !== photoUrl) {
        livePerformerPhoto.style.backgroundImage = `url('${photoUrl}')`;
        livePerformerPhoto.textContent = '';
        livePerformerPhoto.dataset.currentPhoto = photoUrl;
      }
    } else {
      if (showcaseContainer) showcaseContainer.classList.remove('has-photo');
      if (livePerformerPhoto.dataset.currentPhoto !== 'avatar') {
        livePerformerPhoto.style.backgroundImage = 'none';
        livePerformerPhoto.style.backgroundColor = performer.avatarColor || '#6366f1';
        livePerformerPhoto.textContent = performer.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        livePerformerPhoto.dataset.currentPhoto = 'avatar';
      }
    }

    // Check if voter already rated this performer
    const ratings = appState.performerRatings || [];
    const myRating = ratings.find(r => (
      (myClientIp && r.ipAddress === myClientIp) ||
      (anonymousVoterId && r.voterId === anonymousVoterId)
    ) && (r.rollNo === activeRoll || r.roll_no === activeRoll));

    const scoreTag = (s) => (s === 10 ? ' (Paisa Vasool!)' : (s === 1 ? ' (Meh)' : ''));

    if (myRating) {
      selectedPerformerScore = myRating.score;
      if (performerScoreSlider) performerScoreSlider.value = myRating.score;
      if (sliderScoreDisplay) sliderScoreDisplay.textContent = myRating.score;
      if (performerRatingSubmittedBadge) performerRatingSubmittedBadge.style.display = 'none';

      // Disabled state shows Vote Submitted Successfully
      btnSubmitRating.textContent = '✓ Vote Submitted Successfully';
      btnSubmitRating.disabled = true;
      if (performerScoreSlider) performerScoreSlider.disabled = !isOpen;
    } else {
      const currentSliderVal = performerScoreSlider ? performerScoreSlider.value : 8;
      selectedPerformerScore = parseInt(currentSliderVal) || 8;
      if (sliderScoreDisplay) sliderScoreDisplay.textContent = selectedPerformerScore;
      if (performerRatingSubmittedBadge) performerRatingSubmittedBadge.style.display = 'none';

      btnSubmitRating.textContent = isOpen ? 'Submit Your Vote' : 'Rating Line Paused';
      btnSubmitRating.disabled = !isOpen;
      if (performerScoreSlider) performerScoreSlider.disabled = !isOpen;
    }
  }

  // Handle Score Slider Input
  function setScoreValue(val) {
    val = Math.max(1, Math.min(10, parseInt(val) || 8));
    selectedPerformerScore = val;
    if (performerScoreSlider) performerScoreSlider.value = val;
    if (sliderScoreDisplay) sliderScoreDisplay.textContent = val;

    const liveRating = (appState && appState.settings && appState.settings.liveRating) || {};
    const isOpen = Boolean(liveRating.isOpen);

    if (!isOpen) {
      btnSubmitRating.disabled = true;
      btnSubmitRating.textContent = 'Rating Line Paused';
      return;
    }

    const ratings = (appState && appState.performerRatings) || [];
    const activeRoll = liveRating.activePerformerRoll;
    const myRating = ratings.find(r => (
      (myClientIp && r.ipAddress === myClientIp) ||
      (anonymousVoterId && r.voterId === anonymousVoterId)
    ) && (r.rollNo === activeRoll || r.roll_no === activeRoll));

    if (myRating) {
      // If slider is on the currently submitted score, keep it disabled showing success
      if (val === myRating.score) {
        btnSubmitRating.textContent = '✓ Vote Submitted Successfully';
        btnSubmitRating.disabled = true;
      } else {
        // If slider value changed, activate and show Update Your Vote
        btnSubmitRating.textContent = 'Update Your Vote';
        btnSubmitRating.disabled = false;
      }
    } else {
      btnSubmitRating.textContent = 'Submit Your Vote';
      btnSubmitRating.disabled = false;
    }
  }

  if (performerScoreSlider) {
    performerScoreSlider.addEventListener('input', (e) => {
      setScoreValue(e.target.value);
    });
  }

  btnSubmitRating.addEventListener('click', () => {
    const liveRating = (appState && appState.settings && appState.settings.liveRating) || {};
    if (!liveRating.isOpen) return;

    const activeRoll = liveRating.activePerformerRoll;
    if (!activeRoll) return;

    const score = parseInt(performerScoreSlider ? performerScoreSlider.value : selectedPerformerScore) || 8;

    socket.send({
      type: 'submit_performer_rating',
      data: {
        voterId: anonymousVoterId,
        ipAddress: myClientIp,
        rollNo: activeRoll,
        score: score
      }
    });

    if (window.soundFx) window.soundFx.playVoteBeep();
    if (navigator.vibrate) navigator.vibrate([40, 50, 40]);

    // Button greys out in disabled state showing Vote Submitted Successfully
    btnSubmitRating.textContent = '✓ Vote Submitted Successfully';
    btnSubmitRating.disabled = true;
  });

  // Tap on Performer Photo to Expand in Fullscreen Lightbox
  const showcaseContainer = livePerformerPhoto ? livePerformerPhoto.parentElement : null;
  if (showcaseContainer) {
    showcaseContainer.addEventListener('click', () => {
      const liveRating = (appState && appState.settings && appState.settings.liveRating) || {};
      const activeRoll = liveRating.activePerformerRoll;
      if (!activeRoll) return;
      const performer = (appState.roster || []).find(p => p.roll_no === activeRoll);
      const photoUrl = (appState.personPhotos && activeRoll) ? appState.personPhotos[activeRoll] : (performer ? performer.photo : null);
      if (photoUrl && performer) {
        openImageLightbox(photoUrl, performer.name);
      }
    });
  }

  function openImageLightbox(imgUrl, name) {
    if (!imgUrl || !imageLightboxModal) return;
    if (lightboxExpandedImg) lightboxExpandedImg.src = imgUrl;
    if (lightboxPerformerName) lightboxPerformerName.textContent = name || '';
    imageLightboxModal.style.display = 'flex';
    isLightboxOpen = true;

    // Push history state so Android / iOS back button / back gesture closes lightbox
    try {
      history.pushState({ lightboxOpen: true }, '');
    } catch (e) {}
  }

  function closeImageLightbox(fromPopState = false) {
    if (!isLightboxOpen || !imageLightboxModal) return;
    imageLightboxModal.style.display = 'none';
    isLightboxOpen = false;
    if (lightboxExpandedImg) lightboxExpandedImg.src = '';

    if (!fromPopState) {
      if (history.state && history.state.lightboxOpen) {
        try {
          history.back();
        } catch (e) {}
      }
    }
  }

  if (btnCloseImageLightbox) {
    btnCloseImageLightbox.addEventListener('click', (e) => {
      e.stopPropagation();
      closeImageLightbox(false);
    });
  }

  if (imageLightboxBackdrop) {
    imageLightboxBackdrop.addEventListener('click', () => closeImageLightbox(false));
  }

  // Handle phone hardware/gesture back button seamlessly
  window.addEventListener('popstate', (e) => {
    if (isLightboxOpen) {
      closeImageLightbox(true);
    }
  });

})();
