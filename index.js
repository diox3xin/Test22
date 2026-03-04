(() => {
  'use strict';

  const MODULE_KEY = 'janitor_importer_drawer';
  const FAB_POS_KEY = 'ji_fab_pos_v1';
  const FAB_MARGIN = 10;

  const defaultSettings = Object.freeze({
    enabled: true,
    showWidget: true,

    // Local Bridge (рекомендуется, потому что у тебя Janitor даёт 403 verify)
    useLocalBridge: true,
    bridgeUrl: 'http://127.0.0.1:3857/import', // POST { url }

    // Direct fetch (обычно не работает из-за CORS/verify, оставил как опцию)
    tryDirectFetch: false,

    // Имя создаваемого лорбука
    namePrefix: 'Janitor - ',
  });

  function ctx() { return SillyTavern.getContext(); }

  function getSettings() {
    const { extensionSettings } = ctx();
    if (!extensionSettings[MODULE_KEY]) extensionSettings[MODULE_KEY] = structuredClone(defaultSettings);
    for (const k of Object.keys(defaultSettings)) {
      if (!Object.hasOwn(extensionSettings[MODULE_KEY], k)) {
        extensionSettings[MODULE_KEY][k] = defaultSettings[k];
      }
    }
    return extensionSettings[MODULE_KEY];
  }

  function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

  function vpW() { return window.visualViewport?.width || window.innerWidth; }
  function vpH() { return window.visualViewport?.height || window.innerHeight; }

  function setStatus(text) {
    const el = document.getElementById('ji_status');
    if (el) el.textContent = text ? String(text) : '';
  }

  function isJanitorScriptUrl(url) {
    return /https?:\/\/(www\.)?janitorai\.com\/scripts\/[a-f0-9\-]{36}/i.test(String(url || ''));
  }

  // ---------------- Settings UI (Extensions panel) ----------------

  async function mountSettingsUi() {
    const target = $('#extensions_settings2').length ? '#extensions_settings2' : '#extensions_settings';
    if (!$(target).length) return;
    if ($('#ji_settings_block').length) return;

    const s = getSettings();

    $(target).append(`
      <div id="ji_settings_block">
        <div class="ji_s_title">📦 Janitor Importer (Drawer UI)</div>

        <div class="ji_row" style="margin-top:6px">
          <label class="ji_ck">
            <input type="checkbox" id="ji_enabled" ${s.enabled ? 'checked' : ''}>
            <span>Включено</span>
          </label>

          <label class="ji_ck" style="margin-left:10px">
            <input type="checkbox" id="ji_show_widget" ${s.showWidget ? 'checked' : ''}>
            <span>Плавающая кнопка (FAB)</span>
          </label>
        </div>

        <div class="ji_row" style="margin-top:6px">
          <label class="ji_ck">
            <input type="checkbox" id="ji_use_bridge" ${s.useLocalBridge ? 'checked' : ''}>
            <span>Использовать Local Bridge</span>
          </label>

          <label class="ji_ck" style="margin-left:10px">
            <input type="checkbox" id="ji_try_direct" ${s.tryDirectFetch ? 'checked' : ''}>
            <span>Пробовать Direct Fetch</span>
          </label>
        </div>

        <div class="ji_row" style="margin-top:6px">
          <input type="text" id="ji_bridge_url" value="${escapeHtml(s.bridgeUrl)}" placeholder="http://127.0.0.1:3857/import" />
        </div>

        <div class="ji_s_help">
          UI как у FMT: кнопка 🧩 → боковая панель → вставляешь ссылку Janitor /scripts/UUID → Import.<br>
          В твоём случае Janitor возвращает <b>403 Security Verification</b>, поэтому без Local Bridge автозагрузка не работает.
        </div>

        <div class="ji_row" style="margin-top:8px">
          <button class="menu_button" id="ji_open_drawer_btn">📂 Открыть панель</button>
          <button class="menu_button" id="ji_reset_pos_btn">↺ Позиция FAB</button>
        </div>
      </div>
    `);

    $('#ji_enabled').on('change', () => { getSettings().enabled = $('#ji_enabled').prop('checked'); ctx().saveSettingsDebounced(); });
    $('#ji_show_widget').on('change', async () => { getSettings().showWidget = $('#ji_show_widget').prop('checked'); ctx().saveSettingsDebounced(); await renderWidget(); });
    $('#ji_use_bridge').on('change', () => { getSettings().useLocalBridge = $('#ji_use_bridge').prop('checked'); ctx().saveSettingsDebounced(); });
    $('#ji_try_direct').on('change', () => { getSettings().tryDirectFetch = $('#ji_try_direct').prop('checked'); ctx().saveSettingsDebounced(); });

    $('#ji_bridge_url').on('input', () => {
      getSettings().bridgeUrl = String($('#ji_bridge_url').val() || '').trim();
      ctx().saveSettingsDebounced();
    });

    $('#ji_open_drawer_btn').on('click', () => openDrawer(true));
    $('#ji_reset_pos_btn').on('click', () => { localStorage.removeItem(FAB_POS_KEY); applyFabPosition(); });
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  // ---------------- FAB + Drawer (FMT-like) ----------------

  function ensureFab() {
    if (document.getElementById('ji_fab')) return;

    $('body').append(`
      <div id="ji_fab">
        <button type="button" id="ji_fab_btn" title="Janitor Import">
          <div class="ji_big">🧩 Janitor</div>
          <div class="ji_small">Import scripts → World Info</div>
        </button>
        <button type="button" id="ji_fab_hide" title="Скрыть">✕</button>
      </div>
    `);

    $('#ji_fab_btn').on('click', () => openDrawer(true));
    $('#ji_fab_hide').on('click', async () => {
      getSettings().showWidget = false;
      ctx().saveSettingsDebounced();
      await renderWidget();
      toastr.info('Кнопка скрыта (включается в настройках расширения)');
    });

    initFabDrag();
    applyFabPosition();
  }

  function ensureDrawer() {
    if (document.getElementById('ji_drawer')) return;

    $('body').append(`<div id="ji_overlay"></div>`);

    $('body').append(`
      <aside id="ji_drawer" aria-hidden="true">
        <header>
          <div class="topline">
            <div class="title">🧩 Janitor Import</div>
            <button id="ji_close" type="button">✕</button>
          </div>
          <div class="subtitle">
            Вставь ссылку вида <code>https://janitorai.com/scripts/UUID</code> и импортируй в World Info.<br>
            Если Janitor отдаёт “Security Verification”, включай Local Bridge.
          </div>
        </header>

        <div class="content">
          <div class="ji_block">
            <div class="ji_row">
              <input id="ji_url" type="text" placeholder="https://janitorai.com/scripts/..." />
            </div>

            <div class="ji_row">
              <label class="ji_ck">
                <input type="checkbox" id="ji_use_bridge_drawer">
                <span>Local Bridge</span>
              </label>

              <label class="ji_ck" style="margin-left:10px">
                <input type="checkbox" id="ji_try_direct_drawer">
                <span>Direct Fetch</span>
              </label>
            </div>

            <div class="ji_row">
              <input id="ji_bridge_url_drawer" type="text" placeholder="http://127.0.0.1:3857/import" />
            </div>

            <div class="ji_row" id="ji_actions">
              <button class="menu_button" id="ji_import_btn">Импорт</button>
              <button class="menu_button" id="ji_clear_btn">Очистить</button>
            </div>

            <div class="ji_hint">
              World Info будет создан как <b>${escapeHtml(getSettings().namePrefix)}</b> + название (или UUID, если названия нет).
            </div>

            <div id="ji_status"></div>
          </div>
        </div>
      </aside>
    `);

    $('#ji_overlay').on('click', () => openDrawer(false));
    $('#ji_close').on('click', () => openDrawer(false));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('ji_drawer')?.classList.contains('ji-open')) {
        openDrawer(false);
      }
    });

    $('#ji_import_btn').on('click', async () => {
      const url = String($('#ji_url').val() || '').trim();
      await importFlow(url);
    });

    $('#ji_url').on('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const url = String($('#ji_url').val() || '').trim();
        await importFlow(url);
      }
    });

    $('#ji_clear_btn').on('click', () => {
      $('#ji_url').val('');
      setStatus('');
    });
  }

  function openDrawer(open) {
    ensureDrawer();

    const drawer = document.getElementById('ji_drawer');
    const overlay = document.getElementById('ji_overlay');
    if (!drawer || !overlay) return;

    if (open) {
      // sync drawer controls with settings
      const s = getSettings();
      $('#ji_use_bridge_drawer').prop('checked', !!s.useLocalBridge);
      $('#ji_try_direct_drawer').prop('checked', !!s.tryDirectFetch);
      $('#ji_bridge_url_drawer').val(s.bridgeUrl || '');

      overlay.style.display = 'block';
      drawer.classList.add('ji-open');
      drawer.setAttribute('aria-hidden', 'false');
      setStatus('');
      setTimeout(() => document.getElementById('ji_url')?.focus(), 50);
    } else {
      overlay.style.display = 'none';
      drawer.classList.remove('ji-open');
      drawer.setAttribute('aria-hidden', 'true');
    }
  }

  async function renderWidget() {
    ensureFab();
    const s = getSettings();
    const el = document.getElementById('ji_fab');
    if (!el) return;
    el.style.display = s.enabled && s.showWidget ? 'flex' : 'none';
  }

  // ---------------- Drag FAB (простая версия как у FMT) ----------------

  function applyFabPosition() {
    const el = document.getElementById('ji_fab');
    if (!el) return;

    const W = 180, H = 96;
    try {
      const raw = localStorage.getItem(FAB_POS_KEY);
      if (!raw) {
        el.style.left = (vpW() - W - 14) + 'px';
        el.style.top = (vpH() - H - 120) + 'px';
        return;
      }
      const pos = JSON.parse(raw);
      const left = clamp(pos.left ?? (vpW() - W - 14), FAB_MARGIN, vpW() - W - FAB_MARGIN);
      const top = clamp(pos.top ?? (vpH() - H - 120), FAB_MARGIN, vpH() - H - FAB_MARGIN);
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    } catch {
      localStorage.removeItem(FAB_POS_KEY);
    }
  }

  function initFabDrag() {
    const el = document.getElementById('ji_fab');
    const handle = document.getElementById('ji_fab_btn');
    if (!el || !handle || el.dataset.dragInit === '1') return;
    el.dataset.dragInit = '1';

    let sx = 0, sy = 0, sl = 0, st = 0, moved = false;

    const onMove = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (!moved) return;

      const W = 180, H = 96;
      const left = clamp(sl + dx, FAB_MARGIN, vpW() - W - FAB_MARGIN);
      const top = clamp(st + dy, FAB_MARGIN, vpH() - H - FAB_MARGIN);
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      ev.preventDefault();
      ev.stopPropagation();
    };

    const onEnd = () => {
      document.removeEventListener('pointermove', onMove, { passive: false });
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);

      if (moved) {
        const left = parseInt(el.style.left) || 0;
        const top = parseInt(el.style.top) || 0;
        localStorage.setItem(FAB_POS_KEY, JSON.stringify({ left, top }));
      }
      moved = false;
    };

    handle.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;

      sx = ev.clientX;
      sy = ev.clientY;
      sl = parseInt(el.style.left) || (vpW() - 180 - 14);
      st = parseInt(el.style.top) || (vpH() - 96 - 120);
      moved = false;

      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onEnd, { passive: true });
      document.addEventListener('pointercancel', onEnd, { passive: true });
      ev.preventDefault();
    }, { passive: false });

    window.addEventListener('resize', () => setTimeout(applyFabPosition, 150));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => setTimeout(applyFabPosition, 150));
  }

  // ---------------- Import logic ----------------

  async function importFlow(url) {
    const s = getSettings();
    if (!s.enabled) { toastr.warning('[JI] Расширение отключено'); return; }
    if (!isJanitorScriptUrl(url)) { toastr.error('[JI] Нужна ссылка вида https://janitorai.com/scripts/<UUID>'); return; }

    // save drawer toggles -> settings (чтобы было как у FMT: состояние запоминается)
    const useBridge = $('#ji_use_bridge_drawer').prop('checked');
    const tryDirect = $('#ji_try_direct_drawer').prop('checked');
    const bridgeUrl = String($('#ji_bridge_url_drawer').val() || '').trim();

    s.useLocalBridge = !!useBridge;
    s.tryDirectFetch = !!tryDirect;
    if (bridgeUrl) s.bridgeUrl = bridgeUrl;
    ctx().saveSettingsDebounced();

    setStatus('Импорт: старт…');

    try {
      let payload = null;

      if (s.useLocalBridge) {
        setStatus('Импорт: обращаюсь к Local Bridge…');
        payload = await fetchViaBridge(s.bridgeUrl, url);
      } else if (s.tryDirectFetch) {
        setStatus('Импорт: пробую direct fetch…');
        payload = await fetchDirectJanitor(url);
      } else {
        throw new Error('Нужно включить Local Bridge (у тебя Janitor отдаёт Security Verification).');
      }

      // payload должен быть объектом вида { title, entries:[{key,content,comment,order,...}] }
      const norm = normalizeBridgePayload(payload);
      if (!norm.entries.length) throw new Error('Bridge вернул 0 entries (проверь ссылку/доступ).');

      setStatus(`Создаю World Info…\nentries: ${norm.entries.length}`);
      const worldName = await createAndFillWorldInfo(norm.title, norm.entries);

      setStatus(`Готово!\nWorld Info: ${worldName}\nentries: ${norm.entries.length}`);
      toastr.success(`✅ Импортировано: ${worldName} (${norm.entries.length})`);

    } catch (e) {
      console.error('[JI] import failed', e);
      setStatus(`Ошибка:\n${e?.message || e}`);
      toastr.error(`[JI] ${e?.message || e}`);
    }
  }

  async function fetchViaBridge(bridgeUrl, janitorUrl) {
    const u = String(bridgeUrl || '').trim();
    if (!u) throw new Error('Bridge URL пустой.');

    const resp = await fetch(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: janitorUrl }),
    });

    const text = await resp.text().catch(() => '');
    if (!resp.ok) {
      throw new Error(`Bridge HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }

    try { return JSON.parse(text); }
    catch { throw new Error('Bridge вернул не-JSON ответ.'); }
  }

  async function fetchDirectJanitor(janitorUrl) {
    // В твоём кейсе это почти наверняка упадёт (CORS/verify),
    // но оставлено как опция.
    const resp = await fetch(janitorUrl);
    const text = await resp.text();
    if (!resp.ok) throw new Error(`Janitor HTTP ${resp.status}`);
    // Если прилетела security page — сразу стоп
    if (/security verification|verify you are human|captcha|forbidden/i.test(text)) {
      throw new Error('Janitor вернул Security Verification. Нужен Local Bridge.');
    }
    // Если вдруг это JSON — ок
    try { return JSON.parse(text); } catch {}
    throw new Error('Direct fetch не вернул JSON. Нужен Local Bridge.');
  }

  function normalizeBridgePayload(p) {
    if (!p || typeof p !== 'object') throw new Error('Неверный payload от Bridge');

    const title =
      p.title || p.name || p.script?.title || p.script?.name || `Script ${Date.now()}`;

    const rawEntries =
      Array.isArray(p.entries) ? p.entries :
      Array.isArray(p.script?.entries) ? p.script.entries :
      [];

    const entries = [];
    for (const e of rawEntries) {
      const keys = normalizeKeys(e.key ?? e.keys ?? e.keywords ?? e.triggers ?? []);
      const content = String(e.content ?? e.text ?? '').trim();
      const comment = String(e.comment ?? e.name ?? e.title ?? '').trim();
      if (!content && !keys.length) continue;

      entries.push({
        key: keys.length ? keys : ['*'],
        content,
        comment,
        order: Number.isFinite(+e.order) ? +e.order : 100,
        constant: !!e.constant,
        disable: !!e.disable,
      });
    }

    return { title, entries };
  }

  function normalizeKeys(v) {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
    const s = String(v ?? '').trim();
    if (!s) return [];
    return s.split(/[,;|\n]/g).map(x => x.trim()).filter(Boolean);
  }

  // ---------------- Save to World Info using ST internals ----------------

  async function worldInfoApi() {
    return await import('../../world-info.js');
  }

  function sanitizeName(name) {
    return String(name)
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || `Janitor - ${Date.now()}`;
  }

  async function createAndFillWorldInfo(title, entries) {
    const s = getSettings();
    const wi = await worldInfoApi();

    const baseName = sanitizeName(`${s.namePrefix || ''}${title}`);

    const existing = new Set((wi.world_names || []).map(x => String(x).toLowerCase()));
    let finalName = baseName;
    if (existing.has(baseName.toLowerCase())) {
      for (let i = 2; i < 999; i++) {
        const cand = `${baseName} (${i})`;
        if (!existing.has(cand.toLowerCase())) { finalName = cand; break; }
      }
    }

    await wi.createNewWorldInfo(finalName, { interactive: false });
    const book = await wi.loadWorldInfo(finalName);

    for (const e of entries) {
      const dst = wi.createWorldInfoEntry(null, book);
      dst.key = e.key;
      dst.comment = e.comment || '';
      dst.content = e.content || '';
      dst.order = Number.isFinite(+e.order) ? +e.order : 100;
      dst.constant = !!e.constant;
      dst.disable = !!e.disable;
    }

    await wi.saveWorldInfo(finalName, book, true);
    return finalName;
  }

  // ---------------- Init ----------------

  jQuery(async () => {
    try {
      getSettings();
      await mountSettingsUi();
      ensureDrawer();
      await renderWidget();
      console.log('[JI] Loaded');
    } catch (e) {
      console.error('[JI] init failed', e);
    }
  });

})();
