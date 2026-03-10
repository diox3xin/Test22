/**
 * Emotion Canvas — SillyTavern Extension
 * v1.0.0
 *
 * Визуализирует эмоции персонажа через динамические частицы,
 * градиентный фон и цветовые темы в реальном времени.
 */

(() => {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────────

  const MODULE_KEY = 'emotion_canvas';

  const EMOTIONS = Object.freeze({
    joy: {
      label: 'Радость',
      icon: '✨',
      color1: '#FFD700',
      color2: '#FF8C00',
      color3: '#FFF176',
      keywords: [
        'рад', 'счастлив', 'смеёт', 'смех', 'улыбка', 'весел', 'ура', 'отлично',
        'восхит', 'joy', 'happy', 'laugh', 'smile', 'great', 'wonderful', 'excited',
        'yay', 'awesome', 'fantastic', 'delight', 'gleeful', 'haha', 'hehe',
      ],
    },
    love: {
      label: 'Любовь',
      icon: '💕',
      color1: '#E91E8C',
      color2: '#9B0050',
      color3: '#FF6BB5',
      keywords: [
        'люблю', 'любовь', 'нежн', 'тепло', 'обним', 'поцел', 'сердце', 'дорог',
        'love', 'heart', 'darling', 'dear', 'tender', 'kiss', 'hug', 'adore',
        'cherish', 'affection', 'romantic', 'sweetheart', 'honey', 'blush',
      ],
    },
    sadness: {
      label: 'Грусть',
      icon: '🌧️',
      color1: '#4A90D9',
      color2: '#1B3A5C',
      color3: '#6B8CBE',
      keywords: [
        'грустно', 'плачу', 'слезы', 'печаль', 'тоска', 'одиноко', 'потерял',
        'sad', 'cry', 'tears', 'sorrow', 'lonely', 'grief', 'miss', 'mourn',
        'depressed', 'hurt', 'pain', 'lost', 'hopeless', 'disappointed',
      ],
    },
    anger: {
      label: 'Гнев',
      icon: '🔥',
      color1: '#E53935',
      color2: '#7B0000',
      color3: '#FF7043',
      keywords: [
        'злюсь', 'ненавиж', 'бесит', 'раздража', 'ярость', 'гнев', 'злой',
        'angry', 'rage', 'furious', 'hate', 'annoyed', 'mad', 'frustrated',
        'outraged', 'livid', 'infuriated', 'disgusted',
      ],
    },
    fear: {
      label: 'Страх',
      icon: '🌑',
      color1: '#8E24AA',
      color2: '#1A0533',
      color3: '#BA68C8',
      keywords: [
        'боюсь', 'страшно', 'ужас', 'дрожу', 'пугает', 'тревожно', 'опасно',
        'fear', 'scared', 'horror', 'terrified', 'dread', 'panic', 'anxiety',
        'tremble', 'nightmare', 'afraid', 'worried', 'nervous',
      ],
    },
    wonder: {
      label: 'Удивление',
      icon: '🌊',
      color1: '#00BCD4',
      color2: '#006978',
      color3: '#4DD0E1',
      keywords: [
        'удивлен', 'невероятно', 'изумлен', 'поражен', 'интересно', 'загадочно',
        'wonder', 'amazed', 'incredible', 'astonishing', 'mysterious', 'curious',
        'fascinating', 'unbelievable', 'strange', 'wow',
      ],
    },
    neutral: {
      label: 'Спокойствие',
      icon: '🌿',
      color1: '#546E7A',
      color2: '#263238',
      color3: '#78909C',
      keywords: [],
    },
  });

  const defaultSettings = Object.freeze({
    enabled: true,
    showWidget: true,
    particles: true,
    gradient: true,
    cinematic: false,
    particleCount: 18,
    collapsed: false,
  });

  // ─── Runtime state ────────────────────────────────────────────────────────────

  let currentEmotion = 'neutral';
  let emotionHistory = [];

  // ─── ST Context ───────────────────────────────────────────────────────────────

  function ctx() { return SillyTavern.getContext(); }

  function getSettings() {
    const { extensionSettings } = ctx();
    if (!extensionSettings[MODULE_KEY])
      extensionSettings[MODULE_KEY] = structuredClone(defaultSettings);
    for (const k of Object.keys(defaultSettings))
      if (!Object.hasOwn(extensionSettings[MODULE_KEY], k))
        extensionSettings[MODULE_KEY][k] = defaultSettings[k];
    return extensionSettings[MODULE_KEY];
  }

  // ─── Emotion Detection ────────────────────────────────────────────────────────

  function detectEmotion(text) {
    const lower = (text || '').toLowerCase();
    let best = 'neutral';
    let bestScore = 0;

    for (const [emotion, def] of Object.entries(EMOTIONS)) {
      if (emotion === 'neutral') continue;
      let score = 0;
      for (const kw of def.keywords) {
        if (lower.includes(kw)) score += kw.length > 5 ? 2 : 1;
      }
      if (score > bestScore) { bestScore = score; best = emotion; }
    }

    const intensity = bestScore === 0
      ? 0.25
      : Math.min(0.3 + bestScore * 0.12, 1.0);

    return { emotion: best, intensity };
  }

  // ─── Apply Emotion ────────────────────────────────────────────────────────────

  function applyEmotion(emotion, intensity) {
    const def = EMOTIONS[emotion] || EMOTIONS.neutral;
    currentEmotion = emotion;

    emotionHistory.push({ emotion, intensity, ts: Date.now() });
    if (emotionHistory.length > 24) emotionHistory.shift();

    // CSS vars on root
    const root = document.documentElement;
    root.style.setProperty('--ec-c1', def.color1);
    root.style.setProperty('--ec-c2', def.color2);
    root.style.setProperty('--ec-c3', def.color3);

    // Gradient layer
    const gl = document.getElementById('ec-gradient');
    if (gl) {
      gl.style.opacity = getSettings().gradient ? String(0.12 + intensity * 0.08) : '0';
    }

    // Update FAB badge
    updateFabBadge(def, intensity);

    // Update drawer if open
    if (document.getElementById('ec-drawer')?.classList.contains('ec-open')) {
      renderDrawerContent();
    }

    // Particles
    if (getSettings().particles) burstParticles(emotion, intensity);
  }

  // ─── Particles ────────────────────────────────────────────────────────────────

  function randBetween(a, b) { return Math.random() * (b - a) + a; }

  function spawnParticle(emotion) {
    const container = document.getElementById('ec-particles');
    if (!container) return;

    const p = document.createElement('div');
    p.className = `ec-p ec-p-${emotion}`;

    const size = emotion === 'sadness'
      ? `width:2px;height:${randBetween(10, 22)}px`
      : `width:${randBetween(5, 13)}px;height:${randBetween(5, 13)}px`;

    const bottom = emotion === 'sadness' ? '100%' : `${randBetween(0, 25)}%`;
    const dur = randBetween(2.5, 6.5).toFixed(2);
    const dx = randBetween(-70, 70).toFixed(0);

    p.style.cssText = `${size};left:${randBetween(0,100).toFixed(1)}%;bottom:${bottom};--dur:${dur}s;--dx:${dx}px`;

    if (emotion === 'love') p.innerHTML = '♥';

    container.appendChild(p);
    setTimeout(() => p.remove(), 8000);
  }

  function burstParticles(emotion, intensity) {
    const s = getSettings();
    const count = Math.round(s.particleCount * intensity);
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnParticle(emotion), i * 55);
    }
  }

  // ─── DOM: Background layers ───────────────────────────────────────────────────

  function ensureLayers() {
    if (document.getElementById('ec-gradient')) return;

    document.body.insertAdjacentHTML('afterbegin', `
      <div id="ec-gradient"></div>
      <div id="ec-particles"></div>
    `);
  }

  // ─── FAB ──────────────────────────────────────────────────────────────────────

  function ensureFab() {
    if (document.getElementById('ec-fab')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="ec-fab">
        <button type="button" id="ec-fab-btn" title="Emotion Canvas">
          <span id="ec-fab-icon">🌿</span>
          <span id="ec-fab-label">Спокойствие</span>
        </button>
      </div>
    `);
    document.getElementById('ec-fab-btn').addEventListener('click', () => openDrawer(true));
  }

  function updateFabBadge(def, intensity) {
    const icon  = document.getElementById('ec-fab-icon');
    const label = document.getElementById('ec-fab-label');
    const fab   = document.getElementById('ec-fab-btn');
    if (!icon || !label) return;

    icon.textContent  = def.icon;
    label.textContent = def.label;

    if (fab) {
      fab.style.setProperty('--fab-c1', def.color1);
      fab.style.setProperty('--fab-c2', def.color2);
      fab.style.setProperty('--fab-glow', intensity > 0.5 ? def.color1 : 'transparent');
    }
  }

  // ─── Drawer ───────────────────────────────────────────────────────────────────

  function ensureDrawer() {
    if (document.getElementById('ec-drawer')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="ec-overlay"></div>
      <aside id="ec-drawer" aria-hidden="true">
        <header>
          <div class="ec-topline">
            <div class="ec-title">🎨 EMOTION CANVAS</div>
            <button type="button" id="ec-close">✕</button>
          </div>
          <div class="ec-subtitle" id="ec-subtitle">Слежу за настроением персонажа…</div>
        </header>

        <div id="ec-drawer-content"></div>

        <div class="ec-footer">
          <button type="button" id="ec-btn-particles">✨ Частицы</button>
          <button type="button" id="ec-btn-gradient">🌈 Фон</button>
          <button type="button" id="ec-btn-cinema">🎬 Cinema</button>
          <button type="button" id="ec-btn-reset">↺ Сброс истории</button>
          <button type="button" id="ec-close2">Закрыть</button>
        </div>
      </aside>
    `);

    document.getElementById('ec-close').addEventListener('click',   () => openDrawer(false), true);
    document.getElementById('ec-close2').addEventListener('click',  () => openDrawer(false), true);
    document.getElementById('ec-overlay').addEventListener('click', () => openDrawer(false), true);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('ec-drawer')?.classList.contains('ec-open'))
        openDrawer(false);
    });

    // Footer buttons
    $(document)
      .off('click.ec_btns')
      .on('click.ec_btns', '#ec-btn-particles', toggleParticles)
      .on('click.ec_btns', '#ec-btn-gradient',  toggleGradient)
      .on('click.ec_btns', '#ec-btn-cinema',    toggleCinematic)
      .on('click.ec_btns', '#ec-btn-reset',     resetHistory);
  }

  function openDrawer(open) {
    ensureDrawer();
    const drawer  = document.getElementById('ec-drawer');
    const overlay = document.getElementById('ec-overlay');
    if (!drawer) return;

    if (open) {
      drawer.classList.add('ec-open');
      drawer.setAttribute('aria-hidden', 'false');
      if (overlay) overlay.style.display = 'block';
      renderDrawerContent();
      syncDrawerButtons();
    } else {
      drawer.classList.remove('ec-open');
      drawer.setAttribute('aria-hidden', 'true');
      if (overlay) overlay.style.display = 'none';
    }
  }

  function syncDrawerButtons() {
    const s = getSettings();
    $('#ec-btn-particles').toggleClass('ec-btn-active', s.particles);
    $('#ec-btn-gradient').toggleClass('ec-btn-active', s.gradient);
    $('#ec-btn-cinema').toggleClass('ec-btn-active', s.cinematic);
  }

  function renderDrawerContent() {
    const def = EMOTIONS[currentEmotion] || EMOTIONS.neutral;

    // Build history bars
    const bars = emotionHistory.map(e => {
      const d = EMOTIONS[e.emotion] || EMOTIONS.neutral;
      const h = Math.max(4, Math.round(e.intensity * 40));
      return `<div class="ec-bar" style="height:${h}px;background:linear-gradient(to top,${d.color2},${d.color1})" title="${d.label} ${Math.round(e.intensity*100)}%"></div>`;
    }).join('');

    // Emotion grid
    const grid = Object.entries(EMOTIONS).map(([key, d]) => `
      <button class="ec-emo-btn${currentEmotion === key ? ' ec-emo-active' : ''}" data-emotion="${key}">
        <span class="ec-emo-icon">${d.icon}</span>
        <span class="ec-emo-name">${d.label}</span>
      </button>
    `).join('');

    const intensity = emotionHistory.length
      ? emotionHistory[emotionHistory.length - 1].intensity
      : 0.3;

    document.getElementById('ec-drawer-content').innerHTML = `
      <div class="ec-section">
        <div class="ec-section-label">Текущее настроение</div>
        <div class="ec-current-block">
          <div class="ec-big-icon" style="filter:drop-shadow(0 0 12px ${def.color1})">${def.icon}</div>
          <div class="ec-current-info">
            <div class="ec-current-name" style="color:${def.color1}">${def.label}</div>
            <div class="ec-intensity-bar">
              <div class="ec-intensity-fill" style="width:${Math.round(intensity*100)}%;background:linear-gradient(90deg,${def.color2},${def.color1})"></div>
            </div>
            <div class="ec-intensity-label">${Math.round(intensity*100)}% интенсивность</div>
          </div>
        </div>
      </div>

      <div class="ec-section">
        <div class="ec-section-label">История настроений</div>
        <div class="ec-history-chart" id="ec-history">
          ${bars || '<div class="ec-no-history">Сообщений пока нет</div>'}
        </div>
      </div>

      <div class="ec-section">
        <div class="ec-section-label">Принудить эмоцию</div>
        <div class="ec-emo-grid">${grid}</div>
      </div>
    `;

    // Manual emotion trigger
    $(document).off('click.ec_emo').on('click.ec_emo', '.ec-emo-btn', function () {
      const emo = this.getAttribute('data-emotion');
      if (emo) applyEmotion(emo, 0.7);
      renderDrawerContent();
      syncDrawerButtons();
    });
  }

  // ─── Footer button actions ────────────────────────────────────────────────────

  function toggleParticles() {
    const s = getSettings();
    s.particles = !s.particles;
    ctx().saveSettingsDebounced();
    syncDrawerButtons();
    toastr.info(`Частицы: ${s.particles ? 'вкл' : 'выкл'}`, 'Emotion Canvas', { timeOut: 1500 });
  }

  function toggleGradient() {
    const s = getSettings();
    s.gradient = !s.gradient;
    ctx().saveSettingsDebounced();
    const gl = document.getElementById('ec-gradient');
    if (gl) gl.style.opacity = s.gradient ? '0.14' : '0';
    syncDrawerButtons();
    toastr.info(`Фон: ${s.gradient ? 'вкл' : 'выкл'}`, 'Emotion Canvas', { timeOut: 1500 });
  }

  function toggleCinematic() {
    const s = getSettings();
    s.cinematic = !s.cinematic;
    ctx().saveSettingsDebounced();
    document.body.classList.toggle('ec-cinematic', s.cinematic);
    syncDrawerButtons();
    toastr.info(`Cinematic: ${s.cinematic ? 'вкл' : 'выкл'}`, 'Emotion Canvas', { timeOut: 1500 });
  }

  function resetHistory() {
    emotionHistory = [];
    currentEmotion = 'neutral';
    applyEmotion('neutral', 0.25);
    toastr.success('История сброшена', 'Emotion Canvas', { timeOut: 2000 });
    if (document.getElementById('ec-drawer')?.classList.contains('ec-open'))
      renderDrawerContent();
  }

  // ─── Settings panel ───────────────────────────────────────────────────────────

  async function mountSettingsUi() {
    if ($('#ec-settings-block').length) return;

    const target = $('#extensions_settings2').length ? '#extensions_settings2' : '#extensions_settings';
    if (!$(target).length) { console.warn('[EC] settings container not found'); return; }

    const s = getSettings();

    $(target).append(`
      <div id="ec-settings-block">
        <div class="ec-set-title">
          <span>🎨 Emotion Canvas</span>
          <button type="button" id="ec-set-collapse">${s.collapsed ? '▸' : '▾'}</button>
        </div>
        <div class="ec-set-body"${s.collapsed ? ' style="display:none"' : ''}>

          <div class="ec-set-2col">
            <label class="ec-ck">
              <input type="checkbox" id="ec-set-enabled" ${s.enabled ? 'checked' : ''}>
              <span>Включено</span>
            </label>
            <label class="ec-ck">
              <input type="checkbox" id="ec-set-widget" ${s.showWidget ? 'checked' : ''}>
              <span>Виджет 🎨</span>
            </label>
            <label class="ec-ck">
              <input type="checkbox" id="ec-set-particles" ${s.particles ? 'checked' : ''}>
              <span>Частицы</span>
            </label>
            <label class="ec-ck">
              <input type="checkbox" id="ec-set-gradient" ${s.gradient ? 'checked' : ''}>
              <span>Фон-градиент</span>
            </label>
            <label class="ec-ck">
              <input type="checkbox" id="ec-set-cinematic" ${s.cinematic ? 'checked' : ''}>
              <span>Cinematic</span>
            </label>
          </div>

          <div class="ec-set-row">
            <label>Частиц за раз:</label>
            <input type="range" id="ec-set-count" min="5" max="40" step="1" value="${s.particleCount}">
            <span id="ec-set-count-val">${s.particleCount}</span>
          </div>

          <div class="ec-set-btns">
            <button class="menu_button" id="ec-open-drawer-btn">🎨 Открыть трекер</button>
          </div>

        </div>
      </div>
    `);

    // Collapse toggle
    $('#ec-set-collapse').on('click', () => {
      const s = getSettings();
      s.collapsed = !s.collapsed;
      $('#ec-set-body, .ec-set-body').toggle(!s.collapsed);
      $('#ec-set-collapse').text(s.collapsed ? '▸' : '▾');
      ctx().saveSettingsDebounced();
    });

    // Checkboxes
    $('#ec-set-enabled').on('input', ev => {
      const s = getSettings();
      s.enabled = $(ev.currentTarget).prop('checked');
      $('#ec-fab').toggle(s.enabled && s.showWidget);
      ctx().saveSettingsDebounced();
    });

    $('#ec-set-widget').on('input', ev => {
      const s = getSettings();
      s.showWidget = $(ev.currentTarget).prop('checked');
      $('#ec-fab').toggle(s.enabled && s.showWidget);
      ctx().saveSettingsDebounced();
    });

    $('#ec-set-particles').on('input', ev => {
      getSettings().particles = $(ev.currentTarget).prop('checked');
      ctx().saveSettingsDebounced();
    });

    $('#ec-set-gradient').on('input', ev => {
      const s = getSettings();
      s.gradient = $(ev.currentTarget).prop('checked');
      const gl = document.getElementById('ec-gradient');
      if (gl) gl.style.opacity = s.gradient ? '0.14' : '0';
      ctx().saveSettingsDebounced();
    });

    $('#ec-set-cinematic').on('input', ev => {
      const s = getSettings();
      s.cinematic = $(ev.currentTarget).prop('checked');
      document.body.classList.toggle('ec-cinematic', s.cinematic);
      ctx().saveSettingsDebounced();
    });

    // Particle count slider
    $('#ec-set-count').on('input', ev => {
      const v = parseInt($(ev.currentTarget).val());
      getSettings().particleCount = v;
      $('#ec-set-count-val').text(v);
      ctx().saveSettingsDebounced();
    });

    // Open drawer
    $('#ec-open-drawer-btn').on('click', () => openDrawer(true));
  }

  // ─── Wire chat events ─────────────────────────────────────────────────────────

  function wireChatEvents() {
    const { eventSource, event_types } = ctx();

    eventSource.on(event_types.APP_READY, async () => {
      ensureLayers();
      ensureFab();
      ensureDrawer();
      await mountSettingsUi();

      const s = getSettings();
      if (!s.enabled || !s.showWidget) $('#ec-fab').hide();
      if (s.cinematic) document.body.classList.add('ec-cinematic');
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
      emotionHistory = [];
      currentEmotion = 'neutral';
      applyEmotion('neutral', 0.25);
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, (idx) => {
      const s = getSettings();
      if (!s.enabled) return;

      const { chat } = ctx();
      const msg = chat?.[idx];
      if (!msg || msg.is_user) return;

      const result = detectEmotion(msg.mes || '');
      applyEmotion(result.emotion, result.intensity);
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────

  jQuery(() => {
    try {
      wireChatEvents();
      console.log('[EmotionCanvas] v1.0.0 loaded');
    } catch (e) {
      console.error('[EmotionCanvas] init failed', e);
    }
  });

})();
