import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from './db.js';
import { v4 as uuidv4 } from 'uuid';
import { sendAdminNewBookingNotification, sendBookingReceipt, sendBookingReminder, sendPasswordResetEmail, sendPostStayFollowup, sendTestEmail, testEmailDelivery } from './emailService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Setup Multer Storage
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static(uploadDir));

// --- AUTH ROUTES ---

const isAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Forbidden: Admin only' });
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const getEncryptionKey = () => {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptText = (plainText) => {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
};

const decryptText = (encryptedText) => {
  const key = getEncryptionKey();
  if (!key) return null;
  const raw = String(encryptedText || '');
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
};

const getEmailSettings = async () => {
  try {
    const [rows] = await pool.query('SELECT * FROM email_settings WHERE id = 1 LIMIT 1');
    const row = rows?.[0] || {};
    const decryptedPass = row.smtp_pass_enc ? decryptText(row.smtp_pass_enc) : null;
    const smtpPort = Number(row.smtp_port || 0) || Number(process.env.SMTP_PORT || 0) || 587;
    const emailJobIntervalMinutes = Number(row.email_job_interval_minutes || 0) || Number(process.env.EMAIL_JOB_INTERVAL_MINUTES || 0) || 30;
    const checkinReminderDays = Number(row.checkin_reminder_days || 0) || Number(process.env.CHECKIN_REMINDER_DAYS || 0) || 1;
    const postStayFollowupDays = Number(row.post_stay_followup_days || 0) || Number(process.env.POST_STAY_FOLLOWUP_DAYS || 0) || 1;

    return {
      brand_name: (row.brand_name || process.env.BRAND_NAME || '').toString().trim(),
      app_url: (row.app_url || process.env.APP_URL || '').toString().trim(),
      email_from: (row.email_from || process.env.EMAIL_FROM || '').toString().trim(),
      admin_notify_email: (row.admin_notify_email || process.env.ADMIN_NOTIFY_EMAIL || '').toString().trim(),
      bank_name: (row.bank_name || process.env.BANK_NAME || '').toString().trim(),
      bank_account: (row.bank_account || process.env.BANK_ACCOUNT || '').toString().trim(),
      bank_account_name: (row.bank_account_name || process.env.BANK_ACCOUNT_NAME || '').toString().trim(),
      smtp_host: (row.smtp_host || process.env.SMTP_HOST || '').toString().trim(),
      smtp_port: smtpPort,
      smtp_user: (row.smtp_user || process.env.SMTP_USER || '').toString().trim(),
      smtp_pass: (decryptedPass || process.env.SMTP_PASS || '').toString(),
      email_job_interval_minutes: emailJobIntervalMinutes,
      checkin_reminder_days: checkinReminderDays,
      post_stay_followup_days: postStayFollowupDays,
      smtp_pass_set: Boolean(decryptedPass || process.env.SMTP_PASS),
    };
  } catch (error) {
    return {
      brand_name: (process.env.BRAND_NAME || '').toString().trim(),
      app_url: (process.env.APP_URL || '').toString().trim(),
      email_from: (process.env.EMAIL_FROM || '').toString().trim(),
      admin_notify_email: (process.env.ADMIN_NOTIFY_EMAIL || '').toString().trim(),
      bank_name: (process.env.BANK_NAME || '').toString().trim(),
      bank_account: (process.env.BANK_ACCOUNT || '').toString().trim(),
      bank_account_name: (process.env.BANK_ACCOUNT_NAME || '').toString().trim(),
      smtp_host: (process.env.SMTP_HOST || '').toString().trim(),
      smtp_port: Number(process.env.SMTP_PORT || 0) || 587,
      smtp_user: (process.env.SMTP_USER || '').toString().trim(),
      smtp_pass: (process.env.SMTP_PASS || '').toString(),
      email_job_interval_minutes: Number(process.env.EMAIL_JOB_INTERVAL_MINUTES || 0) || 30,
      checkin_reminder_days: Number(process.env.CHECKIN_REMINDER_DAYS || 0) || 1,
      post_stay_followup_days: Number(process.env.POST_STAY_FOLLOWUP_DAYS || 0) || 1,
      smtp_pass_set: Boolean(process.env.SMTP_PASS),
    };
  }
};

const ensureSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      room_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      rating TINYINT NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_room (user_id, room_id),
      KEY idx_room_id (room_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS villa_policies (
      id TINYINT NOT NULL PRIMARY KEY,
      check_in_start TIME NOT NULL,
      check_in_end TIME NOT NULL,
      check_out_time TIME NOT NULL,
      no_smoking TINYINT(1) NOT NULL DEFAULT 1,
      rules JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    INSERT INTO villa_policies (id, check_in_start, check_in_end, check_out_time, no_smoking, rules)
    VALUES (1, '14:00:00', '22:00:00', '12:00:00', 1, JSON_ARRAY('Dilarang merokok di dalam kamar'))
    ON DUPLICATE KEY UPDATE id = id;
  `);

  // Ensure legal_docs and payment_receipt columns exist in bookings
  try {
    const [columns] = await pool.query('SHOW COLUMNS FROM bookings');
    const columnNames = columns.map(c => c.Field);
    
    if (!columnNames.includes('legal_docs')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN legal_docs TEXT AFTER payment_method');
    }
    if (!columnNames.includes('payment_receipt')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN payment_receipt TEXT AFTER legal_docs');
    }
    if (!columnNames.includes('admin_notified_at')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN admin_notified_at TIMESTAMP NULL AFTER payment_receipt');
    }
    if (!columnNames.includes('checkin_reminder_sent_at')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN checkin_reminder_sent_at TIMESTAMP NULL AFTER admin_notified_at');
    }
    if (!columnNames.includes('poststay_followup_sent_at')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN poststay_followup_sent_at TIMESTAMP NULL AFTER checkin_reminder_sent_at');
    }
    if (!columnNames.includes('syariah_agreed')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN syariah_agreed TINYINT(1) NOT NULL DEFAULT 0 AFTER poststay_followup_sent_at');
    }
    if (!columnNames.includes('syariah_agreed_at')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN syariah_agreed_at TIMESTAMP NULL AFTER syariah_agreed');
    }
    if (!columnNames.includes('syariah_verified_at')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN syariah_verified_at TIMESTAMP NULL AFTER syariah_agreed_at');
    }
    if (!columnNames.includes('syariah_verified_by')) {
      await pool.query('ALTER TABLE bookings ADD COLUMN syariah_verified_by VARCHAR(36) NULL AFTER syariah_verified_at');
    }
  } catch (err) {
    console.error("Error updating schema:", err);
  }

  try {
    const [columns] = await pool.query('SHOW COLUMNS FROM villa_info');
    const columnNames = columns.map(c => c.Field);

    if (!columnNames.includes('app_name')) {
      await pool.query('ALTER TABLE villa_info ADD COLUMN app_name VARCHAR(100) NULL AFTER theme_color');
    }
    if (!columnNames.includes('app_logo_url')) {
      await pool.query('ALTER TABLE villa_info ADD COLUMN app_logo_url TEXT NULL AFTER app_name');
    }
    if (!columnNames.includes('syariah_enabled')) {
      await pool.query('ALTER TABLE villa_info ADD COLUMN syariah_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER app_logo_url');
    }
    if (!columnNames.includes('syariah_policy')) {
      await pool.query('ALTER TABLE villa_info ADD COLUMN syariah_policy TEXT NULL AFTER syariah_enabled');
    }

    await pool.query("UPDATE villa_info SET app_name = IFNULL(app_name, 'VILLAPARA') WHERE id = 1");
    await pool.query(
      `UPDATE villa_info 
       SET syariah_policy = IFNULL(syariah_policy, 'Villa Syariah: dilarang membawa alkohol/narkoba\\nWajib membawa identitas resmi (KTP)\\nPasangan wajib dapat menunjukkan bukti pernikahan yang sah\\nDilarang melakukan aktivitas yang melanggar syariat\\nMaksimal tamu sesuai kapasitas yang tertera')
       WHERE id = 1`,
    );
  } catch (err) {
    console.error("Error updating villa_info schema:", err);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id TINYINT NOT NULL PRIMARY KEY,
        brand_name VARCHAR(100) NULL,
        app_url TEXT NULL,
        email_from VARCHAR(200) NULL,
        admin_notify_email VARCHAR(200) NULL,
        smtp_host VARCHAR(200) NULL,
        smtp_port INT NULL,
        smtp_user VARCHAR(200) NULL,
        smtp_pass_enc TEXT NULL,
        bank_name VARCHAR(100) NULL,
        bank_account VARCHAR(100) NULL,
        bank_account_name VARCHAR(200) NULL,
        email_job_interval_minutes INT NULL,
        checkin_reminder_days INT NULL,
        post_stay_followup_days INT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query('INSERT INTO email_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id');
  } catch (err) {
    console.error("Error creating email_settings:", err);
  }
};

// Register
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ message: 'Email sudah terdaftar' });

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
      [id, email, hashedPassword]
    );

    // Profile auto-created by MySQL Trigger (after_user_insert)
    // We update the name in the profile
    await pool.query('UPDATE profiles SET full_name = ? WHERE user_id = ?', [name, id]);

    const token = jwt.sign({ id, email, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ 
      token, 
      user: { id, email, role: 'user', user_metadata: { full_name: name } } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query(
      'SELECT u.*, p.full_name FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.email = ?', 
      [email]
    );
    if (users.length === 0) return res.status(400).json({ message: 'User tidak ditemukan' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Password salah' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, role: user.role, user_metadata: { full_name: user.full_name } } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/password-reset/request', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' });

    const [users] = await pool.query('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
    const user = users?.[0];
    if (!user) return res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' });

    const resetSecret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
    const token = jwt.sign(
      { sub: user.id, email: user.email, type: 'password_reset', jti: uuidv4() },
      resetSecret,
      { expiresIn: process.env.PASSWORD_RESET_EXPIRES || '15m' },
    );

    const settings = await getEmailSettings();
    const appUrl = (settings.app_url || req.headers.origin || '').toString().trim().replace(/\/$/, '');
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail(user.email, resetUrl, settings);
    res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/password-reset/confirm', async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';
    if (!token || newPassword.length < 8) return res.status(400).json({ message: 'Token atau password baru tidak valid' });

    const resetSecret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, resetSecret);
    if (!decoded || decoded.type !== 'password_reset' || !decoded.sub) {
      return res.status(400).json({ message: 'Token tidak valid' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, decoded.sub]);
    res.json({ message: 'Password berhasil direset' });
  } catch (error) {
    res.status(400).json({ message: 'Token tidak valid atau kadaluarsa' });
  }
});

// --- PUBLIC STATS ROUTE ---
app.get('/api/stats', async (req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [bookingCount] = await pool.query('SELECT COUNT(*) as count FROM bookings');
    const [roomCount] = await pool.query('SELECT COUNT(*) as count FROM rooms');
    
    res.json({
      totalUsers: userCount[0].count,
      totalBookings: bookingCount[0].count,
      totalRooms: roomCount[0].count
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- VILLA & ROOM ROUTES ---

// Get Villa Info
app.get('/api/villa-info', async (req, res) => {
  try {
    const [info] = await pool.query('SELECT * FROM villa_info LIMIT 1');
    res.json(info[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/villa-policies', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM villa_policies WHERE id = 1 LIMIT 1');
    const row = rows?.[0];
    if (!row) return res.json(null);
    const rules = typeof row.rules === 'string' ? JSON.parse(row.rules) : (row.rules ?? []);
    res.json({
      check_in_start: row.check_in_start,
      check_in_end: row.check_in_end,
      check_out_time: row.check_out_time,
      no_smoking: Boolean(row.no_smoking),
      rules,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/admin/villa-policies', isAdmin, async (req, res) => {
  try {
    const checkInStart = req.body?.check_in_start;
    const checkInEnd = req.body?.check_in_end;
    const checkOutTime = req.body?.check_out_time;
    const noSmoking = req.body?.no_smoking ? 1 : 0;
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : [];

    await pool.query(
      'UPDATE villa_policies SET check_in_start = ?, check_in_end = ?, check_out_time = ?, no_smoking = ?, rules = ? WHERE id = 1',
      [checkInStart, checkInEnd, checkOutTime, noSmoking, JSON.stringify(rules)],
    );

    res.json({ message: 'Villa policies updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Villa Info (Admin Only)
app.patch('/api/admin/villa-info', isAdmin, async (req, res) => {
  const { name, location, description, image, rating, reviews, theme_color, app_name, app_logo_url, syariah_enabled, syariah_policy } = req.body;
  try {
    await pool.query(
      'UPDATE villa_info SET name = ?, location = ?, description = ?, image = ?, rating = ?, reviews = ?, theme_color = ?, app_name = ?, app_logo_url = ?, syariah_enabled = ?, syariah_policy = ? WHERE id = 1',
      [name, location, description, image, rating, reviews, theme_color, app_name, app_logo_url, syariah_enabled ? 1 : 0, syariah_policy]
    );
    res.json({ message: 'Villa info updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/email-settings', isAdmin, async (req, res) => {
  const settings = await getEmailSettings();
  res.json({
    brand_name: settings.brand_name,
    app_url: settings.app_url,
    email_from: settings.email_from,
    admin_notify_email: settings.admin_notify_email,
    bank_name: settings.bank_name,
    bank_account: settings.bank_account,
    bank_account_name: settings.bank_account_name,
    smtp_host: settings.smtp_host,
    smtp_port: settings.smtp_port,
    smtp_user: settings.smtp_user,
    smtp_pass_set: Boolean(settings.smtp_pass_set),
    email_job_interval_minutes: settings.email_job_interval_minutes,
    checkin_reminder_days: settings.checkin_reminder_days,
    post_stay_followup_days: settings.post_stay_followup_days,
  });
});

app.patch('/api/admin/email-settings', isAdmin, async (req, res) => {
  try {
    const next = {
      brand_name: typeof req.body?.brand_name === 'string' ? req.body.brand_name.trim() : null,
      app_url: typeof req.body?.app_url === 'string' ? req.body.app_url.trim() : null,
      email_from: typeof req.body?.email_from === 'string' ? req.body.email_from.trim() : null,
      admin_notify_email: typeof req.body?.admin_notify_email === 'string' ? req.body.admin_notify_email.trim() : null,
      bank_name: typeof req.body?.bank_name === 'string' ? req.body.bank_name.trim() : null,
      bank_account: typeof req.body?.bank_account === 'string' ? req.body.bank_account.trim() : null,
      bank_account_name: typeof req.body?.bank_account_name === 'string' ? req.body.bank_account_name.trim() : null,
      smtp_host: typeof req.body?.smtp_host === 'string' ? req.body.smtp_host.trim() : null,
      smtp_user: typeof req.body?.smtp_user === 'string' ? req.body.smtp_user.trim() : null,
      smtp_port: Number(req.body?.smtp_port || 0) || null,
      email_job_interval_minutes: Number(req.body?.email_job_interval_minutes || 0) || null,
      checkin_reminder_days: Number(req.body?.checkin_reminder_days || 0) || null,
      post_stay_followup_days: Number(req.body?.post_stay_followup_days || 0) || null,
    };

    const smtpPassRaw = typeof req.body?.smtp_pass === 'string' ? req.body.smtp_pass : '';
    const smtpPassEnc = smtpPassRaw.trim() ? encryptText(smtpPassRaw) : null;

    const fields = [
      'brand_name',
      'app_url',
      'email_from',
      'admin_notify_email',
      'bank_name',
      'bank_account',
      'bank_account_name',
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'email_job_interval_minutes',
      'checkin_reminder_days',
      'post_stay_followup_days',
    ];

    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => next[f]);
    if (smtpPassEnc) {
      await pool.query(
        `UPDATE email_settings SET ${setClauses}, smtp_pass_enc = ? WHERE id = 1`,
        [...values, smtpPassEnc],
      );
    } else {
      await pool.query(
        `UPDATE email_settings SET ${setClauses} WHERE id = 1`,
        values,
      );
    }

    res.json({ message: 'Email settings updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/email-settings/test', isAdmin, async (req, res) => {
  try {
    const settings = await getEmailSettings();
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
    const target = to || settings.admin_notify_email || req.user?.email;
    if (!target) return res.status(400).json({ message: 'Email tujuan tidak valid' });
    const result = await testEmailDelivery(target, settings);
    if (!result.ok) {
      return res.status(400).json({ message: result.message || 'Gagal mengirim test email', details: result.details || undefined });
    }
    res.json({ message: result.message || 'Test email terkirim' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const [rooms] = await pool.query('SELECT * FROM rooms');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Single Room
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (rooms.length === 0) return res.status(404).json({ message: 'Room not found' });
    res.json(rooms[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Room (Admin Only)
app.post('/api/admin/rooms', isAdmin, upload.array('images', 5), async (req, res) => {
  const { name, type, price, capacity, amenities, description } = req.body;
  const id = uuidv4();
  
  try {
    let parsedAmenities = amenities;
    if (typeof amenities === 'string') {
       try { parsedAmenities = JSON.parse(amenities); } catch(e) { parsedAmenities = amenities.split(',').map(s=>s.trim()); }
    } else if (!amenities) {
       parsedAmenities = [];
    }

    let imagePaths = [];
    if (req.files && req.files.length > 0) {
      imagePaths = req.files.map(f => `/uploads/${f.filename}`);
    }
    
    // Support mixing old URL inputs just in case for backward compatibility
    if (req.body.existingImages) {
      let extImg = [];
      try { extImg = JSON.parse(req.body.existingImages); } catch(e) { extImg = typeof req.body.existingImages === 'string' ? [req.body.existingImages] : []; }
      imagePaths = [...extImg, ...imagePaths].filter(Boolean);
    }
    
    const mainImage = imagePaths.length > 0 ? imagePaths[0] : '';
    
    await pool.query(
      'INSERT INTO rooms (id, name, type, price, image, capacity, amenities, description, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, type, price, mainImage, capacity, JSON.stringify(parsedAmenities), description, JSON.stringify(imagePaths)]
    );
    res.status(201).json({ id, message: 'Room created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Room (Admin Only)
app.put('/api/admin/rooms/:id', isAdmin, upload.array('images', 5), async (req, res) => {
  const { name, type, price, capacity, amenities, description } = req.body;
  try {
    let parsedAmenities = amenities;
    if (typeof amenities === 'string') {
       try { parsedAmenities = JSON.parse(amenities); } catch(e) { parsedAmenities = amenities.split(',').map(s=>s.trim()); }
    } else if (!amenities) {
       parsedAmenities = [];
    }

    let existingPaths = [];
    if (req.body.existingImages) {
       try { existingPaths = JSON.parse(req.body.existingImages); } catch(e) { existingPaths = typeof req.body.existingImages === 'string' ? [req.body.existingImages] : []; }
    }
    
    let uploadedPaths = [];
    if (req.files && req.files.length > 0) {
      uploadedPaths = req.files.map(f => `/uploads/${f.filename}`);
    }

    const finalImages = [...existingPaths, ...uploadedPaths].filter(Boolean);
    const mainImage = finalImages.length > 0 ? finalImages[0] : '';

    await pool.query(
      'UPDATE rooms SET name = ?, type = ?, price = ?, image = ?, capacity = ?, amenities = ?, description = ?, images = ? WHERE id = ?',
      [name, type, price, mainImage, capacity, JSON.stringify(parsedAmenities), description, JSON.stringify(finalImages), req.params.id]
    );
    res.json({ message: 'Room updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Room (Admin Only)
app.delete('/api/admin/rooms/:id', isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- ADMIN ROUTES ---

// Admin Stats
app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [bookingCount] = await pool.query('SELECT COUNT(*) as count FROM bookings');
    const [revenue] = await pool.query('SELECT SUM(total_price) as total FROM bookings WHERE status != "cancelled"');
    
    res.json({
      totalUsers: userCount[0].count,
      totalBookings: bookingCount[0].count,
      totalRevenue: revenue[0].total || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin All Bookings
app.get('/api/admin/bookings', isAdmin, async (req, res) => {
  try {
    const [bookings] = await pool.query(`
      SELECT b.*, p.full_name as guest_name, u.email as guest_email, p.phone as guest_phone 
      FROM bookings b 
      JOIN users u ON b.user_id = u.id 
      JOIN profiles p ON u.id = p.user_id 
      ORDER BY b.created_at DESC
    `);
    // Ensure the data structure matches frontend expectations
    const formattedBookings = bookings.map(b => ({
      ...b,
      villa_name: b.room_name, // fallback for UI
      villa_image: b.room_image
    }));
    res.json(formattedBookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        u.id,
        u.email,
        u.role,
        p.full_name,
        p.phone,
        (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id AND b.status NOT IN ('cancelled')) AS total_bookings,
        (SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b WHERE b.user_id = u.id AND b.status NOT IN ('cancelled')) AS total_spent,
        (SELECT MAX(b.created_at) FROM bookings b WHERE b.user_id = u.id) AS last_booking_at
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      ORDER BY (p.full_name IS NULL) ASC, p.full_name ASC, u.email ASC`,
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.role, p.full_name, p.phone, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );
    const user = users?.[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    const [statsRows] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM bookings b WHERE b.user_id = ? AND b.status NOT IN ('cancelled')) AS total_bookings,
        (SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b WHERE b.user_id = ? AND b.status NOT IN ('cancelled')) AS total_spent,
        (SELECT MAX(b.created_at) FROM bookings b WHERE b.user_id = ?) AS last_booking_at,
        (SELECT COUNT(*) FROM reviews r WHERE r.user_id = ?) AS total_reviews
      `,
      [userId, userId, userId, userId],
    );
    const stats = statsRows?.[0] || { total_bookings: 0, total_spent: 0, last_booking_at: null, total_reviews: 0 };

    const [bookings] = await pool.query(
      `SELECT b.*
       FROM bookings b
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC
       LIMIT 200`,
      [userId],
    );

    const formattedBookings = bookings.map(b => ({
      ...b,
      villa_name: b.room_name,
      villa_image: b.room_image,
    }));

    res.json({ user, stats, bookings: formattedBookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/admin/users/:id/role', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const role = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role tidak valid' });
    }
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    res.json({ message: 'Role updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin Update Booking Status
app.patch('/api/admin/bookings/:id', isAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/bookings/:id/verify-syariah', isAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const [rows] = await pool.query('SELECT id, status, syariah_agreed FROM bookings WHERE id = ? LIMIT 1', [bookingId]);
    const booking = rows?.[0];
    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });
    if (booking.status !== 'pending_verification') {
      return res.status(400).json({ message: 'Booking ini tidak dalam status verifikasi syariah' });
    }
    if (!booking.syariah_agreed) {
      return res.status(400).json({ message: 'Tamu belum menyetujui kebijakan syariah' });
    }

    await pool.query(
      'UPDATE bookings SET status = ?, syariah_verified_at = NOW(), syariah_verified_by = ? WHERE id = ?',
      ['confirmed', req.user.id, bookingId],
    );
    res.json({ message: 'Verifikasi syariah berhasil. Booking dikonfirmasi.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Booked Dates for a Room
app.get('/api/rooms/:id/availability', async (req, res) => {
  try {
    const [bookings] = await pool.query(
      'SELECT check_in, check_out FROM bookings WHERE room_id = ? AND status NOT IN ("cancelled")',
      [req.params.id]
    );
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/rooms/:id/reviews', async (req, res) => {
  try {
    const roomId = req.params.id;
    const [summaryRows] = await pool.query(
      'SELECT AVG(rating) as avgRating, COUNT(*) as total FROM reviews WHERE room_id = ?',
      [roomId],
    );
    const summary = summaryRows?.[0] || { avgRating: 0, total: 0 };

    const [reviews] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, p.full_name as user_name
       FROM reviews r
       JOIN profiles p ON r.user_id = p.user_id
       WHERE r.room_id = ?
       ORDER BY r.created_at DESC`,
      [roomId],
    );

    res.json({
      summary: {
        avgRating: Number(summary.avgRating) || 0,
        total: Number(summary.total) || 0,
      },
      reviews,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/rooms/:id/reviews', requireAuth, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating harus 1-5' });
    }
    if (comment.length < 3 || comment.length > 1000) {
      return res.status(400).json({ message: 'Komentar minimal 3 karakter' });
    }

    const [bookings] = await pool.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND room_id = ? AND status = "completed"',
      [userId, roomId],
    );
    if (!bookings?.[0]?.count) {
      return res.status(403).json({ message: 'Review hanya bisa diberikan setelah booking selesai (completed)' });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO reviews (id, room_id, user_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP`,
      [id, roomId, userId, rating, comment],
    );

    res.status(201).json({ message: 'Review tersimpan' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- PROFILE ROUTES ---

// Get User Profile
app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT p.full_name, p.phone, p.avatar_url, u.email FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Profile not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update User Profile
app.patch('/api/profile', requireAuth, async (req, res) => {
  const { full_name, phone } = req.body;
  try {
    await pool.query(
      'UPDATE profiles SET full_name = ?, phone = ? WHERE user_id = ?',
      [full_name, phone || null, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change Password
app.patch('/api/profile/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  try {
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if (!isMatch) return res.status(400).json({ message: 'Password lama salah' });

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ message: 'Password updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- BOOKING ROUTES ---

// Get User Bookings
app.get('/api/bookings', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC', 
      [decoded.id]
    );
    // Format for frontend
    const formattedBookings = bookings.map(b => ({
      ...b,
      villa_name: b.room_name,
      villa_image: b.room_image
    }));
    res.json(formattedBookings);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Create Booking with Document Upload
app.post('/api/bookings', requireAuth, upload.array('legal_docs', 5), async (req, res) => {
  try {
    const { room_id, room_name, room_image, check_in, check_out, guests, children, total_price, child_discount, payment_method, syariah_agreed } = req.body;
    
    // Handle uploaded files
    let legalDocs = [];
    if (req.files && req.files.length > 0) {
      legalDocs = req.files.map(file => `/uploads/${file.filename}`);
    }

    let syariahEnabled = true;
    try {
      const [rows] = await pool.query('SELECT syariah_enabled FROM villa_info WHERE id = 1 LIMIT 1');
      const row = rows?.[0];
      if (row && row.syariah_enabled !== undefined && row.syariah_enabled !== null) {
        syariahEnabled = Boolean(row.syariah_enabled);
      }
    } catch {
      syariahEnabled = true;
    }

    const agreed = String(syariah_agreed || '').trim() === 'true' || String(syariah_agreed || '').trim() === '1';
    const guestCountNum = Number(guests || 0);

    if (syariahEnabled && !agreed) {
      return res.status(400).json({ message: 'Wajib menyetujui kebijakan syariah sebelum booking' });
    }

    if (syariahEnabled && guestCountNum >= 2 && legalDocs.length === 0) {
      return res.status(400).json({ message: 'Wajib mengunggah dokumen identitas untuk verifikasi syariah' });
    }

    const id = uuidv4();
    const initialStatus = syariahEnabled && guestCountNum >= 2 ? 'pending_verification' : 'pending';
    await pool.query(
      'INSERT INTO bookings (id, user_id, room_id, room_name, room_image, check_in, check_out, guests, children, total_price, child_discount, payment_method, legal_docs, status, syariah_agreed, syariah_agreed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [id, req.user.id, room_id, room_name, room_image, check_in, check_out, guests, children, total_price, child_discount, payment_method, JSON.stringify(legalDocs), initialStatus, syariahEnabled ? (agreed ? 1 : 0) : 0]
    );

    getEmailSettings()
      .then((settings) => {
        sendBookingReceipt(req.user.email, { id, room_name, check_in, check_out, guests, children, total_price, child_discount, payment_method }, settings)
          .catch(err => console.error("Gagal kirim email:", err));

        const adminEmail = (settings.admin_notify_email || '').trim();
        if (adminEmail) {
          sendAdminNewBookingNotification(adminEmail, {
            id,
            room_name,
            check_in,
            check_out,
            guests,
            children,
            total_price,
            payment_method,
            guest_email: req.user.email,
          }, settings)
            .then((sent) => {
              if (sent) return pool.query('UPDATE bookings SET admin_notified_at = NOW() WHERE id = ?', [id]);
            })
            .catch(err => console.error("Gagal kirim email admin:", err));
        }
      })
      .catch(() => {});

    res.status(201).json({ id, status: initialStatus, message: 'Booking created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload Payment Receipt (Guest)
app.patch('/api/bookings/:id/receipt', requireAuth, upload.single('payment_receipt'), async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    
    const receiptPath = `/uploads/${req.file.filename}`;
    const [result] = await pool.query(
      'UPDATE bookings SET payment_receipt = ? WHERE id = ? AND user_id = ?',
      [receiptPath, id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Booking not found or unauthorized' });
    }

    res.json({ message: 'Receipt uploaded successfully', receiptPath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

let emailJobRunning = false;
function startEmailJobs() {
  const tick = async () => {
    if (emailJobRunning) return;
    emailJobRunning = true;
    try {
      const settings = await getEmailSettings();
      const checkinLeadDays = Number(settings.checkin_reminder_days || 1);
      const postStayDays = Number(settings.post_stay_followup_days || 1);

      const [reminders] = await pool.query(
        `SELECT b.id, b.room_name, b.check_in, b.check_out, b.guests, b.children, b.total_price, b.child_discount, b.payment_method, u.email
         FROM bookings b
         JOIN users u ON b.user_id = u.id
         WHERE b.status NOT IN ('cancelled')
           AND b.checkin_reminder_sent_at IS NULL
           AND DATE(b.check_in) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
         ORDER BY b.created_at DESC
         LIMIT 50`,
        [checkinLeadDays],
      );

      for (const b of reminders) {
        const sent = await sendBookingReminder(b.email, b, settings);
        if (sent) await pool.query('UPDATE bookings SET checkin_reminder_sent_at = NOW() WHERE id = ?', [b.id]);
      }

      const [followups] = await pool.query(
        `SELECT b.id, b.room_name, b.check_in, b.check_out, b.guests, b.children, b.total_price, b.child_discount, b.payment_method, u.email
         FROM bookings b
         JOIN users u ON b.user_id = u.id
         WHERE b.status NOT IN ('cancelled')
           AND b.poststay_followup_sent_at IS NULL
           AND DATE(b.check_out) = DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY b.created_at DESC
         LIMIT 50`,
        [postStayDays],
      );

      for (const b of followups) {
        const sent = await sendPostStayFollowup(b.email, b, settings);
        if (sent) await pool.query('UPDATE bookings SET poststay_followup_sent_at = NOW() WHERE id = ?', [b.id]);
      }
    } catch (error) {
      console.error('Email job error:', error);
    } finally {
      emailJobRunning = false;
    }
  };

  const loop = async () => {
    await tick();
    const settings = await getEmailSettings();
    const intervalMinutes = Number(settings.email_job_interval_minutes || 30);
    const nextDelay = (Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 30) * 60 * 1000;
    setTimeout(() => {
      loop().catch(() => {});
    }, nextDelay);
  };

  loop().catch(() => {});
}

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startEmailJobs();
    });
  })
  .catch((error) => {
    console.error('Failed to initialize schema:', error);
    process.exit(1);
  });
