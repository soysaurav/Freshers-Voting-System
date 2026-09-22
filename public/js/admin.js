/**
 * Host Admin Console Logic - Y26 Freshers
 * Features:
 * - Dual Stage Presentation Modes (Category Awards vs Live Performer Rating 1-10)
 * - Dynamic Category Creation and Editing (Title, Badge, Description, Nominees)
 * - Universal Photo Management (Photos synced across all categories by Roll No)
 * - Displaying PhD/MTech instead of roll numbers
 * - Stage QR upload/removal with status toggle
 * - Live Standings, Stage Controller & Dramatic Reveals
 */

(function(){
  let appState = null;
  let freshersRoster = [];

  // DOM Elements - Mode Switcher
  const btnModeCategory = document.getElementById('btnModeCategory');
  const btnModeLiveRating = document.getElementById('btnModeLiveRating');
  const panelCategoryMode = document.getElementById('panelCategoryMode');
  const panelLiveRatingMode = document.getElementById('panelLiveRatingMode');
  const currentStageModeBadge = document.getElementById('currentStageModeBadge');
  const btnPushModeToStage = document.getElementById('btnPushModeToStage');

  // DOM Elements - Header & Connectivity
  const adminSocketBadge = document.getElementById('adminSocketBadge');
  const btnOpenAddCategoryModal = document.getElementById('btnOpenAddCategoryModal');
  const btnCreateCategoryHeader = document.getElementById('btnCreateCategoryHeader');

  // DOM Elements - Mode 1: Category Awards
  const btnToggleVotingLock = document.getElementById('btnToggleVotingLock');
  const lockStatusIcon = document.getElementById('lockStatusIcon');
  const lockStatusText = document.getElementById('lockStatusText');
  const adminCategoriesList = document.getElementById('adminCategoriesList');
  const categorySelect = document.getElementById('categorySelect');
  const btnTriggerReveal = document.getElementById('btnTriggerReveal');
  const btnResetReveal = document.getElementById('btnResetReveal');
  const btnClearCategoryVotes = document.getElementById('btnClearCategoryVotes');
  const adminTotalCategoryVotes = document.getElementById('adminTotalCategoryVotes');
  const adminTallyList = document.getElementById('adminTallyList');

  // DOM Elements - Mode 2: Live Performer Rating
  const btnToggleRatingLine = document.getElementById('btnToggleRatingLine');
  const ratingLineStatusIcon = document.getElementById('ratingLineStatusIcon');
  const ratingLineStatusText = document.getElementById('ratingLineStatusText');
  const activePerformerSelect = document.getElementById('activePerformerSelect');
  const currentStagePerformerBadge = document.getElementById('currentStagePerformerBadge');
  const btnConfirmPerformerSelect = document.getElementById('btnConfirmPerformerSelect');
  const performerPendingNotice = document.getElementById('performerPendingNotice');
  const btnRevealMrFresher = document.getElementById('btnRevealMrFresher');
  const btnRevealMsFresher = document.getElementById('btnRevealMsFresher');
  const btnResetPerformerReveal = document.getElementById('btnResetPerformerReveal');
  const btnClearPerformerRatings = document.getElementById('btnClearPerformerRatings');
  const btnClearAllPerformerRatings = document.getElementById('btnClearAllPerformerRatings');
  const totalRatingsCountText = document.getElementById('totalRatingsCountText');
  const performerScoreboardList = document.getElementById('performerScoreboardList');

  // DOM Elements - Universal Photo Manager
  const photoSearchFilter = document.getElementById('photoSearchFilter');
  const nomineePhotoManagerList = document.getElementById('nomineePhotoManagerList');

  // DOM Elements - Stage QR
  const adminQrPreview = document.getElementById('adminQrPreview');
  const qrFileInput = document.getElementById('qrFileInput');
  const qrUploadStatus = document.getElementById('qrUploadStatus');
  const qrStageStatusBadge = document.getElementById('qrStageStatusBadge');
  const btnRemoveQr = document.getElementById('btnRemoveQr');

  // DOM Elements - Add/Edit Category Modal
  const categoryModal = document.getElementById('categoryModal');
  const categoryModalTitle = document.getElementById('categoryModalTitle');
  const categoryForm = document.getElementById('categoryForm');
  const editCategoryId = document.getElementById('editCategoryId');
  const catTitleInput = document.getElementById('catTitleInput');
  const catDescInput = document.getElementById('catDescInput');
  const btnSelectAllNominees = document.getElementById('btnSelectAllNominees');
  const btnDeselectAllNominees = document.getElementById('btnDeselectAllNominees');
  const rosterSearchInput = document.getElementById('rosterSearchInput');
  const rosterPickerList = document.getElementById('rosterPickerList');
  const rosterSelectedCountText = document.getElementById('rosterSelectedCountText');
  const btnCloseCategoryModal = document.getElementById('btnCloseCategoryModal');
  const btnCancelCategoryModal = document.getElementById('btnCancelCategoryModal');
  const btnSaveCategorySubmit = document.getElementById('btnSaveCategorySubmit');

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
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : type === 'gold' ? 'toast-gold' : ''}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : type === 'gold' ? '👑' : 'ℹ️'}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Lightweight client-side image compressor & downscaler
  // Prevents mobile phones from uploading 15MB 48MP raw images that choke the browser thread and GPU
  async function downscaleImageFile(file, maxWidth = 800, maxHeight = 800, quality = 0.85) {
    if (!file || file.type === 'image/svg+xml') return file;
    // If image is already smaller than 120KB, return as-is
    if (file.size < 120 * 1024) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w <= maxWidth && h <= maxHeight && file.size < 350 * 1024) {
            resolve(file);
            return;
          }
          const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
          const targetW = Math.round(w * ratio);
          const targetH = Math.round(h * ratio);

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, targetW, targetH);

          canvas.toBlob((blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  function updateQrUI(hasCustomQr, qrUrl) {
    const url = qrUrl || (appState && appState.settings && (appState.settings.customQrUrl || appState.settings.qrUrl));
    const previewBox = document.getElementById('adminQrPreviewBox');
    if (adminQrPreview) {
      if (hasCustomQr && url) {
        if (adminQrPreview.dataset.src !== url) {
          adminQrPreview.src = url;
          adminQrPreview.dataset.src = url;
        }
        adminQrPreview.style.display = 'block';
      } else {
        adminQrPreview.src = '';
        adminQrPreview.dataset.src = '';
        adminQrPreview.style.display = 'none';
      }
    }
    if (previewBox) {
      previewBox.style.display = (hasCustomQr && url) ? 'flex' : 'none';
    }
    if (qrStageStatusBadge) {
      if (hasCustomQr) {
        qrStageStatusBadge.className = 'badge badge-live';
        qrStageStatusBadge.textContent = '✓ Active on Stage Projector';
      } else {
        qrStageStatusBadge.className = 'badge badge-locked';
        qrStageStatusBadge.textContent = 'Scan Widget Hidden on Stage';
      }
    }
    if (btnRemoveQr) {
      btnRemoveQr.style.display = hasCustomQr ? 'inline-flex' : 'none';
    }
  }

  if (qrFileInput) {
    qrFileInput.addEventListener('change', async () => {
      const rawFile = qrFileInput.files[0];
      if (!rawFile) return;
      if (qrUploadStatus) qrUploadStatus.textContent = 'Optimizing & uploading...';
      try {
        const file = await downscaleImageFile(rawFile, 800, 800, 0.85);
        const formData = new FormData();
        formData.append('qr', file);
        const r = await fetch('/api/upload-qr', {
          method: 'POST',
          body: formData
        });
        const data = await r.json();
        if (data.success) {
          if (qrUploadStatus) qrUploadStatus.textContent = '✓ Uploaded & visible on stage!';
          showToast('Stage QR image uploaded and enabled on stage screen!', 'success');
          setTimeout(() => { if (qrUploadStatus) qrUploadStatus.textContent = ''; }, 3500);
        } else {
          if (qrUploadStatus) qrUploadStatus.textContent = 'Upload failed';
          showToast('QR Upload failed: ' + (data.error || ''), 'error');
        }
      } catch (err) {
        if (qrUploadStatus) qrUploadStatus.textContent = 'Error';
        showToast('Error uploading QR image', 'error');
      }
      qrFileInput.value = '';
    });
  }

  if (btnRemoveQr) {
    btnRemoveQr.addEventListener('click', () => {
      if (confirm('Remove custom QR code? This will completely hide the scan-to-vote widget from the stage screen.')) {
        fetch('/api/remove-qr', { method: 'POST' })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              updateQrUI(false);
              showToast('QR code removed. Scan widget is now hidden on stage.', 'normal');
            } else {
              showToast('Error removing QR', 'error');
            }
          })
          .catch(() => showToast('Error removing QR', 'error'));
      }
    });
  }

  // Setup WebSocket connection
  const socket = new VotingSocket({
    onConnect: () => {
      if (adminSocketBadge) {
        adminSocketBadge.className = 'badge badge-live';
        adminSocketBadge.textContent = 'Server Connected';
      }
    },
    onDisconnect: () => {
      if (adminSocketBadge) {
        adminSocketBadge.className = 'badge badge-locked';
        adminSocketBadge.textContent = 'Disconnected';
      }
    },
    onStateUpdate: (state) => {
      appState = state;
      if (state.roster && state.roster.length > 0) {
        freshersRoster = state.roster;
      }
      renderAdminDashboard();
    },
    onToast: (data) => {
      showToast(data.message, data.type);
    },
    onReveal: (data) => {
      showToast(`🎉 CROWNING WINNER: ${data.winner ? data.winner.name : 'Category Winner'}!`, 'gold');
    },
    onPerformerReveal: (data) => {
      showToast(`⭐ CROWNING CHAMPION: ${data.winner ? data.winner.name : 'Performer'}!`, 'gold');
    },
    onCountdown: (data) => {
      showToast(`⏳ Stage Countdown: ${data.seconds}...`, 'gold');
    },
    onQrUpdated: (data) => {
      const hasCustom = Boolean(data && data.hasCustomQr);
      const qrUrl = data ? (data.customQrUrl || data.qrUrl) : null;
      if (appState && appState.settings) {
        appState.settings.hasCustomQr = hasCustom;
        appState.settings.customQrUrl = qrUrl;
        appState.settings.qrUrl = qrUrl;
      }
      updateQrUI(hasCustom, qrUrl);
    }
  });

  // Fetch roster fallback
  fetch('/api/freshers')
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        freshersRoster = data;
        renderNomineePhotoManager();
      }
    })
    .catch(() => {});

  function getActiveCategory() {
    if (!appState || !appState.categories || appState.categories.length === 0) return null;
    const catId = appState.settings ? appState.settings.activeCategoryId : null;
    return appState.categories.find(c => c.id === catId) || appState.categories[0];
  }

  // ==========================================
  // MODE SWITCHER (Category vs Live Rating)
  // ==========================================
  let currentAdminViewMode = 'category';

  function updateModeUI(liveStageMode) {
    liveStageMode = liveStageMode || (appState && appState.settings && appState.settings.stageMode) || 'category';

    const intermissionStageStatusBadge = document.getElementById('intermissionStageStatusBadge');
    const btnShowLatentTitle = document.getElementById('btnShowLatentTitle');
    const btnShowTaskOnStage = document.getElementById('btnShowTaskOnStage');

    // Update stage status badge
    if (currentStageModeBadge) {
      if (liveStageMode === 'live_rating') {
        currentStageModeBadge.textContent = '⭐ Mode 2: Live Performer';
        currentStageModeBadge.className = 'badge badge-gold';
      } else if (liveStageMode === 'latent_title') {
        currentStageModeBadge.textContent = '🌟 Title: FRESHERS\' GOT LATENT';
        currentStageModeBadge.className = 'badge badge-gold';
      } else if (liveStageMode === 'task') {
        currentStageModeBadge.textContent = '🎯 Stage: Task Screen Active';
        currentStageModeBadge.className = 'badge badge-live';
      } else {
        currentStageModeBadge.textContent = '👑 Mode 1: Award Categories';
        currentStageModeBadge.className = 'badge badge-live';
      }
    }

    // Intermission status badge in intermission card
    if (intermissionStageStatusBadge) {
      if (liveStageMode === 'latent_title') {
        intermissionStageStatusBadge.textContent = '🌟 Stage: FRESHERS\' GOT LATENT Active';
        intermissionStageStatusBadge.className = 'badge badge-gold';
      } else if (liveStageMode === 'task') {
        intermissionStageStatusBadge.textContent = '🎯 Stage: Showing Task (White Font)';
        intermissionStageStatusBadge.className = 'badge badge-live';
      } else {
        intermissionStageStatusBadge.textContent = 'Stage: Live Voting Active';
        intermissionStageStatusBadge.className = 'badge';
      }
    }

    // Button 1: Option 1 (Custom Presentation Image or FRESHERS' GOT LATENT Vector Title)
    if (btnShowLatentTitle) {
      const hasImg = Boolean(appState && appState.settings && appState.settings.stageCustomImage);
      const titleLabel = hasImg ? 'Presentation Image' : "FRESHERS' GOT LATENT";
      if (liveStageMode === 'latent_title') {
        btnShowLatentTitle.textContent = `✓ ${titleLabel} is Live on Stage`;
        btnShowLatentTitle.className = 'btn btn-secondary btn-lg';
        btnShowLatentTitle.disabled = true;
      } else {
        btnShowLatentTitle.textContent = `🎬 Display ${titleLabel} on Stage`;
        btnShowLatentTitle.className = 'btn btn-gold btn-lg';
        btnShowLatentTitle.disabled = false;
      }
    }

    // Button 2: Show Task on Stage state
    if (typeof updateTaskButtonText === 'function') {
      updateTaskButtonText();
    }

    // Update panels according to currentAdminViewMode
    if (currentAdminViewMode === 'live_rating') {
      btnModeCategory.classList.remove('active');
      btnModeLiveRating.classList.add('active');
      panelCategoryMode.style.display = 'none';
      panelLiveRatingMode.style.display = 'block';
    } else {
      btnModeCategory.classList.add('active');
      btnModeLiveRating.classList.remove('active');
      panelCategoryMode.style.display = 'block';
      panelLiveRatingMode.style.display = 'none';
    }

    // Update Push to Stage button
    if (btnPushModeToStage) {
      if (currentAdminViewMode === liveStageMode) {
        btnPushModeToStage.disabled = true;
        btnPushModeToStage.className = 'btn btn-secondary';
        btnPushModeToStage.innerHTML = `✓ ${liveStageMode === 'live_rating' ? 'Mode 2' : 'Mode 1'} is Live on Stage`;
      } else if (liveStageMode === 'latent_title' || liveStageMode === 'task') {
        btnPushModeToStage.disabled = false;
        btnPushModeToStage.className = 'btn btn-gold';
        btnPushModeToStage.innerHTML = `🎬 Return Stage to ${currentAdminViewMode === 'live_rating' ? 'Mode 2: Live Voting' : 'Mode 1: Awards'}`;
      } else {
        btnPushModeToStage.disabled = false;
        btnPushModeToStage.className = 'btn btn-gold';
        btnPushModeToStage.innerHTML = `🎬 Display ${currentAdminViewMode === 'live_rating' ? 'Mode 2' : 'Mode 1'} on Stage`;
      }
    }
  }

  btnModeCategory.addEventListener('click', () => {
    currentAdminViewMode = 'category';
    const liveStageMode = (appState && appState.settings && appState.settings.stageMode) || 'category';
    updateModeUI(liveStageMode);
  });

  btnModeLiveRating.addEventListener('click', () => {
    currentAdminViewMode = 'live_rating';
    const liveStageMode = (appState && appState.settings && appState.settings.stageMode) || 'category';
    updateModeUI(liveStageMode);
  });

  if (btnPushModeToStage) {
    btnPushModeToStage.addEventListener('click', () => {
      socket.send({
        type: 'set_stage_mode',
        data: { mode: currentAdminViewMode }
      });
      showToast(`🎬 Pushed ${currentAdminViewMode === 'live_rating' ? 'Mode 2: Live Performer' : 'Mode 1: Award Categories'} to Stage & Voters!`, 'gold');
    });
  }

  // ==========================================
  // MASTER RENDER
  // ==========================================
  function renderAdminDashboard() {
    if (!appState) return;

    // Current Mode
    const currentMode = (appState.settings && appState.settings.stageMode) || 'category';
    updateModeUI(currentMode);

    // QR status
    const hasCustomQr = Boolean(appState.settings && appState.settings.hasCustomQr);
    updateQrUI(hasCustomQr);

    // Mode 1: Category Voting
    const isOpen = appState.settings ? appState.settings.votingOpen : true;
    lockStatusIcon.textContent = isOpen ? '🔓' : '🔒';
    lockStatusText.textContent = isOpen ? 'Lock Category Voting' : 'Unlock Category Voting';
    btnToggleVotingLock.className = `btn btn-sm ${isOpen ? 'btn-secondary' : 'btn-danger'}`;

    renderCategoriesManagement();
    renderStageCategoryDropdown();
    renderLiveStandings();

    // Mode 2: Live Performer Rating
    renderLivePerformerAdmin();

    // Section 3: Universal Photo Manager
    renderNomineePhotoManager();

    // Section 4: Stage Intermission & Tasks Management
    renderIntermissionTasksUI();
  }

  // ==========================================
  // MODE 1: CATEGORIES MANAGEMENT
  // ==========================================
  function renderCategoriesManagement() {
    const categories = appState.categories || [];
    adminCategoriesList.innerHTML = '';

    if (categories.length === 0) {
      adminCategoriesList.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📋</div>
          <p style="font-size: 1.05rem; margin-bottom: 0.75rem; color: var(--text-main);">No award categories created yet</p>
          <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto 1.25rem;">
            Click the button below to add your first category, assign custom badges, and pick nominees from the freshers list.
          </p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('btnCreateCategoryHeader').click()">
            + Create First Category
          </button>
        </div>
      `;
      return;
    }

    const activeCat = getActiveCategory();

    categories.forEach(cat => {
      const candidates = (appState.candidates || []).filter(c => c.categoryId === cat.id);
      const isStageActive = activeCat && activeCat.id === cat.id;
      const symbol = extractSymbol(cat.badge);

      const card = document.createElement('div');
      card.className = `category-manage-card ${isStageActive ? 'is-stage-active' : ''}`;
      card.id = `cat-manage-${cat.id}`;

      card.innerHTML = `
        <div style="flex: 1; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem;">
            ${isStageActive ? '<span class="badge badge-live">Active on Stage</span>' : ''}
          </div>
          <h4 style="font-size: 1.15rem; margin: 0.15rem 0;">${cat.title}</h4>
          <div style="font-size: 0.82rem; color: var(--text-muted);">
            ${candidates.length} Nominee${candidates.length === 1 ? '' : 's'} &bull; ${cat.description || 'No description'}
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="btn ${isStageActive ? 'btn-gold' : 'btn-secondary'} btn-sm btn-activate-stage" data-cat-id="${cat.id}">
            ${isStageActive ? '✓ On Stage' : '🎬 Send to Stage'}
          </button>
          <button class="btn btn-secondary btn-sm btn-edit-category" data-cat-id="${cat.id}">
            ✏️ Edit Category & Nominees
          </button>
          <button class="btn btn-danger btn-sm btn-delete-category" data-cat-id="${cat.id}" title="Delete Category">
            🗑️
          </button>
        </div>
      `;

      // Event handlers
      card.querySelector('.btn-activate-stage').addEventListener('click', () => {
        socket.send({
          type: 'set_active_category',
          data: { categoryId: cat.id }
        });
        showToast(`"${cat.title}" set active on Stage!`, 'success');
      });

      card.querySelector('.btn-edit-category').addEventListener('click', () => {
        openEditCategoryModal(cat);
      });

      card.querySelector('.btn-delete-category').addEventListener('click', () => {
        if (confirm(`Delete category "${cat.title}" and all its votes?`)) {
          socket.send({
            type: 'delete_category',
            data: { categoryId: cat.id }
          });
          showToast(`Category "${cat.title}" deleted`, 'error');
        }
      });

      adminCategoriesList.appendChild(card);
    });
  }

  function renderStageCategoryDropdown() {
    const categories = appState.categories || [];
    const activeCat = getActiveCategory();

    categorySelect.innerHTML = '';
    if (categories.length === 0) {
      categorySelect.innerHTML = `<option value="">No categories available</option>`;
      return;
    }

    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.title;
      if (activeCat && cat.id === activeCat.id) {
        opt.selected = true;
      }
      categorySelect.appendChild(opt);
    });
  }

  categorySelect.addEventListener('change', (e) => {
    const newCatId = e.target.value;
    if (newCatId) {
      socket.send({
        type: 'set_active_category',
        data: { categoryId: newCatId }
      });
    }
  });

  btnToggleVotingLock.addEventListener('click', () => {
    if (!appState) return;
    const nextState = !(appState.settings ? appState.settings.votingOpen : true);
    socket.send({
      type: 'set_voting_open',
      data: { votingOpen: nextState }
    });
  });

  btnTriggerReveal.addEventListener('click', () => {
    const activeCat = getActiveCategory();
    if (!activeCat) {
      showToast('Please create or select an active category first', 'error');
      return;
    }

    const cands = (appState.candidates || []).filter(c => c.categoryId === activeCat.id);
    if (cands.length === 0) {
      showToast('Cannot reveal: No nominees in this category yet!', 'error');
      return;
    }

    if (confirm(`Trigger Big Screen Reveal for "${activeCat.title}"?`)) {
      socket.send({
        type: 'trigger_reveal',
        data: { categoryId: activeCat.id }
      });
      showToast('🎬 Reveal countdown broadcasting to stage!', 'gold');
    }
  });

  btnResetReveal.addEventListener('click', () => {
    socket.send({ type: 'reset_reveal' });
    showToast('Stage screen reset to live cards', 'normal');
  });

  btnClearCategoryVotes.addEventListener('click', () => {
    const activeCat = getActiveCategory();
    if (!activeCat) return;
    if (confirm(`Clear all cast votes for "${activeCat.title}"?`)) {
      socket.send({
        type: 'clear_category_votes',
        data: { categoryId: activeCat.id }
      });
      showToast(`Votes cleared for ${activeCat.title}`, 'error');
    }
  });

  function renderLiveStandings() {
    const activeCat = getActiveCategory();
    adminTallyList.innerHTML = '';

    if (!activeCat) {
      adminTotalCategoryVotes.textContent = '0';
      adminTallyList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No category selected.</div>`;
      return;
    }

    const candidates = (appState.candidates || []).filter(c => c.categoryId === activeCat.id);
    const votes = (appState.votes || []).filter(v => v.categoryId === activeCat.id);
    const totalVotes = votes.length;

    adminTotalCategoryVotes.textContent = totalVotes;

    if (candidates.length === 0) {
      adminTallyList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No nominees registered in this category.</div>`;
      return;
    }

    const tally = candidates.map(c => {
      const count = votes.filter(v => v.candidateId === c.id).length;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return { ...c, votes: count, percentage: pct };
    });

    tally.sort((a, b) => b.votes - a.votes);

    tally.forEach((cand, idx) => {
      const isLeader = idx === 0 && cand.votes > 0;
      const row = document.createElement('div');
      row.className = `tally-item ${isLeader ? 'is-leader' : ''}`;

      let avatarBg = cand.avatarColor || 'var(--primary)';
      let avatarStyle = `background-color: ${avatarBg};`;
      let avatarContent = cand.name.split(' ').map(n => n[0]).join('').substring(0, 2);

      const universalPhoto = (appState.personPhotos && cand.roll_no) ? appState.personPhotos[cand.roll_no] : cand.photo;
      if (universalPhoto) {
        avatarStyle = `background-image: url('${universalPhoto}'); background-size: cover; background-position: center; border: 2px solid var(--accent-gold);`;
        avatarContent = '';
      }

      // Display PhD / M.Tech instead of roll number
      const programText = cand.program || cand.branch || '';

      row.innerHTML = `
        <div class="tally-avatar" style="${avatarStyle}">${avatarContent}</div>
        <div class="tally-meta">
          <div class="tally-name">${cand.name} ${isLeader ? '👑' : ''}</div>
          <div class="tally-sub">${programText}</div>
        </div>
        <div class="tally-score">
          <div class="tally-votes ${isLeader ? 'gold-gradient' : ''}">${cand.votes}</div>
          <div class="tally-pct">${cand.percentage}%</div>
        </div>
      `;

      adminTallyList.appendChild(row);
    });
  }

  // ==========================================
  // MODE 2: LIVE PERFORMER RATING ADMIN
  // ==========================================
  function renderLivePerformerAdmin() {
    const liveRating = (appState.settings && appState.settings.liveRating) || {
      isOpen: false,
      activePerformerRoll: null
    };

    // Toggle button status
    const isLineOpen = Boolean(liveRating.isOpen);
    ratingLineStatusIcon.textContent = isLineOpen ? '🔒' : '🔓';
    ratingLineStatusText.textContent = isLineOpen ? 'Close Rating Line' : 'Open Rating Line';
    btnToggleRatingLine.className = `btn btn-sm ${isLineOpen ? 'btn-danger' : 'btn-primary'}`;

    const currentActiveRoll = liveRating.activePerformerRoll || '';
    const activePerson = freshersRoster.find(p => p.roll_no === currentActiveRoll);

    // Update Stage status badge
    if (currentStagePerformerBadge) {
      if (activePerson) {
        currentStagePerformerBadge.textContent = `Stage: ${activePerson.name}`;
        currentStagePerformerBadge.className = 'badge badge-live';
      } else {
        currentStagePerformerBadge.textContent = 'Stage: None';
        currentStagePerformerBadge.className = 'badge';
      }
    }

    // Populate active performer select (showing PhD/MTech instead of roll number)
    const sortedRoster = [...freshersRoster].sort((a, b) => a.name.localeCompare(b.name));
    const currentDropdownValue = activePerformerSelect.value;
    const isPending = performerPendingNotice && performerPendingNotice.style.display !== 'none';

    activePerformerSelect.innerHTML = '<option value="">-- None / Select Stage Performer --</option>';

    sortedRoster.forEach(person => {
      const opt = document.createElement('option');
      opt.value = person.roll_no;
      const genderSymbol = person.gender === 'M' ? '♂ ' : person.gender === 'F' ? '♀ ' : '';
      opt.textContent = `${genderSymbol}${person.name} (${person.program || person.branch || 'Fresher'})`;
      activePerformerSelect.appendChild(opt);
    });

    // If admin had a pending unconfirmed selection, preserve it; otherwise sync to current stage active
    if (isPending && currentDropdownValue) {
      activePerformerSelect.value = currentDropdownValue;
    } else {
      activePerformerSelect.value = currentActiveRoll;
    }
    updatePerformerButtonText();

    // Scoreboard list & Reveal Button state
    renderPerformerScoreboard();
    updateRevealButtons();
  }

  function updatePerformerButtonText() {
    if (!btnConfirmPerformerSelect) return;
    const selectedRoll = activePerformerSelect ? activePerformerSelect.value : '';
    const currentActiveRoll = (appState && appState.settings && appState.settings.liveRating && appState.settings.liveRating.activePerformerRoll) || '';
    const currentStageMode = (appState && appState.settings && appState.settings.stageMode) || 'category';

    if (!selectedRoll) {
      btnConfirmPerformerSelect.textContent = '🎬 Display on Stage';
      btnConfirmPerformerSelect.disabled = true;
      btnConfirmPerformerSelect.classList.remove('btn-primary');
      btnConfirmPerformerSelect.classList.add('btn-secondary');
      if (performerPendingNotice) performerPendingNotice.style.display = 'none';
      return;
    }

    const person = freshersRoster.find(p => String(p.roll_no) === String(selectedRoll));
    const name = person ? person.name : selectedRoll;

    if (String(selectedRoll) === String(currentActiveRoll) && currentStageMode === 'live_rating') {
      btnConfirmPerformerSelect.textContent = `✓ ${name} on Stage`;
      btnConfirmPerformerSelect.disabled = true;
      btnConfirmPerformerSelect.classList.remove('btn-primary');
      btnConfirmPerformerSelect.classList.add('btn-secondary');
      if (performerPendingNotice) performerPendingNotice.style.display = 'none';
    } else {
      btnConfirmPerformerSelect.textContent = `🎬 Display ${name} on Stage`;
      btnConfirmPerformerSelect.disabled = false;
      btnConfirmPerformerSelect.classList.remove('btn-secondary');
      btnConfirmPerformerSelect.classList.add('btn-primary');
      if (performerPendingNotice) {
        performerPendingNotice.style.display = 'block';
        performerPendingNotice.innerHTML = `⚠️ <strong>Pending:</strong> "${name}" selected. Click <strong>🎬 Display ${name} on Stage</strong> to broadcast to stage projector & voter devices.`;
      }
    }
  }

  // Handle dropdown change - dynamically update button text to show selected person's name
  activePerformerSelect.addEventListener('change', () => {
    updatePerformerButtonText();
  });

  // Explicit confirmation button click (directly pushes and activates live_rating mode)
  if (btnConfirmPerformerSelect) {
    btnConfirmPerformerSelect.addEventListener('click', () => {
      const rollNo = activePerformerSelect.value;
      const person = freshersRoster.find(p => String(p.roll_no) === String(rollNo));
      const personName = person ? person.name : 'No Performer (Clear)';

      socket.send({
        type: 'set_active_performer',
        data: { rollNo: rollNo || '' }
      });
      if (rollNo) {
        socket.send({
          type: 'set_stage_mode',
          data: { mode: 'live_rating' }
        });
      }

      if (performerPendingNotice) performerPendingNotice.style.display = 'none';
      if (person) {
        btnConfirmPerformerSelect.textContent = `✓ ${person.name} on Stage`;
      } else {
        btnConfirmPerformerSelect.textContent = '🎬 Display on Stage';
      }
      btnConfirmPerformerSelect.disabled = true;
      btnConfirmPerformerSelect.classList.remove('btn-primary');
      btnConfirmPerformerSelect.classList.add('btn-secondary');

      if (rollNo) {
        showToast(`✓ "${personName}" is now active on Stage & Voter screens!`, 'gold');
      } else {
        showToast('Stage performer cleared', 'normal');
      }
    });
  }

  btnToggleRatingLine.addEventListener('click', () => {
    const liveRating = (appState && appState.settings && appState.settings.liveRating) || {};
    const nextState = !liveRating.isOpen;
    socket.send({
      type: 'set_rating_line_open',
      data: { isOpen: nextState }
    });
    showToast(nextState ? 'Rating line OPEN for live audience!' : 'Rating line CLOSED', nextState ? 'success' : 'normal');
  });

  // Mode 2 Reveals: Mr. Freshers' (Highest Male Points) & Ms. Freshers' (Highest Female Points)
  if (btnRevealMrFresher) {
    btnRevealMrFresher.addEventListener('click', () => {
      if (btnRevealMrFresher.disabled) return;
      if (confirm('👑 Trigger Stage Reveal for MR. FRESHERS\'?\n(Chooses participant with highest average points among Male candidates)')) {
        socket.send({
          type: 'trigger_performer_reveal',
          data: { gender: 'M', title: "Mr. Freshers'" }
        });
        showToast('👑 Broadcasting Mr. Freshers\' reveal countdown to stage!', 'gold');
      }
    });
  }

  if (btnRevealMsFresher) {
    btnRevealMsFresher.addEventListener('click', () => {
      if (btnRevealMsFresher.disabled) return;
      if (confirm('👑 Trigger Stage Reveal for MS. FRESHERS\'?\n(Chooses participant with highest average points among Female candidates)')) {
        socket.send({
          type: 'trigger_performer_reveal',
          data: { gender: 'F', title: "Ms. Freshers'" }
        });
        showToast('👑 Broadcasting Ms. Freshers\' reveal countdown to stage!', 'gold');
      }
    });
  }

  function updateRevealButtons() {
    if (!btnRevealMrFresher || !btnRevealMsFresher) return;

    const ratings = (appState && appState.performerRatings) || [];
    const roster = freshersRoster || (appState && appState.roster) || [];

    const maleRolls = new Set();
    const femaleRolls = new Set();

    roster.forEach(p => {
      const g = (p.gender || '').toUpperCase().trim();
      const r = String(p.roll_no || '').trim();
      if (!r) return;
      if (g === 'M') maleRolls.add(r);
      else if (g === 'F') femaleRolls.add(r);
    });

    let hasMaleRatings = false;
    let hasFemaleRatings = false;

    ratings.forEach(r => {
      const roll = String(r.rollNo || r.roll_no || '').trim();
      const score = Number(r.score) || 0;
      if (score > 0) {
        if (maleRolls.has(roll)) hasMaleRatings = true;
        if (femaleRolls.has(roll)) hasFemaleRatings = true;
      }
    });

    // Reveal Mr Freshers
    btnRevealMrFresher.disabled = !hasMaleRatings;
    if (!hasMaleRatings) {
      btnRevealMrFresher.style.opacity = '0.45';
      btnRevealMrFresher.style.cursor = 'not-allowed';
      btnRevealMrFresher.style.pointerEvents = 'none';
      btnRevealMrFresher.title = 'Disabled: All male students have 0 ratings';
    } else {
      btnRevealMrFresher.style.opacity = '1';
      btnRevealMrFresher.style.cursor = 'pointer';
      btnRevealMrFresher.style.pointerEvents = 'auto';
      btnRevealMrFresher.title = 'Reveal top-rated male fresher on stage';
    }

    // Reveal Ms Freshers
    btnRevealMsFresher.disabled = !hasFemaleRatings;
    if (!hasFemaleRatings) {
      btnRevealMsFresher.style.opacity = '0.45';
      btnRevealMsFresher.style.cursor = 'not-allowed';
      btnRevealMsFresher.style.pointerEvents = 'none';
      btnRevealMsFresher.title = 'Disabled: All female students have 0 ratings';
    } else {
      btnRevealMsFresher.style.opacity = '1';
      btnRevealMsFresher.style.cursor = 'pointer';
      btnRevealMsFresher.style.pointerEvents = 'auto';
      btnRevealMsFresher.title = 'Reveal top-rated female fresher on stage';
    }
  }

  btnResetPerformerReveal.addEventListener('click', () => {
    socket.send({ type: 'reset_performer_reveal', data: {} });
    showToast('Performer reveal dismissed on stage', 'normal');
  });

  btnClearPerformerRatings.addEventListener('click', () => {
    const rollNo = activePerformerSelect.value;
    const selectedPerson = freshersRoster.find(p => p.roll_no === rollNo);
    const msg = selectedPerson ? `Clear ratings for ${selectedPerson.name}?` : 'Clear ratings for current performer?';
    if (confirm(msg)) {
      socket.send({
        type: 'clear_performer_ratings',
        data: { rollNo: rollNo || undefined }
      });
      showToast('Ratings cleared for performer', 'error');
    }
  });

  if (btnClearAllPerformerRatings) {
    btnClearAllPerformerRatings.addEventListener('click', () => {
      // Step 1: First Confirmation
      const firstConfirm = confirm('⚠️ STEP 1 OF 2:\nAre you sure you want to clear audience ratings for ALL performers?');
      if (!firstConfirm) return;

      // Step 2: Second Confirmation
      const secondConfirm = confirm('🚨 STEP 2 OF 2 (FINAL WARNING):\nThis action CANNOT be undone! This will permanently delete all votes and ratings for EVERY performer.\n\nProceed to wipe all ratings?');
      if (!secondConfirm) return;

      socket.send({
        type: 'clear_performer_ratings',
        data: { clearAll: true }
      });
      showToast('🗑️ All performer ratings have been wiped!', 'error');
    });
  }

  function renderPerformerScoreboard() {
    const ratings = (appState && appState.performerRatings) || [];
    totalRatingsCountText.textContent = ratings.length;

    performerScoreboardList.innerHTML = '';
    updateRevealButtons();
    if (ratings.length === 0) {
      performerScoreboardList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          No live ratings submitted yet. Select a performer, confirm display, and open the rating line!
        </div>
      `;
      return;
    }

    // Group ratings by rollNo
    const performerScores = {};
    ratings.forEach(r => {
      const roll = r.rollNo;
      if (!roll) return;
      if (!performerScores[roll]) performerScores[roll] = [];
      performerScores[roll].push(Number(r.score) || 0);
    });

    const scoreboard = [];
    Object.keys(performerScores).forEach(roll => {
      const scores = performerScores[roll];
      const person = freshersRoster.find(p => p.roll_no === roll) || { name: roll, roll_no: roll };
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      scoreboard.push({
        ...person,
        avgScore: parseFloat(avg),
        ratingsCount: scores.length
      });
    });

    scoreboard.sort((a, b) => b.avgScore - a.avgScore || b.ratingsCount - a.ratingsCount);

    const activeRoll = appState.settings && appState.settings.liveRating ? appState.settings.liveRating.activePerformerRoll : null;

    scoreboard.forEach((item, idx) => {
      const isLeader = idx === 0;
      const isCurrentPerforming = activeRoll && item.roll_no === activeRoll;

      const row = document.createElement('div');
      row.className = `tally-item ${isLeader ? 'is-leader' : ''}`;
      if (isCurrentPerforming) {
        row.style.borderColor = 'rgba(99, 102, 241, 0.6)';
        row.style.background = 'rgba(99, 102, 241, 0.08)';
      }

      let avatarBg = item.avatarColor || 'var(--primary)';
      let avatarStyle = `background-color: ${avatarBg};`;
      let avatarContent = (item.name || '').split(' ').map(n => n[0]).join('').substring(0, 2);

      const universalPhoto = (appState.personPhotos && item.roll_no) ? appState.personPhotos[item.roll_no] : (item.photo || '');
      if (universalPhoto) {
        avatarStyle = `background-image: url('${universalPhoto}'); background-size: cover; background-position: center; border: 2px solid var(--accent-gold);`;
        avatarContent = '';
      }

      const programTag = item.program || item.branch || 'Fresher';
      const genderBadge = item.gender === 'M'
        ? '<span class="badge" style="background: rgba(59, 130, 246, 0.18); color: #93c5fd; font-size: 0.65rem; border: 1px solid rgba(59, 130, 246, 0.4); margin-left: 0.35rem;">♂ Mr.</span>'
        : item.gender === 'F'
        ? '<span class="badge" style="background: rgba(236, 72, 153, 0.18); color: #f472b6; font-size: 0.65rem; border: 1px solid rgba(236, 72, 153, 0.4); margin-left: 0.35rem;">♀ Ms.</span>'
        : '';

      row.innerHTML = `
        <div class="tally-avatar" style="${avatarStyle}">${avatarContent}</div>
        <div class="tally-meta">
          <div class="tally-name" style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
            <span>${item.name}</span>
            ${genderBadge}
            ${isLeader ? '<span>👑</span>' : ''}
            ${isCurrentPerforming ? '<span class="badge badge-live" style="font-size: 0.65rem;">On Stage</span>' : ''}
          </div>
          <div class="tally-sub">${programTag} &bull; ${item.ratingsCount} rating${item.ratingsCount === 1 ? '' : 's'} cast</div>
        </div>
        <div class="tally-score" style="text-align: right;">
          <div class="tally-votes ${isLeader ? 'gold-gradient' : ''}" style="font-size: 1.25rem;">
            ⭐ ${item.avgScore} <span style="font-size: 0.75rem; color: var(--text-muted);">/ 10</span>
          </div>
        </div>
      `;

      performerScoreboardList.appendChild(row);
    });
    updateRevealButtons();
  }

  // ==========================================
  // SECTION 3: UNIVERSAL PHOTO MANAGER
  // (Photos remain the same across all categories)
  // ==========================================
  // Helper to build a fresher photo card
  function createNomineePhotoCard(person, currentPhoto) {
    const card = document.createElement('div');
    card.className = 'glass-card nominee-photo-card';
    card.id = `nominee-photo-card-${person.roll_no}`;
    card.dataset.rollNo = person.roll_no;
    card.dataset.currentPhoto = currentPhoto || '';
    card.style.padding = '0.85rem 1rem';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '0.85rem';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.border = '1px solid var(--border-subtle)';

    const programLabel = person.program || person.branch || 'Fresher';
    const batchLabel = person.batch ? `&bull; ${person.batch}` : '';

    let avatarStyle = '';
    let avatarContent = '';
    if (currentPhoto) {
      avatarStyle = `background-image: url('${currentPhoto}'); background-size: cover; background-position: center; border: 2px solid var(--accent-gold);`;
    } else {
      const initials = person.name.split(' ').map(n => n[0]).join('').substring(0, 2);
      avatarStyle = `background-color: ${person.avatarColor || 'var(--primary)'};`;
      avatarContent = initials;
    }

    card.innerHTML = `
      <div class="nominee-avatar-box" style="width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; flex-shrink: 0; ${avatarStyle}">
        ${avatarContent}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">
          ${person.name}
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.35rem;">
          ${programLabel} ${batchLabel}
        </div>
        <div class="nominee-action-btns" style="display: flex; gap: 0.4rem; align-items: center;">
          <label class="btn btn-secondary btn-sm btn-upload-label" style="cursor: pointer; padding: 0.2rem 0.6rem; font-size: 0.75rem;">
            📷 <span class="upload-btn-text">${currentPhoto ? 'Replace' : 'Upload Photo'}</span>
            <input type="file" accept="image/*" class="nominee-file-input" style="display: none;">
          </label>
          ${currentPhoto ? `<button type="button" class="btn btn-danger btn-sm btn-remove-photo" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">Remove</button>` : ''}
        </div>
      </div>
    `;

    bindPhotoCardListeners(card, person);
    return card;
  }

  function bindPhotoCardListeners(card, person) {
    const fileInput = card.querySelector('.nominee-file-input');
    const uploadLabel = card.querySelector('.btn-upload-label');
    const uploadText = card.querySelector('.upload-btn-text');

    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const rawFile = fileInput.files[0];
        if (!rawFile) return;

        if (uploadLabel) uploadLabel.style.pointerEvents = 'none';
        if (uploadText) uploadText.textContent = 'Optimizing...';

        try {
          const file = await downscaleImageFile(rawFile, 800, 800, 0.85);
          if (uploadText) uploadText.textContent = 'Uploading...';

          const formData = new FormData();
          formData.append('rollNo', person.roll_no);
          formData.append('photo', file);

          const r = await fetch('/api/upload-nominee-photo', {
            method: 'POST',
            body: formData
          });
          const res = await r.json();
          if (res.success) {
            showToast(`Photo updated universally for ${person.name}!`, 'success');
            if (appState && appState.personPhotos) {
              appState.personPhotos[person.roll_no] = res.photo;
            }
            person.photo = res.photo;
            const rItem = freshersRoster.find(p => p.roll_no === person.roll_no);
            if (rItem) rItem.photo = res.photo;
            // Update in-place immediately for instant feedback
            updateNomineePhotoCard(card, person, res.photo);
          } else {
            showToast('Upload error: ' + (res.error || ''), 'error');
            if (uploadLabel) uploadLabel.style.pointerEvents = 'auto';
            if (uploadText) uploadText.textContent = person.photo ? 'Replace' : 'Upload Photo';
          }
        } catch (err) {
          showToast('Error uploading photo', 'error');
          if (uploadLabel) uploadLabel.style.pointerEvents = 'auto';
          if (uploadText) uploadText.textContent = person.photo ? 'Replace' : 'Upload Photo';
        }
        fileInput.value = '';
      });
    }

    const btnRemove = card.querySelector('.btn-remove-photo');
    if (btnRemove) {
      btnRemove.addEventListener('click', async () => {
        if (confirm(`Remove photo for ${person.name}? It will be removed from all categories.`)) {
          btnRemove.disabled = true;
          btnRemove.textContent = 'Removing...';
          try {
            const formData = new FormData();
            formData.append('rollNo', person.roll_no);
            const r = await fetch('/api/remove-nominee-photo', {
              method: 'POST',
              body: formData
            });
            const res = await r.json();
            if (res.success) {
              showToast(`Photo deleted for ${person.name}`, 'normal');
              if (appState && appState.personPhotos) {
                delete appState.personPhotos[person.roll_no];
              }
              person.photo = '';
              const rItem = freshersRoster.find(p => p.roll_no === person.roll_no);
              if (rItem) rItem.photo = '';
              if (appState && appState.candidates) {
                appState.candidates.forEach(c => {
                  if (c.roll_no === person.roll_no) c.photo = '';
                });
              }
              // Update in-place immediately
              updateNomineePhotoCard(card, person, '');
            } else {
              showToast('Error removing photo', 'error');
              btnRemove.disabled = false;
              btnRemove.textContent = 'Remove';
            }
          } catch (err) {
            showToast('Error removing photo', 'error');
            btnRemove.disabled = false;
            btnRemove.textContent = 'Remove';
          }
        }
      });
    }
  }

  function updateNomineePhotoCard(card, person, overridePhoto) {
    const currentPhoto = overridePhoto !== undefined ? overridePhoto : (
      (appState && appState.personPhotos && appState.personPhotos[person.roll_no])
        ? appState.personPhotos[person.roll_no]
        : (person.photo || '')
    );

    if (card.dataset.currentPhoto === currentPhoto) {
      return; // Already up to date, zero DOM work!
    }

    card.dataset.currentPhoto = currentPhoto;

    const avatarBox = card.querySelector('.nominee-avatar-box');
    if (avatarBox) {
      if (currentPhoto) {
        avatarBox.style.backgroundImage = `url('${currentPhoto}')`;
        avatarBox.style.backgroundColor = 'transparent';
        avatarBox.style.border = '2px solid var(--accent-gold)';
        avatarBox.textContent = '';
      } else {
        const initials = person.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        avatarBox.style.backgroundImage = 'none';
        avatarBox.style.backgroundColor = person.avatarColor || 'var(--primary)';
        avatarBox.style.border = 'none';
        avatarBox.textContent = initials;
      }
    }

    const actionContainer = card.querySelector('.nominee-action-btns');
    if (actionContainer) {
      const uploadLabel = actionContainer.querySelector('.btn-upload-label');
      const uploadText = actionContainer.querySelector('.upload-btn-text');
      if (uploadLabel) uploadLabel.style.pointerEvents = 'auto';
      if (uploadText) uploadText.textContent = currentPhoto ? 'Replace' : 'Upload Photo';

      let btnRemove = actionContainer.querySelector('.btn-remove-photo');
      if (currentPhoto) {
        if (!btnRemove) {
          btnRemove = document.createElement('button');
          btnRemove.type = 'button';
          btnRemove.className = 'btn btn-danger btn-sm btn-remove-photo';
          btnRemove.style.padding = '0.2rem 0.6rem';
          btnRemove.style.fontSize = '0.75rem';
          btnRemove.textContent = 'Remove';
          actionContainer.appendChild(btnRemove);
          bindPhotoCardListeners(card, person);
        }
      } else {
        if (btnRemove) {
          btnRemove.remove();
        }
      }
    }
  }

  let lastPhotoManagerFilter = null;

  function renderNomineePhotoManager() {
    if (!nomineePhotoManagerList) return;

    const searchTerm = (photoSearchFilter ? photoSearchFilter.value : '').toLowerCase().trim();
    const sortedRoster = [...freshersRoster].sort((a, b) => a.name.localeCompare(b.name));

    const filtered = sortedRoster.filter(person => {
      if (!searchTerm) return true;
      return person.name.toLowerCase().includes(searchTerm) ||
             (person.program || '').toLowerCase().includes(searchTerm) ||
             (person.branch || '').toLowerCase().includes(searchTerm);
    });

    if (filtered.length === 0) {
      nomineePhotoManagerList.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 1.5rem;">
          No matching fresher found for "${searchTerm}".
        </div>
      `;
      lastPhotoManagerFilter = searchTerm;
      return;
    }

    // Check if we can do an in-place update without rebuilding 25 DOM elements
    const existingCards = nomineePhotoManagerList.querySelectorAll('.nominee-photo-card');
    const sameFilter = (lastPhotoManagerFilter === searchTerm);
    const sameCount = (existingCards.length === filtered.length);

    if (sameFilter && sameCount) {
      // In-place update: zero DOM destruction, zero reflow, zero memory spike
      filtered.forEach(person => {
        const card = nomineePhotoManagerList.querySelector(`.nominee-photo-card[data-roll-no="${person.roll_no}"]`);
        if (card) {
          updateNomineePhotoCard(card, person);
        }
      });
    } else {
      // Full build only when filter or count changes
      nomineePhotoManagerList.innerHTML = '';
      lastPhotoManagerFilter = searchTerm;
      filtered.forEach(person => {
        const currentPhoto = (appState && appState.personPhotos && appState.personPhotos[person.roll_no])
          ? appState.personPhotos[person.roll_no]
          : (person.photo || '');
        const card = createNomineePhotoCard(person, currentPhoto);
        nomineePhotoManagerList.appendChild(card);
      });
    }
  }

  if (photoSearchFilter) {
    photoSearchFilter.addEventListener('input', () => {
      renderNomineePhotoManager();
    });
  }

  // ==========================================
  // MODAL: CREATE / EDIT CATEGORY & NOMINEES
  // ==========================================
  function openCreateCategoryModal() {
    editCategoryId.value = '';
    categoryModalTitle.textContent = 'Create Award Category';
    catTitleInput.value = '';
    catDescInput.value = '';
    rosterSearchInput.value = '';
    btnSaveCategorySubmit.textContent = 'Create Category & Nominees';

    renderRosterCheckboxes([]);
    categoryModal.classList.add('active');
  }

  function openEditCategoryModal(category) {
    editCategoryId.value = category.id;
    categoryModalTitle.textContent = `Edit Category: ${category.title}`;
    catTitleInput.value = category.title;
    catDescInput.value = category.description || '';
    rosterSearchInput.value = '';
    btnSaveCategorySubmit.textContent = 'Save Changes';

    // Get current nominees roll_nos
    const currentCandidates = (appState.candidates || []).filter(c => c.categoryId === category.id);
    const selectedRollNos = currentCandidates.map(c => c.roll_no).filter(Boolean);

    renderRosterCheckboxes(selectedRollNos);
    categoryModal.classList.add('active');
  }

  function renderRosterCheckboxes(preSelectedRollNos = []) {
    rosterPickerList.innerHTML = '';
    const searchTerm = (rosterSearchInput.value || '').toLowerCase().trim();

    freshersRoster.forEach(person => {
      const isMatch = !searchTerm || 
        person.name.toLowerCase().includes(searchTerm) || 
        (person.program || '').toLowerCase().includes(searchTerm) ||
        (person.branch || '').toLowerCase().includes(searchTerm);

      const isChecked = preSelectedRollNos.includes(person.roll_no);

      if (isMatch) {
        const item = document.createElement('label');
        item.className = 'roster-picker-item';
        const prog = person.program || person.branch || 'Fresher';
        const batch = person.batch ? `&bull; ${person.batch}` : '';
        item.innerHTML = `
          <input type="checkbox" value="${person.roll_no}" class="roster-chk" ${isChecked ? 'checked' : ''}>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 0.92rem; color: var(--text-main);">${person.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              ${prog} ${batch}
            </div>
          </div>
        `;

        item.querySelector('input').addEventListener('change', updateRosterSelectedCount);
        rosterPickerList.appendChild(item);
      }
    });

    updateRosterSelectedCount();
  }

  function updateRosterSelectedCount() {
    const checked = rosterPickerList.querySelectorAll('.roster-chk:checked').length;
    const total = freshersRoster.length;
    rosterSelectedCountText.textContent = `${checked} of ${total} freshers selected as nominees`;
  }

  rosterSearchInput.addEventListener('input', () => {
    const currentlyChecked = Array.from(rosterPickerList.querySelectorAll('.roster-chk:checked')).map(cb => cb.value);
    renderRosterCheckboxes(currentlyChecked);
  });

  btnSelectAllNominees.addEventListener('click', () => {
    rosterPickerList.querySelectorAll('.roster-chk').forEach(cb => cb.checked = true);
    updateRosterSelectedCount();
  });

  btnDeselectAllNominees.addEventListener('click', () => {
    rosterPickerList.querySelectorAll('.roster-chk').forEach(cb => cb.checked = false);
    updateRosterSelectedCount();
  });

  if (btnOpenAddCategoryModal) btnOpenAddCategoryModal.addEventListener('click', openCreateCategoryModal);
  if (btnCreateCategoryHeader) btnCreateCategoryHeader.addEventListener('click', openCreateCategoryModal);

  function closeCategoryModal() {
    categoryModal.classList.remove('active');
  }

  btnCloseCategoryModal.addEventListener('click', closeCategoryModal);
  btnCancelCategoryModal.addEventListener('click', closeCategoryModal);

  categoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = catTitleInput.value.trim();
    const desc = catDescInput.value.trim();
    const editingId = editCategoryId.value;

    const selectedRollNos = Array.from(rosterPickerList.querySelectorAll('.roster-chk:checked')).map(cb => cb.value);

    if (!title) {
      showToast('Please enter a category title', 'error');
      return;
    }

    if (selectedRollNos.length === 0) {
      if (!confirm('No nominees were selected for this category. Save anyway?')) {
        return;
      }
    }

    if (editingId) {
      // Update existing category (title, description, and nominees)
      socket.send({
        type: 'update_category',
        data: {
          categoryId: editingId,
          title,
          badge: '',
          description: desc,
          selectedRollNos: selectedRollNos,
          selectAll: selectedRollNos.length === freshersRoster.length
        }
      });
      showToast(`Updated "${title}"!`, 'success');
    } else {
      // Create new category
      socket.send({
        type: 'add_category',
        data: {
          title,
          badge: '',
          description: desc,
          selectedRollNos: selectedRollNos,
          selectAll: selectedRollNos.length === freshersRoster.length
        }
      });
      showToast(`Category "${title}" created with ${selectedRollNos.length} nominees!`, 'success');
    }

    closeCategoryModal();
  });

  // ==========================================
  // STAGE INTERMISSION & TASKS (Non-Voting Screens)
  // ==========================================
  const btnShowLatentTitle = document.getElementById('btnShowLatentTitle');
  const btnShowTaskOnStage = document.getElementById('btnShowTaskOnStage');
  const taskSelectDropdown = document.getElementById('taskSelectDropdown');
  const btnDeleteSelectedTask = document.getElementById('btnDeleteSelectedTask');
  const formAddTask = document.getElementById('formAddTask');
  const inputNewTaskTitle = document.getElementById('inputNewTaskTitle');
  const inputUploadStageImg = document.getElementById('inputUploadStageImg');
  const btnRemoveStageImg = document.getElementById('btnRemoveStageImg');
  const stageCustomImgPreviewWrap = document.getElementById('stageCustomImgPreviewWrap');
  const stageCustomImgThumb = document.getElementById('stageCustomImgThumb');
  const stageImgStatusBadge = document.getElementById('stageImgStatusBadge');
  const stageImgFileName = document.getElementById('stageImgFileName');

  const btnConfirmTaskSelect = document.getElementById('btnConfirmTaskSelect');
  const taskPendingNotice = document.getElementById('taskPendingNotice');
  const currentStageTaskBadge = document.getElementById('currentStageTaskBadge');

  function updateTaskButtonText() {
    const tasks = (appState && appState.tasks) || [];
    const selectedTaskId = taskSelectDropdown ? taskSelectDropdown.value : '';
    const currentActiveTaskId = (appState && appState.settings && appState.settings.activeTaskId) || '';
    const currentStageMode = (appState && appState.settings && appState.settings.stageMode) || 'category';

    const selectedTask = tasks.find(t => String(t.id) === String(selectedTaskId));
    const activeTask = tasks.find(t => String(t.id) === String(currentActiveTaskId));

    if (currentStageTaskBadge) {
      if (currentStageMode === 'task' && activeTask) {
        currentStageTaskBadge.textContent = `Stage: ${activeTask.title}`;
        currentStageTaskBadge.className = 'badge badge-live';
      } else {
        currentStageTaskBadge.textContent = currentStageMode === 'task' ? 'Stage: Task Active' : 'Stage: Not Active';
        currentStageTaskBadge.className = 'badge';
      }
    }

    if (!selectedTaskId || tasks.length === 0) {
      if (btnConfirmTaskSelect) {
        btnConfirmTaskSelect.textContent = '🎬 Display Task on Stage';
        btnConfirmTaskSelect.disabled = true;
        btnConfirmTaskSelect.classList.remove('btn-primary');
        btnConfirmTaskSelect.classList.add('btn-secondary');
      }
      if (btnShowTaskOnStage) {
        btnShowTaskOnStage.textContent = '🎬 Display Task on Stage (White Font)';
        btnShowTaskOnStage.disabled = true;
        btnShowTaskOnStage.className = 'btn btn-secondary btn-lg';
      }
      if (taskPendingNotice) taskPendingNotice.style.display = 'none';
      return;
    }

    const taskTitle = selectedTask ? selectedTask.title : 'Task';

    // If this task is ALREADY active on stage AND stage is currently in 'task' mode:
    if (String(selectedTaskId) === String(currentActiveTaskId) && currentStageMode === 'task') {
      if (btnConfirmTaskSelect) {
        btnConfirmTaskSelect.textContent = `✓ "${taskTitle}" on Stage`;
        btnConfirmTaskSelect.disabled = true;
        btnConfirmTaskSelect.classList.remove('btn-primary');
        btnConfirmTaskSelect.classList.add('btn-secondary');
      }
      if (btnShowTaskOnStage) {
        btnShowTaskOnStage.textContent = `✓ "${taskTitle}" is Live on Stage`;
        btnShowTaskOnStage.disabled = true;
        btnShowTaskOnStage.className = 'btn btn-secondary btn-lg';
      }
      if (taskPendingNotice) taskPendingNotice.style.display = 'none';
    } else {
      // Different task selected, or stage not in task mode yet:
      if (btnConfirmTaskSelect) {
        btnConfirmTaskSelect.textContent = `🎬 Display "${taskTitle}" on Stage`;
        btnConfirmTaskSelect.disabled = false;
        btnConfirmTaskSelect.classList.remove('btn-secondary');
        btnConfirmTaskSelect.classList.add('btn-primary');
      }
      if (btnShowTaskOnStage) {
        btnShowTaskOnStage.textContent = `🎬 Display "${taskTitle}" on Stage`;
        btnShowTaskOnStage.disabled = false;
        btnShowTaskOnStage.className = 'btn btn-primary btn-lg';
      }
      if (taskPendingNotice) {
        taskPendingNotice.style.display = 'block';
        taskPendingNotice.innerHTML = `⚠️ <strong>Pending:</strong> "${taskTitle}" selected. Click <strong>🎬 Display "${taskTitle}" on Stage</strong> to switch on projector.`;
      }
    }
  }

  function renderIntermissionTasksUI() {
    if (!appState) return;

    // 1. Presentation Image / Title Screen UI state
    const stageCustomImg = appState.settings && appState.settings.stageCustomImage;
    if (stageCustomImgPreviewWrap && stageCustomImgThumb && stageImgStatusBadge) {
      if (stageCustomImg) {
        stageCustomImgPreviewWrap.style.display = 'flex';
        stageCustomImgThumb.src = stageCustomImg;
        stageImgStatusBadge.textContent = 'Custom Image Uploaded';
        stageImgStatusBadge.className = 'badge badge-gold';
        if (stageImgFileName) stageImgFileName.textContent = 'Active on Stage';
      } else {
        stageCustomImgPreviewWrap.style.display = 'none';
        stageImgStatusBadge.textContent = 'Vector Title Active';
        stageImgStatusBadge.className = 'badge';
        if (stageImgFileName) stageImgFileName.textContent = 'JPG/PNG/WEBP';
      }
    }

    // 2. Tasks Dropdown & List
    const tasks = appState.tasks || [];
    const activeTaskId = (appState.settings && appState.settings.activeTaskId) || (tasks[0] ? tasks[0].id : null);

    // Populate taskSelectDropdown
    if (taskSelectDropdown) {
      const prevVal = taskSelectDropdown.value;
      taskSelectDropdown.innerHTML = '';
      if (tasks.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '-- No tasks added yet (Use form below) --';
        taskSelectDropdown.appendChild(opt);
      } else {
        const targetSelected = prevVal && tasks.some(t => String(t.id) === String(prevVal)) 
          ? prevVal 
          : (activeTaskId || tasks[0].id);

        tasks.forEach(task => {
          const opt = document.createElement('option');
          opt.value = task.id;
          opt.textContent = task.title;
          if (String(task.id) === String(targetSelected)) {
            opt.selected = true;
          }
          taskSelectDropdown.appendChild(opt);
        });
      }
    }

    updateTaskButtonText();

    // Populate adminTasksList
    if (adminTasksList) {
      adminTasksList.innerHTML = '';
      if (tasks.length === 0) {
        adminTasksList.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted);">No tasks in list. Add your first challenge above!</span>';
      } else {
        tasks.forEach(task => {
          const pill = document.createElement('div');
          pill.className = 'badge';
          pill.style.cssText = 'background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); display: inline-flex; align-items: center; gap: 0.55rem; padding: 0.35rem 0.8rem; font-size: 0.85rem; border-radius: var(--radius-full);';
          pill.innerHTML = `
            <span>🎯 ${task.title}</span>
            <button type="button" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.9rem; padding: 0; line-height: 1; display: inline-flex; align-items: center;" title="Delete task" onclick="window.deleteTaskById('${task.id}')">✕</button>
          `;
          adminTasksList.appendChild(pill);
        });
      }
    }
  }

  // Upload custom stage presentation image
  if (inputUploadStageImg) {
    inputUploadStageImg.addEventListener('change', async (e) => {
      const rawFile = e.target.files && e.target.files[0];
      if (!rawFile) return;

      showToast('Optimizing & uploading stage presentation image...', 'normal');
      try {
        const file = await downscaleImageFile(rawFile, 1920, 1080, 0.85);
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/upload-stage-image', {
          method: 'POST',
          body: formData
        });
        const result = await res.json();
        if (result.success) {
          showToast('✓ Presentation image uploaded! Ready to display on stage.', 'success');
        } else {
          showToast('Upload failed: ' + (result.error || 'Server error'), 'error');
        }
      } catch (err) {
        showToast('Upload error: ' + err.message, 'error');
      }
      inputUploadStageImg.value = '';
    });
  }

  // Remove custom stage image
  if (btnRemoveStageImg) {
    btnRemoveStageImg.addEventListener('click', async () => {
      if (!confirm('Remove presentation image and return to FRESHERS\' GOT LATENT vector title?')) return;
      try {
        const res = await fetch('/api/remove-stage-image', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          showToast('Presentation image removed. Title banner restored.', 'normal');
        }
      } catch (err) {
        showToast('Remove error: ' + err.message, 'error');
      }
    });
  }

  window.deleteTaskById = function(taskId) {
    if (!taskId) return;
    if (confirm('Delete this task from list?')) {
      socket.send({
        type: 'delete_task',
        data: { taskId: taskId }
      });
      showToast('Task removed', 'normal');
    }
  };

  if (btnShowLatentTitle) {
    btnShowLatentTitle.addEventListener('click', () => {
      socket.send({
        type: 'set_stage_mode',
        data: { mode: 'latent_title' }
      });
      const hasImg = appState && appState.settings && appState.settings.stageCustomImage;
      showToast(hasImg ? '🎬 Presentation Image is now Live on the Stage Projector!' : '🎬 FRESHERS\' GOT LATENT is now Live on the Stage Projector!', 'gold');
    });
  }

  function pushSelectedTaskToStage() {
    const tasks = (appState && appState.tasks) || [];
    let taskId = taskSelectDropdown ? taskSelectDropdown.value : null;
    if (!taskId && tasks.length > 0) {
      taskId = tasks[0].id;
    }
    if (!taskId) {
      showToast('Please add a task below first!', 'error');
      return;
    }
    const selectedTask = tasks.find(t => String(t.id) === String(taskId)) || tasks[0];
    const taskTitle = selectedTask ? selectedTask.title : 'Task';

    socket.send({
      type: 'set_active_task',
      data: { taskId: taskId }
    });
    socket.send({
      type: 'set_stage_mode',
      data: { mode: 'task', taskId: taskId }
    });

    if (taskPendingNotice) taskPendingNotice.style.display = 'none';
    if (btnConfirmTaskSelect) {
      btnConfirmTaskSelect.textContent = `✓ "${taskTitle}" on Stage`;
      btnConfirmTaskSelect.disabled = true;
      btnConfirmTaskSelect.classList.remove('btn-primary');
      btnConfirmTaskSelect.classList.add('btn-secondary');
    }
    if (btnShowTaskOnStage) {
      btnShowTaskOnStage.textContent = `✓ "${taskTitle}" is Live on Stage`;
      btnShowTaskOnStage.disabled = true;
      btnShowTaskOnStage.className = 'btn btn-secondary btn-lg';
    }

    showToast(`✓ "${taskTitle}" is now live on the Stage Projector!`, 'success');
  }

  if (btnConfirmTaskSelect) {
    btnConfirmTaskSelect.addEventListener('click', pushSelectedTaskToStage);
  }
  if (btnShowTaskOnStage) {
    btnShowTaskOnStage.addEventListener('click', pushSelectedTaskToStage);
  }

  if (taskSelectDropdown) {
    taskSelectDropdown.addEventListener('change', () => {
      updateTaskButtonText();
    });
  }

  if (btnDeleteSelectedTask) {
    btnDeleteSelectedTask.addEventListener('click', () => {
      const taskId = taskSelectDropdown ? taskSelectDropdown.value : null;
      if (!taskId) {
        showToast('No task selected to delete', 'normal');
        return;
      }
      window.deleteTaskById(taskId);
    });
  }

  if (formAddTask) {
    formAddTask.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputNewTaskTitle ? inputNewTaskTitle.value.trim() : '';
      if (!val) {
        showToast('Please enter a task name', 'error');
        return;
      }
      socket.send({
        type: 'add_task',
        data: { title: val }
      });
      if (inputNewTaskTitle) inputNewTaskTitle.value = '';
      showToast(`Task "${val}" added!`, 'success');
    });
  }

  updateQrUI(false);
})();
