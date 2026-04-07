import bcrypt from 'bcryptjs';
import pool from './db.js';
import { v4 as uuidv4 } from 'uuid';

const createAdmin = async () => {
  const email = 'mas@abd.com';
  const password = 'mas@abd.com';
  const name = 'Admin Mas Abd';

  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log('Akun admin sudah ada.');
      process.exit(0);
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
      [id, email, hashedPassword]
    );

    // Profile auto-created by MySQL Trigger, let's update the name
    await pool.query('UPDATE profiles SET full_name = ? WHERE user_id = ?', [name, id]);

    console.log(`Akun admin berhasil dibuat:
Email: ${email}
Password: ${password}
Nama: ${name}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Gagal membuat akun admin:', error);
    process.exit(1);
  }
};

createAdmin();