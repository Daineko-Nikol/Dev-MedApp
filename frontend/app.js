const API = 'http://localhost:3000/api';

let currentProfile = null;
let currentMember = null;

// ─── СПРАВОЧНИКИ ──────────────────────────────────────────
const CHRONIC_LIST = [
  { value: 'астма', label: 'Бронхиальная астма' },
  { value: 'язва желудка', label: 'Язва желудка / ДПК' },
  { value: 'гастрит', label: 'Гастрит' },
  { value: 'печеночная недостаточность', label: 'Заболевания печени' },
  { value: 'почечная недостаточность', label: 'Заболевания почек' },
  { value: 'сердечная недостаточность', label: 'Сердечная недостаточность' },
  { value: 'гипертония', label: 'Артериальная гипертензия' },
  { value: 'диабет', label: 'Сахарный диабет' },
  { value: 'глаукома', label: 'Глаукома' },
  { value: 'эпилепсия', label: 'Эпилепсия' },
  { value: 'миастения', label: 'Миастения' },
  { value: 'тиреотоксикоз', label: 'Тиреотоксикоз' },
];

const ALLERGY_LIST = [
  { value: 'пенициллин', label: 'Пенициллин' },
  { value: 'амоксициллин', label: 'Амоксициллин' },
  { value: 'ципрофлоксацин', label: 'Фторхинолоны' },
  { value: 'аспирин', label: 'Аспирин / НПВС' },
  { value: 'парацетамол', label: 'Параскофен' },
  { value: 'ибупрофен', label: 'Ибупрофен' },
  { value: 'метамизол', label: 'Анальгин (метамизол)' },
  { value: 'лоратадин', label: 'Антигистаминные' },
  { value: 'сульфаниламид', label: 'Сульфаниламиды' },
];

// Словарь симптомов: value → красивое название
const SYMPTOM_LABELS = {};
document.querySelectorAll('#symptomsList .symptom-chip').forEach(chip => {
  const cb = chip.querySelector('input');
  const label = chip.textContent.trim();
  if (cb) SYMPTOM_LABELS[cb.value] = label;
});

// Маппинг картинок по МНН
const MED_IMAGES = {
  'Ацетилцистеин': 'images/acetilcystein.png',
  'Амброксол': 'images/ambroksol.png',
  'Амоксициллин': 'images/amoksicillin.png',
  'Метамизол натрия': 'images/analgin.png',
  'Аскорбиновая кислота': 'images/ascorbinovaya.png',
  'Ацетилсалициловая кислота': 'images/aspirin.png',
  'Атенолол': 'images/atenolol.png',
  'Бисакодил': 'images/bisakodil.png',
  'Парацетамол': 'images/paraskofen.png',
};

function getMedImage(med) { return MED_IMAGES[med.inn] || null; }

// ─── API ─────────────────────────────────────────────────
async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return r.json();
}

// ─── MULTISELECT ─────────────────────────────────────────
function initMultiselect(triggerId, dropdownId, labelId, selectedContainerId, placeholder, onChange) {
  const trigger = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  const label = document.getElementById(labelId);
  const selectedContainer = document.getElementById(selectedContainerId);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllMultiselects();
    if (!isOpen) { dropdown.classList.add('open'); trigger.classList.add('open'); }
  });

  dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => { updateMS(); if (onChange) onChange(); });
  });

  function updateMS() {
    const checked = Array.from(dropdown.querySelectorAll('input:checked'));
    selectedContainer.innerHTML = '';
    checked.forEach(cb => {
      const tag = document.createElement('span');
      tag.className = 'multiselect-tag';
      tag.innerHTML = `${cb.parentElement.textContent.trim()} <button>×</button>`;
      tag.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation(); cb.checked = false; updateMS(); if (onChange) onChange();
      });
      selectedContainer.appendChild(tag);
    });
    label.textContent = checked.length === 0 ? placeholder : `Выбрано: ${checked.length}`;
  }
}

function closeAllMultiselects() {
  document.querySelectorAll('.multiselect-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.multiselect-trigger.open').forEach(t => t.classList.remove('open'));
}
document.addEventListener('click', closeAllMultiselects);

function getMultiselectValues(dropdownId) {
  return Array.from(document.querySelectorAll(`#${dropdownId} input:checked`)).map(cb => cb.value);
}

// ─── TABS ─────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + name).classList.add('active');
    if (name === 'catalog') loadCatalog();
    if (name === 'profile') renderProfileTab();
  });
});

// ─── MED CARD ─────────────────────────────────────────────
function medIcon(color, size = 56) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 60 60" fill="none">
    <rect width="60" height="60" rx="12" fill="${color}22"/>
    <rect x="10" y="26" width="40" height="8" rx="4" fill="${color}"/>
    <rect x="26" y="10" width="8" height="40" rx="4" fill="${color}"/>
  </svg>`;
}

function createMedCard(med, score) {
  const card = document.createElement('div');
  card.className = 'med-card';
  card.dataset.medId = med.id;
  const rx = med.release_form === 'По рецепту';
  const imgSrc = getMedImage(med);
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" alt="${med.name}" class="med-card-photo">`
    : medIcon(med.image_color || '#1565C0', 56);
  card.innerHTML = `
    <div class="med-card-img" style="background:${med.image_color || '#1565C0'}18">${imgHtml}</div>
    <div class="med-card-body">
      <div class="med-card-name">${med.name}</div>
      <div class="med-card-inn">${med.inn}</div>
      <div class="med-card-form">${med.drug_form}</div>
      <div class="med-card-tags">
        <span class="tag ${rx ? 'tag--rx' : 'tag--otc'}">${med.release_form}</span>
        ${score ? `<span class="tag tag--score">Совпадение: ${score}</span>` : ''}
      </div>
      <div class="med-card-footer"><button class="btn-details">Подробнее</button></div>
    </div>`;
  card.querySelector('.btn-details').addEventListener('click', (e) => { e.stopPropagation(); openMedModal(med); });
  card.addEventListener('click', () => openMedModal(med));
  return card;
}

// ─── MED MODAL ────────────────────────────────────────────
function openMedModal(med) {
  const body = document.getElementById('medModalBody');
  const member = currentMember;
  const imgSrc = getMedImage(med);
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" alt="${med.name}" style="width:64px;height:64px;object-fit:contain;border-radius:8px">`
    : `<div style="background:${med.image_color||'#1565C0'}18;width:64px;height:64px;border-radius:8px;display:flex;align-items:center;justify-content:center">${medIcon(med.image_color||'#1565C0',40)}</div>`;
  let dosageInfo = med.dosage;
  if (member && member.age < 18 && med.dosage_child)
    dosageInfo = `<strong>Для взрослых:</strong> ${med.dosage}<br><strong>Для детей:</strong> ${med.dosage_child}`;
  let allergyWarning = '';
  if (member && member.allergies) {
    const allergens = member.allergies.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    const inn = med.inn.toLowerCase();
    const matched = allergens.filter(a => a.length > 2 && inn.includes(a));
    if (matched.length > 0)
      allergyWarning = `<div class="detail-block detail-block--danger"><h4>⚠️ Внимание: возможная аллергия</h4><p>У пациента зафиксирована аллергия на: <strong>${matched.join(', ')}</strong>. Проконсультируйтесь с врачом.</p></div>`;
  }
  body.innerHTML = `
    <div class="modal-med-header">${imgHtml}
      <div><div class="modal-med-title">${med.name}</div>
      <div class="modal-med-inn">МНН: ${med.inn}</div>
      <div class="med-card-tags"><span class="tag ${med.release_form==='По рецепту'?'tag--rx':'tag--otc'}">${med.release_form}</span></div></div>
    </div>
    ${allergyWarning}
    <div class="detail-block"><h4>Лекарственная форма</h4><p>${med.drug_form}</p></div>
    <div class="detail-block"><h4>Показания к применению</h4><p>${med.indications}</p></div>
    <div class="detail-block detail-block--info"><h4>Дозировка${member?' (для данного пациента)':''}</h4><p>${dosageInfo}</p></div>
    <div class="detail-block detail-block--danger"><h4>Противопоказания</h4><p>${med.contraindications}</p></div>
    <div class="detail-block detail-block--warn"><h4>Побочные эффекты</h4><p>${med.side_effects}</p></div>
    <div class="disclaimer">Информация носит справочный характер.<p>Перед применением проконсультируйтесь с врачом или фармацевтом!!!</p></div>`;
  document.getElementById('medModal').classList.add('open');
}

document.getElementById('medModalClose').addEventListener('click', () => document.getElementById('medModal').classList.remove('open'));
document.getElementById('medModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });

// ─── SEARCH ───────────────────────────────────────────────
document.getElementById('searchBtn').addEventListener('click', async () => {
  const checkedSymptoms = Array.from(document.querySelectorAll('#symptomsList input:checked'));
  if (!checkedSymptoms.length) { alert('Выберите хотя бы один симптом'); return; }

  // Для поиска — значения (ключевые слова), для истории — красивые названия
  const symptomsForSearch = checkedSymptoms.map(cb => cb.value).join(' ');
  const symptomsForHistory = checkedSymptoms.map(cb => SYMPTOM_LABELS[cb.value] || cb.parentElement.textContent.trim()).join(', ');

  const age = parseInt(document.getElementById('age').value);
  const weight = parseFloat(document.getElementById('weight').value);
  if (!age || !weight) { alert('Укажите возраст и вес пациента'); return; }

  const chronic = Array.from(document.querySelectorAll('#chronicList input:checked')).map(cb => cb.value).join(', ');
  const allergies = Array.from(document.querySelectorAll('#allergyList input:checked')).map(cb => cb.value).join(', ');

  const member = {
    id: currentMember?.id || null,
    age, weight,
    chronic_diseases: chronic || currentMember?.chronic_diseases || '',
    allergies: allergies || currentMember?.allergies || ''
  };
  const filters = {
    drug_form: getMultiselectValues('msFormDropdown').join(','),
    release_form: getMultiselectValues('msReleaseDropdown').join(',')
  };

  const btn = document.getElementById('searchBtn');
  btn.disabled = true;
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg> Поиск...`;

  try {
    const data = await api('/search', {
      method: 'POST',
      body: JSON.stringify({ symptoms: symptomsForSearch, symptomsLabel: symptomsForHistory, member, filters })
    });
    renderSearchResults(data, member);
  } catch (e) {
    console.error(e);
    alert('Ошибка соединения с сервером. Убедитесь, что сервер запущен.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg> Подобрать препараты`;
  }
});

function renderSearchResults(data, member) {
  const el = document.getElementById('searchResults');
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!data || data.count === 0) {
    el.innerHTML = `<div class="no-results"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg><p>Препараты не найдены. Попробуйте изменить симптомы или снять фильтры.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="results-header"><h3>Найдено препаратов: ${data.count}</h3><span style="font-size:0.85em;color:#475569">Нажмите «Подробнее» для открытия краткой инструкции, прилагаемой к препарату</span></div>`;
  const grid = document.createElement('div');
  grid.className = 'med-grid';
  data.results.forEach(med => grid.appendChild(createMedCard(med, med.score)));
  el.appendChild(grid);
}

// ─── ANALOGS ──────────────────────────────────────────────
let analogFoundIds = new Set();

document.getElementById('analogBtn').addEventListener('click', async () => {
  const inn = document.getElementById('analogInput').value.trim();
  if (!inn) return;
  const meds = await api(`/analogs/${encodeURIComponent(inn)}`);
  const el = document.getElementById('analogResults');
  const clearBtn = document.getElementById('analogClearBtn');
  if (!meds.length) {
    el.innerHTML = '<p style="color:#94A3B8;margin-top:12px">Аналоги не найдены</p>';
    analogFoundIds.clear(); clearBtn.style.display = 'none'; refreshCatalogVisibility(); return;
  }
  analogFoundIds = new Set(meds.map(m => m.id));
  refreshCatalogVisibility();
  el.innerHTML = `<p style="margin-top:14px;font-size:0.9em;color:#475569">* Этот препарат скрыт в каталоге</p>`;
  const grid = document.createElement('div');
  grid.className = 'med-grid'; grid.style.marginTop = '12px';
  meds.forEach(med => grid.appendChild(createMedCard(med, null)));
  el.appendChild(grid);
  clearBtn.style.display = 'inline-flex';
});

document.getElementById('analogClearBtn').addEventListener('click', () => {
  analogFoundIds.clear();
  document.getElementById('analogResults').innerHTML = '';
  document.getElementById('analogInput').value = '';
  document.getElementById('analogClearBtn').style.display = 'none';
  refreshCatalogVisibility();
});

function refreshCatalogVisibility() {
  document.querySelectorAll('#catalogGrid .med-card').forEach(card => {
    card.style.display = analogFoundIds.has(parseInt(card.dataset.medId)) ? 'none' : '';
  });
}

// ─── CATALOG ──────────────────────────────────────────────
async function loadCatalog() {
  const drug_form = getMultiselectValues('msCatFormDropdown').join(',');
  const release_form = getMultiselectValues('msCatReleaseDropdown').join(',');
  const params = new URLSearchParams();
  if (drug_form) params.set('drug_form', drug_form);
  if (release_form) params.set('release_form', release_form);
  const meds = await api('/medications?' + params.toString());
  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = '';
  if (!meds.length) { grid.innerHTML = '<div class="no-results"><p>Препараты не найдены</p></div>'; return; }
  meds.forEach(med => grid.appendChild(createMedCard(med, null)));
  refreshCatalogVisibility();
}

// ─── HELPERS для модалок профиля ──────────────────────────
function buildCheckList(items, selectedValues, name) {
  return items.map(item => {
    const checked = selectedValues.includes(item.value) ? 'checked' : '';
    return `<label class="check-item"><input type="checkbox" name="${name}" value="${item.value}" ${checked}> ${item.label}</label>`;
  }).join('');
}

function getCheckedValues(container, name) {
  return Array.from(container.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value).join(', ');
}

function labelsByValues(list, valuesStr) {
  if (!valuesStr) return '—';
  const vals = valuesStr.split(',').map(v => v.trim()).filter(Boolean);
  return vals.map(v => list.find(i => i.value === v)?.label || v).join(', ');
}

// ─── PROFILE MODAL ────────────────────────────────────────
document.getElementById('openProfileBtn').addEventListener('click', () => openProfileModal());

function openProfileModal(step = 'main') {
  const body = document.getElementById('profileModalBody');
  const modal = document.getElementById('profileModal');

  if (step === 'main') {
    body.innerHTML = `
      <div class="pm-header">
        <div class="pm-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
        <h3>Профиль</h3>
        ${currentProfile ? `<p class="pm-logged">Вы вошли как: <strong>${currentProfile.name}</strong></p>` : '<p class="pm-sub">Профиль можно использовать как индивидуальный (один пациент) или же семейный (несколько пациентов)</p>'}
      </div>
      <div class="pm-actions">
        <button class="btn-primary pm-btn" id="pmLogin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
          Войти в профиль
        </button>
        <button class="btn-secondary pm-btn" id="pmCreate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
          Создать профиль
        </button>
        ${currentProfile ? `<button class="btn-logout pm-btn" id="pmLogout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Выйти из профиля
        </button>` : ''}
      </div>`;
    document.getElementById('pmLogin').onclick = () => openProfileModal('login');
    document.getElementById('pmCreate').onclick = () => openProfileModal('create');
    if (currentProfile) {
      document.getElementById('pmLogout').onclick = () => {
        currentProfile = null; currentMember = null;
        updateProfileHeader();
        document.getElementById('memberSelector').style.display = 'none';
        modal.classList.remove('open');
      };
    }
  }

  if (step === 'login') {
    body.innerHTML = `
      <div class="pm-header">
        <div class="pm-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.8"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg></div>
        <h3>Войти в профиль</h3>
      </div>
      <div class="field-group"><label class="field-label">Название профиля</label>
        <input id="loginName" class="field-input" placeholder="Введите название профиля"></div>
      <div class="field-group"><label class="field-label">Пароль</label>
        <input id="loginPass" class="field-input" type="password" placeholder="Введите пароль"></div>
      <div id="loginError" class="pm-error" style="display:none"></div>
      <button class="btn-primary pm-btn" id="pmDoLogin">Войти</button>
      <button class="btn-link" id="pmBack">← Назад</button>`;
    document.getElementById('pmBack').onclick = () => openProfileModal('main');
    document.getElementById('pmDoLogin').onclick = async () => {
      const name = document.getElementById('loginName').value.trim();
      const password = document.getElementById('loginPass').value;
      const errEl = document.getElementById('loginError');
      if (!name) { errEl.textContent = 'Введите название профиля'; errEl.style.display = 'block'; return; }
      if (!password) { errEl.textContent = 'Введите пароль'; errEl.style.display = 'block'; return; }
      errEl.style.display = 'none';
      const r = await api('/profiles/login', { method: 'POST', body: JSON.stringify({ name, password }) });
      if (r.error) { errEl.textContent = r.error; errEl.style.display = 'block'; return; }
      currentProfile = r;
      updateProfileHeader();
      modal.classList.remove('open');
      await loadMembersForProfile();
      if (currentMember) openEditMemberModal(currentMember, true);
    };
  }

  if (step === 'create') {
    body.innerHTML = `
      <div class="pm-header">
        <div class="pm-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg></div>
        <h3>Создать профиль</h3>
        <p class="pm-sub">Профиль для хранения данных пациента(ов)</p>
      </div>
      <div class="field-group"><label class="field-label">Название</label>
        <input id="createName" class="field-input" placeholder="Например: Семья Ивановых"></div>
      <div class="field-group"><label class="field-label">Пароль</label>
        <input id="createPass" class="field-input" type="password" placeholder="Придумайте надежный пароль"></div>
      <div class="field-group"><label class="field-label">Подтверждение пароля</label>
        <input id="createPass2" class="field-input" type="password" placeholder="Повторите пароль"></div>
      <div id="createError" class="pm-error" style="display:none"></div>
      <button class="btn-primary pm-btn" id="pmDoCreate">Создать профиль</button>
      <button class="btn-link" id="pmBack2">← Назад</button>`;
    document.getElementById('pmBack2').onclick = () => openProfileModal('main');
    document.getElementById('pmDoCreate').onclick = async () => {
      const name = document.getElementById('createName').value.trim();
      const password = document.getElementById('createPass').value;
      const password2 = document.getElementById('createPass2').value;
      const errEl = document.getElementById('createError');
      if (!name) { errEl.textContent = 'Введите название профиля'; errEl.style.display = 'block'; return; }
      if (!password) { errEl.textContent = 'Введите пароль'; errEl.style.display = 'block'; return; }
      if (password !== password2) { errEl.textContent = 'Пароли не совпадают'; errEl.style.display = 'block'; return; }
      errEl.style.display = 'none';
      const r = await api('/profiles', { method: 'POST', body: JSON.stringify({ name, password }) });
      if (r.error) { errEl.textContent = r.error; errEl.style.display = 'block'; return; }
      currentProfile = r;
      updateProfileHeader();
      modal.classList.remove('open');
    };
  }

  modal.classList.add('open');
}

// ─── EDIT MEMBER MODAL ────────────────────────────────────
// afterLogin=true — показываем как предложение обновить анамнез при входе
function openEditMemberModal(member, afterLogin = false) {
  const body = document.getElementById('profileModalBody');
  const modal = document.getElementById('profileModal');
  const chronicSelected = (member.chronic_diseases || '').split(',').map(v => v.trim()).filter(Boolean);
  const allergySelected = (member.allergies || '').split(',').map(v => v.trim()).filter(Boolean);

  body.innerHTML = `
    <div class="pm-header">
      ${afterLogin ? `<div class="pm-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>` : ''}
      <h3>${afterLogin ? `Добро пожаловать, ${member.name}!` : `${member.name}`}</h3>
      ${afterLogin ? '<p class="pm-sub">Проверьте и при необходимости обновите анамнез</p>' : ''}
    </div>
    <div class="field-row">
      <div class="field-group"><label class="field-label">Возраст (лет)</label>
        <input id="emAge" class="field-input" type="number" min="0" max="120" value="${member.age}"></div>
      <div class="field-group"><label class="field-label">Вес (кг)</label>
        <input id="emWeight" class="field-input" type="number" step="0.1" value="${member.weight}"></div>
    </div>
    <div class="field-group"><label class="field-label">Роль (необязательно)</label>
      <input id="emRole" class="field-input" placeholder="Например: муж, мама, дедушка..." value="${member.role || ''}"></div>
    <div class="modal-section-divider">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E53935" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Хронические заболевания
    </div>
    <div class="field-group">
      <div class="check-list modal-check-list" id="emChronicList">
        ${buildCheckList(CHRONIC_LIST, chronicSelected, 'emChronic')}
      </div>
    </div>
    <div class="modal-section-divider">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E53935" stroke-width="2"><path d="M12 2L2 19h20L12 2z"/><path d="M12 9v5M12 16v1" stroke-linecap="round"/></svg>
      Лекарственные аллергены
    </div>
    <div class="field-group" style="margin-bottom:28px">
      <div class="check-list modal-check-list" id="emAllergyList">
        ${buildCheckList(ALLERGY_LIST, allergySelected, 'emAllergy')}
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:4px">
      <button class="btn-primary pm-btn" id="emSave">Сохранить</button>
      ${afterLogin ? `<button class="btn-secondary pm-btn" id="emSkip">Продолжить без изменений</button>` : ''}
    </div>`;

  modal.classList.add('open');

  if (afterLogin) {
    document.getElementById('emSkip').onclick = () => {
      modal.classList.remove('open');
      fillPatientForm();
    };
  }

  document.getElementById('emSave').onclick = async () => {
    const age = parseInt(document.getElementById('emAge').value);
    const weight = parseFloat(document.getElementById('emWeight').value);
    const chronic_diseases = getCheckedValues(body, 'emChronic');
    const allergies = getCheckedValues(body, 'emAllergy');
    const role = document.getElementById('emRole').value.trim();
    await api(`/members/${member.id}`, {
      method: 'PUT',
      body: JSON.stringify({ age, weight, chronic_diseases, allergies, role })
    });
    await loadMembersForProfile();
    modal.classList.remove('open');
    fillPatientForm();
  };
}

// ─── ADD MEMBER MODAL ─────────────────────────────────────
function openAddMemberModal() {
  const body = document.getElementById('profileModalBody');
  const modal = document.getElementById('profileModal');
  body.innerHTML = `
    <div class="pm-header">
      <div class="pm-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M19 8v6M22 11h-6"/></svg></div>
      <h3> Добавить пациента</h3>
    </div>
    <div class="field-group"><label class="field-label">Имя</label>
      <input id="amName" class="field-input" placeholder="Имя"></div>
    <div class="field-row">
      <div class="field-group"><label class="field-label">Возраст (лет)</label>
        <input id="amAge" class="field-input" type="number" min="0.1" max="120" placeholder="лет"></div>
      <div class="field-group"><label class="field-label">Вес (кг)</label>
        <input id="amWeight" class="field-input" type="number" step="2.1" placeholder="кг"></div>
    </div>
    <div class="field-group"><label class="field-label">Роль (необязательно)</label>
      <input id="amRole" class="field-input" placeholder="Например: муж, мама, дедушка..."></div>
    <div class="modal-section-divider" style="border-left-color:var(--blue);background:#EFF6FF;color:var(--blue)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E53935" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Хронические заболевания
    </div>
    <div class="field-group">
      <div class="check-list modal-check-list" id="amChronicList">
        ${buildCheckList(CHRONIC_LIST, [], 'amChronic')}
      </div>
    </div>
    <div class="modal-section-divider">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E53935" stroke-width="2"><path d="M12 2L2 19h20L12 2z"/><path d="M12 9v5M12 16v1" stroke-linecap="round"/></svg>
      Лекарственные аллергены
    </div>
    <div class="field-group" style="margin-bottom:28px">
      <div class="check-list modal-check-list" id="amAllergyList">
        ${buildCheckList(ALLERGY_LIST, [], 'amAllergy')}
      </div>
    </div>
    <div id="amError" class="pm-error" style="display:none"></div>
    <button class="btn-primary pm-btn" id="amSave"> Добавить пациента</button>`;
  modal.classList.add('open');
  document.getElementById('amSave').onclick = async () => {
    const name = document.getElementById('amName').value.trim();
    const errEl = document.getElementById('amError');
    if (!name) { errEl.textContent = 'Введите имя'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    await api(`/profiles/${currentProfile.id}/members`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        gender: 'unknown',
        age: parseInt(document.getElementById('amAge').value) || 0,
        weight: parseFloat(document.getElementById('amWeight').value) || 0,
        chronic_diseases: getCheckedValues(body, 'amChronic'),
        allergies: getCheckedValues(body, 'amAllergy'),
        role: document.getElementById('amRole').value.trim()
      })
    });
    modal.classList.remove('open');
    renderProfileTab();
  };
}

// ─── PROFILE HELPERS ──────────────────────────────────────
async function loadMembersForProfile() {
  if (!currentProfile) return;
  const members = await api(`/profiles/${currentProfile.id}/members`);
  if (members.length > 0) {
    currentMember = members[0];
    showMemberSelector(members);
  }
}

function showMemberSelector(members) {
  const sel = document.getElementById('memberSelector');
  const picker = document.getElementById('memberPicker');
  sel.style.display = 'block';
  picker.innerHTML = '';
  members.forEach(m => {
    const item = document.createElement('div');
    item.className = 'member-pick-item' + (currentMember?.id === m.id ? ' active' : '');
    item.dataset.memberId = m.id;
    item.innerHTML = `
      <span>${m.name}</span>
      ${m.role ? `<span class="member-pick-age">${m.role}</span>` : ''}`;
    item.addEventListener('click', () => {
      currentMember = m;
      picker.querySelectorAll('.member-pick-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      fillPatientForm();
      updateProfileHeader();
    });
    picker.appendChild(item);
  });
  fillPatientForm();
  updateProfileHeader();
}

function fillPatientForm() {
  if (!currentMember) return;
  document.getElementById('age').value = currentMember.age;
  document.getElementById('weight').value = currentMember.weight;
  // Проставляем хронические заболевания
  const chronic = (currentMember.chronic_diseases || '').split(',').map(v => v.trim()).filter(Boolean);
  document.querySelectorAll('#chronicList input[type="checkbox"]').forEach(cb => {
    cb.checked = chronic.includes(cb.value);
  });
  // Проставляем аллергии
  const allergies = (currentMember.allergies || '').split(',').map(v => v.trim()).filter(Boolean);
  document.querySelectorAll('#allergyList input[type="checkbox"]').forEach(cb => {
    cb.checked = allergies.includes(cb.value);
  });
}

document.getElementById('editMemberBtn').addEventListener('click', () => {
  if (currentMember) openEditMemberModal(currentMember, false);
});

function updateProfileHeader() {
  const label = document.getElementById('profileLabel');
  if (!currentProfile) {
    label.textContent = 'Войти в профиль';
    return;
  }
  if (currentMember) {
    label.innerHTML = `${currentProfile.name} <span class="header-member-badge">${currentMember.name}</span>`;
  } else {
    label.textContent = currentProfile.name;
  }
}

document.getElementById('profileModalClose').addEventListener('click', () => document.getElementById('profileModal').classList.remove('open'));
document.getElementById('profileModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });

// ─── PROFILE TAB ──────────────────────────────────────────
async function renderProfileTab() {
  const el = document.getElementById('profileContent');
  if (!currentProfile) {
    el.innerHTML = `
      <div class="profile-card" style="max-width:480px">
        <h3>Вы не вошли в профиль</h3>
        <p style="color:#475569;margin-bottom:16px">Создайте новый профиль или войдите в существующий, чтобы сохранять анамнез пациента(ов) и отслеживать историю подбора</p>
        <button class="btn-primary" id="ptLogin">Войти/Создать профиль</button>
      </div>`;
    document.getElementById('ptLogin').onclick = () => openProfileModal();
    return;
  }

  const members = await api(`/profiles/${currentProfile.id}/members`);
  el.innerHTML = `
    <div class="profile-layout">
      <div class="profile-col-left">
        <div class="profile-card">
          <h3>${currentProfile.name}</h3>
          <div class="member-list" id="memberList"></div>
          <button class="btn-primary" id="addMemberBtn">+  Добавить пациента</button>
        </div>
      </div>
      <div class="profile-col-right">
        <div class="profile-card" id="memberDetailCard">
          <p style="color:#94A3B8">Выберите пациента из списка</p>
        </div>
        <div class="profile-card" id="historyCard" style="margin-top:20px">
          <h3>История подбора</h3>
          <p style="color:#94A3B8">Выберите пациента для просмотра его истории подбора</p>
        </div>
      </div>
    </div>`;

  const memberList = document.getElementById('memberList');
  members.forEach(m => {
    const item = document.createElement('div');
    item.className = 'member-item' + (currentMember?.id === m.id ? ' active' : '');
    item.innerHTML = `
      <div>
        <div class="member-name">${m.name}</div>
        <div class="member-info">${m.role || (m.age + ' лет · ' + m.weight + ' кг')}</div>
      </div>
      <button class="btn-link">Изменить</button>`;
    item.querySelector('.btn-link').onclick = (e) => { e.stopPropagation(); openEditMemberModal(m, false); };
    item.onclick = () => {
      currentMember = m;
      document.querySelectorAll('.member-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      renderMemberDetail(m);
      loadMemberHistory(m);
    };
    memberList.appendChild(item);
  });

  // Если уже выбран пациент — показываем его данные
  if (currentMember) {
    const active = members.find(m => m.id === currentMember.id);
    if (active) { renderMemberDetail(active); loadMemberHistory(active); }
  }

  document.getElementById('addMemberBtn').onclick = () => openAddMemberModal();
}

function renderMemberDetail(m) {
  const card = document.getElementById('memberDetailCard');
  if (!card) return;
  card.innerHTML = `
    <div class="member-detail-header">
      <div>
        <h3 style="margin-bottom:4px">${m.name}</h3>
        <span class="member-info">${m.role ? m.role + ' · ' : ''}${m.age} лет · ${m.weight} кг</span>
      </div>
      <button class="btn-secondary" id="editDetailBtn" style="padding:7px 14px;font-size:0.85em">Изменить</button>
    </div>
    <div class="member-detail-grid">
      <div class="member-detail-block">
        <div class="member-detail-label">Хронические заболевания</div>
        <div class="member-detail-value">${labelsByValues(CHRONIC_LIST, m.chronic_diseases)}</div>
      </div>
      <div class="member-detail-block">
        <div class="member-detail-label">Лекарственные аллергены</div>
        <div class="member-detail-value">${labelsByValues(ALLERGY_LIST, m.allergies)}</div>
      </div>
    </div>`;
  document.getElementById('editDetailBtn').onclick = () => openEditMemberModal(m, false);
}

async function loadMemberHistory(member) {
  const card = document.getElementById('historyCard');
  if (!card) return;
  const history = await api(`/members/${member.id}/history`);
  card.innerHTML = `<h3>История подбора:</h3>`;
  if (!history.length) { card.innerHTML += '<p style="color:#94A3B8;margin-top:8px">История пуста</p>'; return; }
  const list = document.createElement('div');
  list.className = 'history-list';
  history.forEach(h => {
    const item = document.createElement('div');
    item.className = 'history-item';
    // +3 часа к UTC времени
    const d = new Date(h.created_at);
    d.setHours(d.getHours() + 3);
    const date = d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const symptomsText = h.symptoms_label || h.symptoms;
    item.innerHTML = `<div class="history-symptoms">${symptomsText}</div><div class="history-date">${date}</div>`;
    list.appendChild(item);
  });
  card.appendChild(list);
}

// ─── INIT ─────────────────────────────────────────────────
initMultiselect('msFormTrigger', 'msFormDropdown', 'msFormLabel', 'msFormSelected', 'Все формы');
initMultiselect('msReleaseTrigger', 'msReleaseDropdown', 'msReleaseLabel', 'msReleaseSelected', 'Все');
initMultiselect('msCatFormTrigger', 'msCatFormDropdown', 'msCatFormLabel', 'msCatFormSelected', 'Все формы', loadCatalog);
initMultiselect('msCatReleaseTrigger', 'msCatReleaseDropdown', 'msCatReleaseLabel', 'msCatReleaseSelected', 'Все', loadCatalog);

loadCatalog();
