import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { v4 as uuidv4 } from 'uuid';
import { sendBookingReceipt } from './emailService.js';
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

    await pool.query("UPDATE villa_info SET app_name = IFNULL(app_name, 'VILLAPARA') WHERE id = 1");
  } catch (err) {
    console.error("Error updating villa_info schema:", err);
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
  const { name, location, description, image, rating, reviews, theme_color, app_name, app_logo_url } = req.body;
  try {
    await pool.query(
      'UPDATE villa_info SET name = ?, location = ?, description = ?, image = ?, rating = ?, reviews = ?, theme_color = ?, app_name = ?, app_logo_url = ? WHERE id = 1',
      [name, location, description, image, rating, reviews, theme_color, app_name, app_logo_url]
    );
    res.json({ message: 'Villa info updated' });
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
    const { room_id, room_name, room_image, check_in, check_out, guests, children, total_price, child_discount, payment_method } = req.body;
    
    // Handle uploaded files
    let legalDocs = [];
    if (req.files && req.files.length > 0) {
      legalDocs = req.files.map(file => `/uploads/${file.filename}`);
    }

    const id = uuidv4();
    await pool.query(
      'INSERT INTO bookings (id, user_id, room_id, room_name, room_image, check_in, check_out, guests, children, total_price, child_discount, payment_method, legal_docs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, room_id, room_name, room_image, check_in, check_out, guests, children, total_price, child_discount, payment_method, JSON.stringify(legalDocs)]
    );

    // Kirim struk ke email user
    sendBookingReceipt(req.user.email, { id, room_name, check_in, check_out, guests, children, total_price, child_discount, payment_method })
      .catch(err => console.error("Gagal kirim email:", err));

    res.status(201).json({ id, message: 'Booking created successfully' });
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

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize schema:', error);
    process.exit(1);
  });
