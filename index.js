/**
 * ╔═══════════════════════════════════════════╗
 * ║       EMOTION CANVAS v1.0.0               ║
 * ║   SillyTavern Extension                   ║
 * ║   Real-time emotional atmosphere          ║
 * ╚═══════════════════════════════════════════╝
 */

import {
  eventSource,
  event_types,
  saveSettingsDebounced,
} from '../../../../script.js';

import { getContext } from '../../../extensions.js';
import { extension_settings } from '../../../extensions.js';

// ── Extension Name ──────────────────────────
const EXT_NAME = 'emotion-canvas';

// ── Default Settings ────────────────────────
const DEFAULT_SETTINGS = {
  enabled: true,
  cinematic: false,
  locked: false,
  lockedEmotion: null,
  particleCount: 18,
  showPanel: false,
};

// ── Emotion Definitions ─────────────────────
const EMOTIONS = {
  joy: {
    label: 'Радость',
    icon: '✨',
    color1: '#FFD700',
    color2: '#FF8C00',
    color3: '#FFA500',
    keywords: [
      'рад', 'счастлив', 'смеёт', 'смех', 'улыбка', 'весел', 'ура', 'отлично',
      'восхит', 'joy', 'happy', 'laugh', 'smile', 'great', 'wonderful', 'excited',
      'yay', 'awesome', 'fantastic', 'delight', 'gleeful', 'haha', 'hehe', 'xd',
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
      'love', 'heart', 'darling', 'dear', 'tender', 'kiss', 'hug', 'adore', 'cherish',
      'affection', 'romantic', 'sweetheart', 'honey', 'blush',
    ],
  },
  sadness: {
    label: 'Грусть',
    icon: '🌧️',
    color1: '#4A6FA5',
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
    color1: '#C0392B',
    color2: '#7B0000',
    color3: '#E74C3C',
    keywords: [
      'злюсь', 'ненавиж', 'бесит', 'раздража', 'ярость', 'гнев', 'злой',
      'angry', 'rage', 'furious', 'hate', 'annoyed', 'mad', 'frustrated',
      'outraged', 'livid', 'infuriated', 'disgusted', 'fed up',
    ],
  },
  fear: {
    label: 'Страх',
    icon: '🌑',
    color1: '#6C3483',
    color2: '#1A0533',
    color3: '#9B59B6',
    keywords: [
      'боюсь', 'страшно', 'ужас', 'дрожу', 'пугает', 'тревожно', 'опасно',
      'fear', 'scared', 'horror', 'terrified', 'dread', 'panic', 'anxiety',
      'tremble', 'nightmare', 'afraid', 'worried', 'nervous', 'shaking',
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
      'fascinating', 'mind-blowing', 'unbelievable', 'strange', 'wow',
    ],
  },
  neutral: {
    label: 'Спокойствие',
    icon: '🌿',
    color1: '#2C3E50',
    color2: '#1A252F',
    color3: '#3D5266',
    keywords: [],
  },
};

// ── State ───────────────────────────────────
let state = {
  currentEmotion: 'neutral',
  intensity: 0.3,
  history: [],
  particleInterval: null,
  isEnabled: true,
};

// ── DOM Refs ────────────────────────────────
let refs = {};

// ── Init ─────────────────────────────────────
jQuery(async () => {
  // Merge settings
  extension_settings[EXT_NAME] = Object.assign(
    {}, DEFAULT_SETTINGS, extension_settings[EXT_NAME] || {}
  );

  buildDOM();
  applySettings();
  bindEvents();

  console.log(`[EmotionCanvas] Loaded ✓`);
});

// ── Build DOM ───────────────────────────────
function buildDOM() {
  // Background gradient layer
  $('body').append('<div id="ec-gradient-layer"></div>');

  // Particles container
  $('body').append('<div id="ec-particles"></div>');

  // UI Panel
  const panel = `
    <div id="ec-panel">
      <div id="ec-card">
        <div id="ec-card-title">Emotion Canvas</div>

        <div id="ec-lock-badge">🔒 Зафиксировано</div>

        <div id="ec-emotion-display">
          <div id="ec-emotion-icon">🌿</div>
          <div id="ec-emotion-info">
            <div id="ec-emotion-name">Спокойствие</div>
            <div id="ec-emotion-intensity-bar">
              <div id="ec-emotion-intensity-fill" style="width:30%"></div>
            </div>
          </div>
        </div>

        <div>
          <div id="ec-history-label">История</div>
          <div id="ec-history-chart"></div>
        </div>

        <div id="ec-controls">
          <button class="ec-ctrl-btn" id="ec-btn-lock">🔒 Lock</button>
          <button class="ec-ctrl-btn" id="ec-btn-cinema">🎬 Cinema</button>
        </div>
      </div>

      <button id="ec-toggle-btn" title="Emotion Canvas">🎨</button>
    </div>
  `;

  $('body').append(panel);

  refs = {
    gradientLayer: $('#ec-gradient-layer'),
    particles: $('#ec-particles'),
    card: $('#ec-card'),
    toggleBtn: $('#ec-toggle-btn'),
    emotionIcon: $('#ec-emotion-icon'),
    emotionName: $('#ec-emotion-name'),
    intensityFill: $('#ec-emotion-intensity-fill'),
    historyChart: $('#ec-history-chart'),
    lockBadge: $('#ec-lock-badge'),
    lockBtn: $('#ec-btn-lock'),
    cinemaBtn: $('#ec-btn-cinema'),
  };
}

// ── Bind Events ──────────────────────────────
function bindEvents() {
  // Toggle panel visibility
  refs.toggleBtn.on('click', () => {
    const settings = extension_settings[EXT_NAME];
    settings.showPanel = !settings.showPanel;

    if (settings.showPanel) {
      refs.card.addClass('ec-visible');
    } else {
      refs.card.removeClass('ec-visible');
    }

    // Toggle extension on/off
    if (!settings.showPanel && !settings.enabled) {
      settings.enabled = true;
    }

    saveSettingsDebounced();
  });

  // Lock mood
  refs.lockBtn.on('click', () => {
    const settings = extension_settings[EXT_NAME];
    settings.locked = !settings.locked;

    if (settings.locked) {
      settings.lockedEmotion = state.currentEmotion;
      refs.lockBadge.addClass('ec-visible');
      refs.lockBtn.addClass('ec-active').text('🔓 Unlock');
    } else {
      settings.lockedEmotion = null;
      refs.lockBadge.removeClass('ec-visible');
      refs.lockBtn.removeClass('ec-active').text('🔒 Lock');
    }

    saveSettingsDebounced();
  });

  // Cinematic mode
  refs.cinemaBtn.on('click', () => {
    const settings = extension_settings[EXT_NAME];
    settings.cinematic = !settings.cinematic;

    if (settings.cinematic) {
      $('body').addClass('ec-cinematic');
      refs.cinemaBtn.addClass('ec-active');
      refs.gradientLayer.css('opacity', '0.35');
    } else {
      $('body').removeClass('ec-cinematic');
      refs.cinemaBtn.removeClass('ec-active');
      refs.gradientLayer.css('opacity', '0.18');
    }

    saveSettingsDebounced();
  });

  // Listen to new messages
  eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
  eventSource.on(event_types.MESSAGE_SENT, onMessageReceived);
}

// ── Apply Saved Settings ─────────────────────
function applySettings() {
  const settings = extension_settings[EXT_NAME];

  if (settings.showPanel) refs.card.addClass('ec-visible');
  if (settings.cinematic) {
    $('body').addClass('ec-cinematic');
    refs.cinemaBtn.addClass('ec-active');
  }
  if (settings.locked && settings.lockedEmotion) {
    refs.lockBadge.addClass('ec-visible');
    refs.lockBtn.addClass('ec-active').text('🔓 Unlock');
    applyEmotion(settings.lockedEmotion, 0.7);
  }

  // Enable gradient
  refs.gradientLayer.addClass('ec-visible');
  refs.toggleBtn.addClass('ec-on');
}

// ── Message Handler ──────────────────────────
function onMessageReceived() {
  const settings = extension_settings[EXT_NAME];
  if (!settings.enabled) return;
  if (settings.locked && settings.lockedEmotion) return;

  // Get latest message text
  const context = getContext();
  const chat = context.chat;
  if (!chat || chat.length === 0) return;

  const lastMsg = chat[chat.length - 1];
  const text = (lastMsg.mes || '').toLowerCase();

  const result = detectEmotion(text);
  applyEmotion(result.emotion, result.intensity);
}

// ── Emotion Detection ────────────────────────
function detectEmotion(text) {
  let bestEmotion = 'neutral';
  let bestScore = 0;

  for (const [emotion, def] of Object.entries(EMOTIONS)) {
    if (emotion === 'neutral') continue;

    let score = 0;
    for (const kw of def.keywords) {
      if (text.includes(kw)) {
        score += kw.length > 5 ? 2 : 1; // longer match = stronger signal
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestEmotion = emotion;
    }
  }

  // Normalize intensity
  const intensity = bestScore === 0
    ? 0.25
    : Math.min(0.3 + (bestScore * 0.12), 1.0);

  return { emotion: bestEmotion, intensity };
}

// ── Apply Emotion ────────────────────────────
function applyEmotion(emotion, intensity) {
  const def = EMOTIONS[emotion] || EMOTIONS.neutral;

  state.currentEmotion = emotion;
  state.intensity = intensity;

  // Update history
  state.history.push({ emotion, intensity });
  if (state.history.length > 20) state.history.shift();

  // Update CSS vars
  const root = document.documentElement;
  root.style.setProperty('--ec-current-1', def.color1);
  root.style.setProperty('--ec-current-2', def.color2);
  root.style.setProperty('--ec-current-3', def.color3);

  // Update UI
  refs.emotionIcon
    .text(def.icon)
    .css('filter', `drop-shadow(0 0 10px ${def.color1})`);
  refs.emotionName
    .text(def.label)
    .css('color', def.color1);
  refs.intensityFill
    .css('width', `${Math.round(intensity * 100)}%`);

  // Render history
  renderHistory();

  // Burst particles
  burstParticles(emotion, intensity);
}

// ── Render History Chart ─────────────────────
function renderHistory() {
  refs.historyChart.empty();

  state.history.forEach((entry, i) => {
    const def = EMOTIONS[entry.emotion] || EMOTIONS.neutral;
    const h = Math.max(3, Math.round(entry.intensity * 36));
    const bar = $('<div class="ec-bar"></div>').css({
      height: h + 'px',
      background: `linear-gradient(to top, ${def.color2}, ${def.color1})`,
    }).attr('title', `${def.label} (${Math.round(entry.intensity * 100)}%)`);
    refs.historyChart.append(bar);
  });
}

// ── Particle System ──────────────────────────
function burstParticles(emotion, intensity) {
  const settings = extension_settings[EXT_NAME];
  const count = Math.round(settings.particleCount * intensity);

  for (let i = 0; i < count; i++) {
    setTimeout(() => spawnParticle(emotion), i * 60);
  }
}

function spawnParticle(emotion) {
  const container = refs.particles[0];
  const p = document.createElement('div');
  p.className = `ec-particle ${emotion}`;

  // Random size
  const size = randBetween(4, 14);
  p.style.cssText = `
    width: ${size}px;
    height: ${emotion === 'sadness' ? randBetween(10, 24) : size}px;
    left: ${randBetween(0, 100)}%;
    bottom: ${emotion === 'sadness' ? '100%' : randBetween(0, 30) + '%'};
    --dur: ${randBetween(2.5, 7)}s;
    --dx: ${randBetween(-60, 60)}px;
    --dy: ${randBetween(-40, -100)}px;
  `;

  container.appendChild(p);

  // Self-remove after animation
  const maxDur = 8000;
  setTimeout(() => p.remove(), maxDur);
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}
