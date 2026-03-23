import express from 'express';
import cors from 'cors';
import dbWrapper from './database.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Получить все препараты
app.get('/api/medications', (req, res) => {
  const meds = dbWrapper.prepare('SELECT * FROM medications ORDER BY name').all();
  res.json(meds);
});

// Получить препарат по ID
app.get('/api/medications/:id', (req, res) => {
  const med = dbWrapper.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id);
  if (med) {
    res.json(med);
  } else {
    res.status(404).json({ error: 'Препарат не найден' });
  }
});

// Создать профиль пациента
app.post('/api/patients', (req, res) => {
  const { gender, weight, height, age, chronic_diseases, allergies } = req.body;
  
  const stmt = dbWrapper.prepare(`
    INSERT INTO patients (gender, weight, height, age, chronic_diseases, allergies)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(gender, weight, height, age, chronic_diseases || '', allergies || '');
  res.json({ id: result.lastInsertRowid, message: 'Профиль создан' });
});

// Поиск препаратов по симптомам и параметрам пациента
app.post('/api/search', (req, res) => {
  const { symptoms, patient } = req.body;
  
  if (!symptoms || !patient) {
    return res.status(400).json({ error: 'Необходимы симптомы и данные пациента' });
  }

  
  // Нормализация симптомов
  const normalizedSymptoms = symptoms.toLowerCase().trim();
  const symptomWords = normalizedSymptoms.split(/\s+/);
  
  // Получаем все препараты
  let allMeds = dbWrapper.prepare('SELECT * FROM medications').all();
  
  // Фильтрация по возрасту
  allMeds = allMeds.filter(med => 
    patient.age >= med.age_min && patient.age <= med.age_max
  );
  
  // Фильтрация по противопоказаниям
  const chronicDiseases = (patient.chronic_diseases || '').toLowerCase();
  const allergies = (patient.allergies || '').toLowerCase();
  
  allMeds = allMeds.filter(med => {
    const contraindications = med.contraindications.toLowerCase();
    
    // Проверка хронических заболеваний
    if (chronicDiseases.includes('язва') && contraindications.includes('язва')) return false;
    if (chronicDiseases.includes('астма') && contraindications.includes('астма')) return false;
    if (chronicDiseases.includes('печен') && contraindications.includes('печен')) return false;
    if (chronicDiseases.includes('почк') && contraindications.includes('почк')) return false;
    if (chronicDiseases.includes('сердц') && contraindications.includes('сердц')) return false;
    
    // Проверка аллергий
    if (allergies && contraindications.includes('аллерг')) {
      const allergyWords = allergies.split(/[,\s]+/);
      for (const allergen of allergyWords) {
        if (allergen && med.active_substance.toLowerCase().includes(allergen)) {
          return false;
        }
      }
    }
    
    return true;
  });
  
  // Ранжирование по релевантности симптомам
  const rankedMeds = allMeds.map(med => {
    let score = 0;
    const indications = med.indications.toLowerCase();
    const keywords = med.keywords.toLowerCase();
    
    // Подсчет совпадений
    for (const word of symptomWords) {
      if (word.length < 3) continue;
      
      if (indications.includes(word)) score += 3;
      if (keywords.includes(word)) score += 2;
      if (med.name.toLowerCase().includes(word)) score += 1;
    }
    
    return { ...med, relevance_score: score };
  });
  
  // Сортировка по релевантности
  const results = rankedMeds
    .filter(med => med.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 10);
  
  // Сохранение истории поиска
  if (patient.id) {
    const saveHistory = dbWrapper.prepare(`
      INSERT INTO search_history (patient_id, symptoms, results)
      VALUES (?, ?, ?)
    `);
    saveHistory.run(patient.id, symptoms, JSON.stringify(results.map(r => r.id)));
  }
  
  res.json({
    count: results.length,
    results: results,
    message: results.length === 0 ? 'Препараты не найдены. Попробуйте изменить запрос.' : null
  });
});

// История поиска пациента
app.get('/api/history/:patientId', (req, res) => {
  const history = dbWrapper.prepare(`
    SELECT * FROM search_history 
    WHERE patient_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.params.patientId);
  
  res.json(history);
});

// Статистика
app.get('/api/stats', (req, res) => {
  const totalMeds = dbWrapper.prepare('SELECT COUNT(*) as count FROM medications').get();
  const totalPatients = dbWrapper.prepare('SELECT COUNT(*) as count FROM patients').get();
  const totalSearches = dbWrapper.prepare('SELECT COUNT(*) as count FROM search_history').get();
  
  res.json({
    medications: totalMeds.count,
    patients: totalPatients.count,
    searches: totalSearches.count
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
