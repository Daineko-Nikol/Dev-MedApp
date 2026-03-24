import express from 'express';
import cors from 'cors';
import dbWrapper from './database.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Все препараты (с фильтрами)
app.get('/api/medications', (req, res) => {
  const { drug_form, release_form, search } = req.query;
  let sql = 'SELECT * FROM medications WHERE 1=1';
  const params = [];

  // drug_form может быть несколько через запятую — соединяем через OR
  // Используем LIKE без LOWER() т.к. sql.js не поддерживает LOWER для кириллицы
  if (drug_form) {
    const forms = drug_form.split(',').map(f => f.trim()).filter(Boolean);
    if (forms.length > 0) {
      const placeholders = forms.map(() => 'drug_form LIKE ?').join(' OR ');
      sql += ` AND (${placeholders})`;
      forms.forEach(f => params.push(`%${f}%`));
    }
  }

  // release_form может быть несколько через запятую — соединяем через OR
  if (release_form) {
    const releases = release_form.split(',').map(r => r.trim()).filter(Boolean);
    if (releases.length > 0) {
      const placeholders = releases.map(() => 'release_form = ?').join(' OR ');
      sql += ` AND (${placeholders})`;
      releases.forEach(r => params.push(r));
    }
  }

  if (search) {
    sql += ' AND (name LIKE ? OR inn LIKE ? OR indications LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY name';
  const meds = dbWrapper.prepare(sql).all(...params);
  res.json(meds);
});

// Один препарат
app.get('/api/medications/:id', (req, res) => {
  const med = dbWrapper.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id);
  med ? res.json(med) : res.status(404).json({ error: 'Не найден' });
});

// Поиск аналогов по МНН (регистронезависимо)
// sql.js не поддерживает LOWER() для кириллицы — ищем через JS после выборки
app.get('/api/analogs/:inn', (req, res) => {
  const inn = req.params.inn.trim().toLowerCase();
  const allMeds = dbWrapper.prepare('SELECT * FROM medications ORDER BY name').all();
  const meds = allMeds.filter(m => m.inn.toLowerCase().includes(inn));
  res.json(meds);
});

// Подбор по симптомам
app.post('/api/search', (req, res) => {
  const { symptoms, symptomsLabel, member, filters } = req.body;
  if (!symptoms || !member) return res.status(400).json({ error: 'Нет данных' });

  const words = symptoms.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
  let allMeds = dbWrapper.prepare('SELECT * FROM medications').all();

  // Фильтр по возрасту
  allMeds = allMeds.filter(m => member.age >= m.age_min && member.age <= m.age_max);

  // Фильтр по форме выпуска
  if (filters?.drug_form) {
    const forms = filters.drug_form.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
    if (forms.length > 0) {
      allMeds = allMeds.filter(m => forms.some(f => m.drug_form.toLowerCase().includes(f)));
    }
  }
  if (filters?.release_form) {
    const releases = filters.release_form.split(',').map(r => r.trim()).filter(Boolean);
    if (releases.length > 0) {
      allMeds = allMeds.filter(m => releases.includes(m.release_form));
    }
  }

  // Фильтр по противопоказаниям
  const chronic = (member.chronic_diseases || '').toLowerCase();
  const allergies = (member.allergies || '').toLowerCase();

  allMeds = allMeds.filter(med => {
    const contra = med.contraindications.toLowerCase();
    const inn = med.inn.toLowerCase();

    const chronicMap = {
      'астма': 'астма', 'язва': 'язва', 'печен': 'печен',
      'почк': 'почк', 'сердц': 'сердц', 'диабет': 'диабет',
      'гипертон': 'гипертон', 'глаукома': 'глаукома'
    };
    for (const [key, val] of Object.entries(chronicMap)) {
      if (chronic.includes(key) && contra.includes(val)) return false;
    }

    if (allergies) {
      for (const allergen of allergies.split(',').map(a => a.trim()).filter(Boolean)) {
        if (allergen.length > 2 && inn.includes(allergen)) return false;
      }
    }
    return true;
  });

  // Ранжирование
  const ranked = allMeds.map(med => {
    let score = 0;
    const ind = med.indications.toLowerCase();
    const kw = (med.keywords || '').toLowerCase();
    for (const w of words) {
      if (ind.includes(w)) score += 3;
      if (kw.includes(w)) score += 2;
    }
    return { ...med, score };
  }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

  // Сохранение истории
  if (member.id) {
    dbWrapper.prepare(
      'INSERT INTO search_history (member_id, symptoms, symptoms_label, filters, results) VALUES (?, ?, ?, ?, ?)'
    ).run(member.id, symptoms, symptomsLabel || symptoms, JSON.stringify(filters || {}), JSON.stringify(ranked.slice(0, 10).map(r => r.id)));
  }

  res.json({ count: ranked.length, results: ranked.slice(0, 15) });
});

// Профили
app.get('/api/profiles', (req, res) => {
  res.json(dbWrapper.prepare('SELECT id, name FROM profiles ORDER BY name').all());
});

app.post('/api/profiles', (req, res) => {
  const { name, password } = req.body;
  if (!name) return res.status(400).json({ error: 'Нужно имя' });
  const exists = dbWrapper.prepare('SELECT id FROM profiles WHERE name = ?').get(name);
  if (exists) return res.status(409).json({ error: 'Профиль уже существует' });
  const r = dbWrapper.prepare('INSERT INTO profiles (name, password) VALUES (?, ?)').run(name, password || '');
  res.json({ id: r.lastInsertRowid, name });
});

app.post('/api/profiles/login', (req, res) => {
  const { name, password } = req.body;
  const profile = dbWrapper.prepare('SELECT * FROM profiles WHERE name = ?').get(name);
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });
  if (profile.password && profile.password !== password) return res.status(401).json({ error: 'Неверный пароль' });
  res.json({ id: profile.id, name: profile.name });
});

// Члены семьи
app.get('/api/profiles/:profileId/members', (req, res) => {
  res.json(dbWrapper.prepare('SELECT * FROM members WHERE profile_id = ?').all(req.params.profileId));
});

app.post('/api/profiles/:profileId/members', (req, res) => {
  const { name, gender, age, weight, chronic_diseases, allergies, role } = req.body;
  const r = dbWrapper.prepare(
    'INSERT INTO members (profile_id, name, gender, age, weight, chronic_diseases, allergies, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.profileId, name, gender, age, weight, chronic_diseases || '', allergies || '', role || '');
  res.json({ id: r.lastInsertRowid, name });
});

app.put('/api/members/:id', (req, res) => {
  const { age, weight, chronic_diseases, allergies, role } = req.body;
  dbWrapper.prepare(
    'UPDATE members SET age=?, weight=?, chronic_diseases=?, allergies=?, role=? WHERE id=?'
  ).run(age, weight, chronic_diseases || '', allergies || '', role || '', req.params.id);
  res.json({ success: true });
});

// История поиска
app.get('/api/members/:memberId/history', (req, res) => {
  const history = dbWrapper.prepare(
    'SELECT * FROM search_history WHERE member_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.params.memberId);
  res.json(history);
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
