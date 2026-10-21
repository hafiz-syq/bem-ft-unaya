const mysql = require('mysql2');
require('dotenv').config(); // Mengambil file .env jika dijalankan lokal

// Membuat pool koneksi agar lebih stabil dibanding single connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: {
    rejectUnauthorized: true // WAJIB untuk Aiven MySQL
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Cek koneksi saat server pertama kali berjalan
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Koneksi database Aiven GAGAL:', err.message);
  } else {
    console.log('✅ Koneksi database Aiven BERHASIL!');
    connection.release();
  }
});

module.exports = pool.promise();
