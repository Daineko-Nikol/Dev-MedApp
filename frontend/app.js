const API = 'http://localhost:3000/api';

let currentProfile = null;
let currentMember = null;

// Маппинг картинок по МНН / названию
const MED_IMAGES = {
  'Ацетилцистеин': 'images/acetilcystein.png',
  'Амброксол': 'images/ambroksol.png',
  'Амоксициллин': 'images/amoksicillin.png',
  'Метамизол натрия': 'images/analgin.png',
  'Аскорбиновая кислота': 'images/ascorbinovaya.png',
  'Ацетилсалициловая кислота': 'images/aspirin.png',
  'Атенолол': 'images/atenolol.png',
  'Бисакодил': 'images/bisakodil.png',
};

function getMedImage(med) {
  return MED_IMAGES[med.inn] || null;
}

// ─── API ─────────────────────────────────────────────────
async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return r.json();
}

// ─── MULTISELECT ─────────────────────────────────────────
function initMultiselect(triggerId, dropdownId, labelId, selectedContainerId, placeholder) {
  const trigger = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  const label = document.getElementById(labelId);
  const selectedContainer = document.getElementById(selectedContainerId);
  label.dataset.placeholder = placeholder;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllMultiselects();
    if (!isOpen) {
      dropdown.classList.add('open');
      trigger.classList.add('open');
    }
  });

  dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => updateMS());
  });

  function updateMS() {
    const checked = Array.from(dropdown.querySelectorAll('input:checked'));
    selectedContainer.innerHTML = '';
    checked.forEach(cb => {
      const tag = document.createElement('span');
      tag.className = 'multiselect-tag';
      tag.innerHTML = `${cb.parentElement.textContent.trim()} <button>×</button>`;
      tag.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        cb.checked = false;
        updateMS();
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
  const rx = med.release_form === 'По рецепту';
  const imgSrc = getMedImage(med);
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" alt="${med.name}" class="med-card-photo">`
    : medIcon(med.image_color || '#1565C0', 56);

  card.innerHTML = `
    <div class="med-card-img" style="background:${med.image_color || '#1565C0'}18">
      ${imgHtml}
    </div>
    <div class="med-card-body">
      <div class="med-card-name">${med.name}</div>
      <div class="med-card-inn">${med.inn}</div>
      <div class="med-card-form">${med.drug_form}</div>
      <div class="med-card-tags">
        <span class="tag ${rx ? 'tag--rx' : 'tag--otc'}">${med.release_form}</span>
        ${score ? `<span class="tag tag--score">Совпадение: ${score}</span>` : ''}
      </div>
      <div class="med-card-footer">
        <button class="btn-details">Подробнее</button>
      </div>
    </div>`;
  card.querySelector('.btn-details').addEventListener('click', (e) => {
    e.stopPropagation();
    openMedModal(med);
  });
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
    : `<div style="background:${med.image_color || '#1565C0'}18;width:64px;height:64px;border-radius:8px;display:flex;align-items:center;justify-content:center">${medIcon(med.image_color || '#1565C0', 40)}</div>`;

  let dosageInfo = med.dosage;
  if (member && member.age < 18 && med.dosage_child) {
    dosageInfo = `<strong>Для взрослых:</strong> ${med.dosage}<br><strong>Для детей:</strong> ${med.dosage_child}`;
  }

  let allergyWarning = '';
  if (member && member.allergies) {
    const allergens = member.allergies.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    const inn = med.inn.toLowerCase();
    const matched = allergens.filter(a => a.length > 2 && inn.includes(a));
    if (matched.length > 0) {
      allergyWarning = `<div class="detail-block detail-block--danger">
        <h4>⚠️ Внимание: возможная аллергия</h4>
        <p>У пациента зафиксирована аллергия на: <strong>${matched.join(', ')}</strong>. Проконсультируйтесь с врачом.</p>
      </div>`;
    }
  }

  body.innerHTML = `
    <div class="modal-med-header">
      ${imgHtml}
      <div>
        <div class="modal-med-title">${med.name}</div>
        <div class="modal-med-inn">МНН: ${med.inn}</div>
        <div class="med-card-tags">
          <span class="tag ${med.release_form === 'По рецепту' ? 'tag--rx' : 'tag--otc'}">${med.release_form}</span>
        </div>
      </div>
    </div>
    ${allergyWarning}
    <div class="detail-block"><h4>Лекарственная форма</h4><p>${med.drug_form}</p></div>
    <div class="detail-block"><h4>Показания к применению</h4><p>${med.indications}</p></div>
    <div class="detail-block detail-block--info">
      <h4>Дозировка${member ? ' (для данного пациента)' : ''}</h4>
      <p>${dosageInfo}</p>
    </div>
    <div class="detail-block detail-block--warn"><h4>Противопоказания</h4><p>${med.contraindications}</p></div>
    <div class="detail-block"><h4>Побочные эффекты</h4><p>${med.side_effects}</p></div>
    <div class="disclaimer">Информация носит справочный характер. Перед применением проконсультируйтесь с врачом или фармацевтом.</div>`;
  document.getElementById('medModal').classList.add('open');
}

document.getElementById('medModalClose').addEventListener('click', () => {
  document.getElementById('medModal').classList.remove('open');
});
document.getElementById('medModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ─── SEARCH ───────────────────────────────────────────────
document.getElementById('searchBtn').addEventListener('click', async () => {
  const checkedSymptoms = Array.from(document.querySelectorAll('#symptomsList input:checked'));
  if (!checkedSymptoms.length) { alert('Выберите хотя бы один симптом'); return; }
  const symptoms = checkedSymptoms.map(cb => cb.value).join(' ');

  const age = parseInt(document.getElementById('age').value);
  const weight = parseFloat(document.getElementById('weight').value);
  if (!age || !weight) { alert('Укажите возраст и вес пациента'); return; }

  const chronic = Array.from(document.querySelectorAll('#chronicList input:checked')).map(cb => cb.value).join(', ');
  const allergies = Array.from(document.querySelectorAll('#allergyList input:checked')).map(cb => cb.value).join(', ');

  // Если есть активный член профиля — используем его данные, но возраст/вес берём из формы
  const member = {
    id: currentMember?.id || null,
    age,
    weight,
    gender: document.getElementById('gender') ? document.getElementById('gender').value : (currentMember?.gender || 'male'),
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
      body: JSON.stringify({ symptoms, member, filters })
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
    el.innerHTML = `<div class="no-results">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      <p>Препараты не найдены. Попробуйте изменить симптомы или снять фильтры.</p>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="results-header">
    <h3>Найдено препаратов: ${data.count}</h3>
    <span style="font-size:0.85em;color:#475569">Нажмите «Подробнее» для полной инструкции</span>
  </div>`;
  const grid = document.createElement('div');
  grid.className = 'med-grid';
  data.results.forEach(med => grid.appendChild(createMedCard(med, med.score)));
  el.appendChild(grid);
}

// ─── ANALOGS ──────────────────────────────────────────────
document.getElementById('analogBtn').addEventListener('click', async () => {
  const inn = document.getElementById('analogInput').value.trim();
  if (!inn) return;
  const meds = await api(`/analogs/${encodeURIComponent(inn)}`);
  const el = document.getElementById('analogResults');
  if (!meds.length) {
    el.innerHTML = '<p style="color:#94A3B8;margin-top:12px">Аналоги не найдены</p>';
    return;
  }
  el.innerHTML = `<p style="margin-top:14px;font-size:0.9em;color:#475569">Найдено: ${meds.length}</p>`;
  const grid = document.createElement('div');
  grid.className = 'med-grid';
  grid.style.marginTop = '12px';
  meds.forEach(med => grid.appendChild(createMedCard(med, null)));
  el.appendChild(grid);
});

// ─── CATALOG ──────────────────────────────────────────────
async function loadCatalog() {
  const drug_form = document.getElementById('catalogDrugForm').value;
  const release_form = document.getElementById('catalogReleaseForm').value;

  const params = new URLSearchParams();
  if (drug_form) params.set('drug_form', drug_form);
  if (release_form) params.set('release_form', release_form);

  const meds = await api('/medications?' + params.toString());
  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = '';
  if (!meds.length) {
    grid.innerHTML = '<div class="no-results"><p>Препараты не найдены</p></div>';
    return;
  }
  meds.forEach(med => grid.appendChild(createMedCard(med, null)));
}

['catalogDrugForm', 'catalogReleaseForm'].forEach(id => {
  document.getElementById(id).addEventListener('change', loadCatalog);
});

// ─── PROFILE ──────────────────────────────────────────────
document.getElementById('openProfileBtn').addEventListener('click', () => openProfileModal());

function openProfileModal(step = 'main') {
  const body = document.getElementById('profileModalBody');
  const modal = document.getElementById('profileModal');

  if (step === 'main') {
    body.innerHTML = `
      <div class="form-modal">
        <h3>Профиль пациента</h3>
        ${currentProfile ? `<p style="color:#1565C0;font-weight:600;margin-bottom:4px">Вы вошли как: ${currentProfile.name}</p>` : ''}
        <button class="btn-primary" id="pmLogin">Войти в профиль</button>
        <button class="btn-secondary" id="pmCreate">Создать новый профиль</button>
        ${currentProfile ? `<button class="btn-secondary" id="pmLogout" style="color:#E53935;border-color:#E53935">Выйти из профиля</button>` : ''}
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
      <div class="form-modal">
        <h3>Войти в профиль</h3>
        <div class="field-group"><label class="field-label">Имя профиля</label>
          <input id="loginName" class="field-input" placeholder="Введите имя профиля"></div>
        <div class="field-group"><label class="field-label">Пароль (если установлен)</label>
          <input id="loginPass" class="field-input" type="password" placeholder="Пароль"></div>
        <button class="btn-primary" id="pmDoLogin">Войти</button>
        <button class="btn-link" id="pmBack">← Назад</button>
      </div>`;
    document.getElementById('pmBack').onclick = () => openProfileModal('main');
    document.getElementById('pmDoLogin').onclick = async () => {
      const name = document.getElementById('loginName').value.trim();
      const password = document.getElementById('loginPass').value;
      if (!name) return;
      const r = await api('/profiles/login', { method: 'POST', body: JSON.stringify({ name, password }) });
      if (r.error) { alert(r.error); return; }
      currentProfile = r;
      updateProfileHeader();
      modal.classList.remove('open');
      await loadMembersForProfile();
      if (currentMember) offerUpdateMember();
    };
  }

  if (step === 'create') {
    body.innerHTML = `
      <div class="form-modal">
        <h3>Создать профиль</h3>
        <div class="field-group"><label class="field-label">Имя профиля</label>
          <input id="createName" class="field-input" placeholder="Например: Семья Ивановых"></div>
        <div class="field-group"><label class="field-label">Пароль (необязательно)</label>
          <input id="createPass" class="field-input" type="password" placeholder="Пароль"></div>
        <button class="btn-primary" id="pmDoCreate">Создать</button>
        <button class="btn-link" id="pmBack2">← Назад</button>
      </div>`;
    document.getElementById('pmBack2').onclick = () => openProfileModal('main');
    document.getElementById('pmDoCreate').onclick = async () => {
      const name = document.getElementById('createName').value.trim();
      const password = document.getElementById('createPass').value;
      if (!name) return;
      const r = await api('/profiles', { method: 'POST', body: JSON.stringify({ name, password }) });
      if (r.error) { alert(r.error); return; }
      currentProfile = r;
      updateProfileHeader();
      modal.classList.remove('open');
    };
  }

  modal.classList.add('open');
}

function offerUpdateMember() {
  if (!currentMember) return;
  const update = confirm(`Добро пожаловать, ${currentMember.name}!\n\nХотите обновить ваши данные (возраст, вес)?`);
  if (update) openEditMemberModal(currentMember);
}

function openEditMemberModal(member) {
  const body = document.getElementById('profileModalBody');
  const modal = document.getElementById('profileModal');
  body.innerHTML = `
    <div class="form-modal">
      <h3>Данные: ${member.name}</h3>
      <div class="field-row">
        <div class="field-group"><label class="field-label">Возраст (лет)</label>
          <input id="emAge" class="field-input" type="number" value="${member.age}"></div>
        <div class="field-group"><label class="field-label">Вес (кг)</label>
          <input id="emWeight" class="field-input" type="number" value="${member.weight}" step="0.1"></div>
      </div>
      <div class="field-group"><label class="field-label">Хронические заболевания</label>
        <input id="emChronic" class="field-input" value="${member.chronic_diseases || ''}"></div>
      <div class="field-group"><label class="field-label">Аллергии</label>
        <input id="emAllergies" class="field-input" value="${member.allergies || ''}"></div>
      <button class="btn-primary" id="emSave">Сохранить</button>
    </div>`;
  modal.classList.add('open');
  document.getElementById('emSave').onclick = async () => {
    await api(`/members/${member.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        age: parseInt(document.getElementById('emAge').value),
        weight: parseFloat(document.getElementById('emWeight').value),
        chronic_diseases: document.getElementById('emChronic').value,
        allergies: document.getElementById('emAllergies').value
      })
    });
    await loadMembersForProfile();
    modal.classList.remove('open');
  };
}

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
  const select = document.getElementById('memberSelect');
  sel.style.display = 'block';
  select.innerHTML = members.map(m => `<option value="${m.id}">${m.name} (${m.age} лет)</option>`).join('');
  select.value = currentMember?.id;
  select.onchange = () => {
    currentMember = members.find(m => m.id == select.value);
    fillPatientForm();
  };
  fillPatientForm();
}

function fillPatientForm() {
  if (!currentMember) return;
  document.getElementById('age').value = currentMember.age;
  document.getElementById('weight').value = currentMember.weight;
}

document.getElementById('editMemberBtn').addEventListener('click', () => {
  if (currentMember) openEditMemberModal(currentMember);
});

function updateProfileHeader() {
  document.getElementById('profileLabel').textContent = currentProfile ? currentProfile.name : 'Войти в профиль';
}

document.getElementById('profileModalClose').addEventListener('click', () => {
  document.getElementById('profileModal').classList.remove('open');
});
document.getElementById('profileModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ─── PROFILE TAB ──────────────────────────────────────────
async function renderProfileTab() {
  const el = document.getElementById('profileContent');
  if (!currentProfile) {
    el.innerHTML = `
      <div class="profile-card" style="max-width:480px">
        <h3>Вы не вошли в профиль</h3>
        <p style="color:#475569;margin-bottom:16px">Создайте профиль или войдите, чтобы сохранять историю подбора и данные пациентов</p>
        <button class="btn-primary" id="ptLogin">Войти / Создать профиль</button>
      </div>`;
    document.getElementById('ptLogin').onclick = () => openProfileModal();
    return;
  }

  const members = await api(`/profiles/${currentProfile.id}/members`);
  el.innerHTML = `
    <div class="profile-grid">
      <div class="profile-card">
        <h3>Профиль: ${currentProfile.name}</h3>
        <div class="member-list" id="memberList"></div>
        <button class="btn-primary" id="addMemberBtn">+ Добавить пациента</button>
      </div>
      <div class="profile-card" id="historyCard">
        <h3>История подбора</h3>
        <p style="color:#94A3B8">Выберите пациента для просмотра истории</p>
      </div>
    </div>`;

  const memberList = document.getElementById('memberList');
  members.forEach(m => {
    const item = document.createElement('div');
    item.className = 'member-item' + (currentMember?.id === m.id ? ' active' : '');
    item.innerHTML = `
      <div>
        <div class="member-name">${m.name}</div>
        <div class="member-info">${m.age} лет · ${m.weight} кг · ${m.gender === 'male' ? 'Муж.' : 'Жен.'}</div>
      </div>
      <button class="btn-link">Изменить</button>`;
    item.querySelector('.btn-link').onclick = (e) => { e.stopPropagation(); openEditMemberModal(m); };
    item.onclick = () => { currentMember = m; loadMemberHistory(m); };
    memberList.appendChild(item);
  });

  document.getElementById('addMemberBtn').onclick = () => openAddMemberModal();
}

async function loadMemberHistory(member) {
  const card = document.getElementById('historyCard');
  if (!card) return;
  const history = await api(`/members/${member.id}/history`);
  card.innerHTML = `<h3>История: ${member.name}</h3>`;
  if (!history.length) { card.innerHTML += '<p style="color:#94A3B8">История пуста</p>'; return; }
  const list = document.createElement('div');
  list.className = 'history-list';
  history.forEach(h => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const date = new Date(h.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    item.innerHTML = `<div class="history-symptoms">${h.symptoms}</div><div class="history-date">${date}</div>`;
    list.appendChild(item);
  });
  card.appendChild(list);
}

function openAddMemberModal() {
  const body = document.getElementById('profileModalBody');
  const modal = document.getElementById('profileModal');
  body.innerHTML = `
    <div class="form-modal">
      <h3>Добавить пациента</h3>
      <div class="field-group"><label class="field-label">Имя</label>
        <input id="amName" class="field-input" placeholder="Имя пациента"></div>
      <div class="field-row">
        <div class="field-group"><label class="field-label">Пол</label>
          <select id="amGender" class="field-input"><option value="male">Мужской</option><option value="female">Женский</option></select></div>
        <div class="field-group"><label class="field-label">Возраст</label>
          <input id="amAge" class="field-input" type="number" min="0" max="120"></div>
      </div>
      <div class="field-group"><label class="field-label">Вес (кг)</label>
        <input id="amWeight" class="field-input" type="number" step="0.1"></div>
      <button class="btn-primary" id="amSave">Добавить</button>
    </div>`;
  modal.classList.add('open');
  document.getElementById('amSave').onclick = async () => {
    const name = document.getElementById('amName').value.trim();
    if (!name) return;
    await api(`/profiles/${currentProfile.id}/members`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        gender: document.getElementById('amGender').value,
        age: parseInt(document.getElementById('amAge').value) || 0,
        weight: parseFloat(document.getElementById('amWeight').value) || 0
      })
    });
    modal.classList.remove('open');
    renderProfileTab();
  };
}

// ─── INIT ─────────────────────────────────────────────────
// Вставляем контейнеры для тегов мультиселектов
document.getElementById('msFormDropdown').insertAdjacentHTML('afterend', '<div class="multiselect-selected" id="msFormSelected"></div>');
document.getElementById('msReleaseDropdown').insertAdjacentHTML('afterend', '<div class="multiselect-selected" id="msReleaseSelected"></div>');
initMultiselect('msFormTrigger', 'msFormDropdown', 'msFormLabel', 'msFormSelected', 'Все формы');
initMultiselect('msReleaseTrigger', 'msReleaseDropdown', 'msReleaseLabel', 'msReleaseSelected', 'Все');

loadCatalog();
