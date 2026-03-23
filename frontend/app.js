// API функции
const API_URL = 'http://localhost:3000/api';

async function searchMedications(symptoms, patient) {
  const response = await fetch(`${API_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symptoms, patient })
  });
  return response.json();
}

async function getAllMedications() {
  const response = await fetch(`${API_URL}/medications`);
  return response.json();
}

async function createPatient(patientData) {
  const response = await fetch(`${API_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patientData)
  });
  return response.json();
}

async function getStats() {
  const response = await fetch(`${API_URL}/stats`);
  return response.json();
}

// Управление вкладками
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      if (tabName === 'catalog') loadCatalog();
      if (tabName === 'stats') loadStats();
    });
  });

  // Поиск препаратов
  document.getElementById('searchBtn').addEventListener('click', async () => {
    const patient = {
      gender: document.getElementById('gender').value,
      age: parseInt(document.getElementById('age').value),
      weight: parseFloat(document.getElementById('weight').value),
      height: parseInt(document.getElementById('height').value),
      chronic_diseases: '',
      allergies: ''
    };
    
    // Собираем выбранные хронические заболевания
    const chronicChecked = document.querySelectorAll('#chronicDiseases input:checked');
    patient.chronic_diseases = Array.from(chronicChecked).map(cb => cb.value).join(', ');
    
    // Собираем выбранные аллергии
    const allergiesChecked = document.querySelectorAll('#allergiesList input:checked');
    patient.allergies = Array.from(allergiesChecked).map(cb => cb.value).join(', ');
    
    // Собираем выбранные симптомы
    const symptomsChecked = document.querySelectorAll('#symptomsList input:checked');
    const symptoms = Array.from(symptomsChecked).map(cb => cb.value).join(', ');
    
    if (!symptoms) {
      alert('Пожалуйста, выберите хотя бы один симптом');
      return;
    }
    
    if (!patient.age || !patient.weight || !patient.height) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }
    
    document.getElementById('searchBtn').textContent = '⏳ Поиск...';
    document.getElementById('searchBtn').disabled = true;
    
    try {
      const patientResult = await createPatient(patient);
      patient.id = patientResult.id;
      
      const result = await searchMedications(symptoms, patient);
      displayResults(result);
    } catch (error) {
      alert('Ошибка при поиске: ' + error.message);
      console.error(error);
    } finally {
      document.getElementById('searchBtn').textContent = '🔍 Найти препараты';
      document.getElementById('searchBtn').disabled = false;
    }
  });

  // Закрытие модального окна
  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('modal').classList.remove('show');
  });

  window.addEventListener('click', (e) => {
    const modal = document.getElementById('modal');
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });

  // Поиск в каталоге
  document.getElementById('catalogSearch').addEventListener('input', async (e) => {
    const query = e.target.value.toLowerCase();
    const medications = await getAllMedications();
    
    const filtered = medications.filter(med => 
      med.name.toLowerCase().includes(query) ||
      med.active_substance.toLowerCase().includes(query) ||
      med.indications.toLowerCase().includes(query)
    );
    
    displayCatalog(filtered);
  });
});

function displayResults(result) {
  const resultsDiv = document.getElementById('results');
  
  if (result.count === 0) {
    resultsDiv.innerHTML = `
      <div class="card">
        <p class="warning">⚠️ Препараты не найдены. Попробуйте изменить описание симптомов или проверьте данные пациента.</p>
      </div>
    `;
    return;
  }
  
  resultsDiv.innerHTML = `
    <div class="card">
      <h2>Найдено препаратов: ${result.count}</h2>
      <p class="info">💡 Нажмите на препарат для подробной информации</p>
    </div>
  `;
  
  result.results.forEach(med => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-header">
        <div class="result-name">${med.name}</div>
        <div class="relevance-badge">Релевантность: ${med.relevance_score}</div>
      </div>
      <div class="result-substance">Действующее вещество: ${med.active_substance}</div>
      <div class="result-indications">📋 ${med.indications}</div>
    `;
    
    item.addEventListener('click', () => showMedicationDetails(med));
    resultsDiv.appendChild(item);
  });
}

function showMedicationDetails(med) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <h2 style="color: #667eea; margin-bottom: 20px;">${med.name}</h2>
    
    <div class="detail-section">
      <h3>💊 Форма выпуска</h3>
      <p>${med.form}</p>
    </div>
    
    <div class="detail-section">
      <h3>🧪 Действующее вещество</h3>
      <p>${med.active_substance}</p>
    </div>
    
    <div class="detail-section">
      <h3>✅ Показания к применению</h3>
      <p>${med.indications}</p>
    </div>
    
    <div class="detail-section warning">
      <h3>⚠️ Противопоказания</h3>
      <p>${med.contraindications}</p>
    </div>
    
    <div class="detail-section">
      <h3>⚡ Побочные эффекты</h3>
      <p>${med.side_effects}</p>
    </div>
    
    <div class="detail-section">
      <h3>💉 Дозировка</h3>
      <p>${med.dosage}</p>
    </div>
    
    <div class="detail-section info">
      <h3>👤 Возрастные ограничения</h3>
      <p>От ${med.age_min} до ${med.age_max} лет</p>
    </div>
    
    ${med.pregnancy_category ? `
      <div class="detail-section">
        <h3>🤰 Категория при беременности</h3>
        <p>Категория ${med.pregnancy_category}</p>
      </div>
    ` : ''}
    
    <p style="margin-top: 20px; color: #999; font-size: 0.9em;">
      ⚠️ Информация носит справочный характер. Перед применением проконсультируйтесь с врачом.
    </p>
  `;
  
  modal.classList.add('show');
}

async function loadCatalog() {
  const catalogList = document.getElementById('catalogList');
  catalogList.innerHTML = '<p>⏳ Загрузка...</p>';
  
  try {
    const medications = await getAllMedications();
    displayCatalog(medications);
  } catch (error) {
    catalogList.innerHTML = '<p class="warning">Ошибка загрузки каталога: ' + error.message + '</p>';
    console.error(error);
  }
}

function displayCatalog(medications) {
  const catalogList = document.getElementById('catalogList');
  catalogList.innerHTML = '';
  
  if (medications.length === 0) {
    catalogList.innerHTML = '<p>Препараты не найдены</p>';
    return;
  }
  
  medications.forEach(med => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-name">${med.name}</div>
      <div class="result-substance">${med.active_substance} • ${med.form}</div>
      <div class="result-indications">${med.indications}</div>
    `;
    item.addEventListener('click', () => showMedicationDetails(med));
    catalogList.appendChild(item);
  });
}

async function loadStats() {
  const statsContent = document.getElementById('statsContent');
  statsContent.innerHTML = '<p>⏳ Загрузка...</p>';
  
  try {
    const stats = await getStats();
    
    statsContent.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.medications}</div>
        <div class="stat-label">Препаратов в базе</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.patients}</div>
        <div class="stat-label">Профилей пациентов</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.searches}</div>
        <div class="stat-label">Выполнено поисков</div>
      </div>
    `;
  } catch (error) {
    statsContent.innerHTML = '<p class="warning">Ошибка загрузки статистики: ' + error.message + '</p>';
    console.error(error);
  }
}
