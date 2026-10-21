// 1. Load Environment Variables (Sangat penting untuk pengembangan lokal)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// 2. Ambil PORT dinamis dari Choreo, default ke 8080 untuk lokal
const PORT = process.env.PORT || 8080;

// 3. Konfigurasi CORS
// Mengizinkan semua origin untuk kebutuhan demo agar tidak terjadi CORS error di browser
app.use(cors());

// 4. Middleware untuk membaca Request Body berformat JSON
app.use(express.json());

// ==========================================
// ENDPOINT / ROUTER
// ==========================================

// Endpoint 1: Root / Health Check (Bisa dipakai untuk memastikan backend Choreo menyala)
app.get('/', (req, res) => {
  res.json({ 
    status: "success", 
    message: "Backend Choreo + Prisma + Aiven MySQL berhasil berjalan!" 
  });
});

// Endpoint 2: Mengambil semua data users dari database Aiven lewat Prisma
app.get('/api/users', async (req, res) => {
  try {
    // Memanggil model 'user' di schema.prisma Anda
    const users = await prisma.user.findMany();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("❌ Error ambil data:", error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal mengambil data dari database", 
      error: error.message 
    });
  }
});

// Endpoint 3: Menambahkan data user baru ke database Aiven lewat Prisma
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ 
      success: false, 
      message: "Nama dan email wajib diisi!" 
    });
  }

  try {
    const newUser = await prisma.user.create({
      data: { name, email }
    });
    res.status(211).json({ 
      success: true, 
      message: "User berhasil ditambahkan", 
      data: newUser 
    });
  } catch (error) {
    console.error("❌ Error tambah data:", error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal menambahkan data ke database", 
      error: error.message 
    });
  }
});

// ==========================================
// MENJALANKAN SERVER (Wajib '0.0.0.0' untuk Choreo)
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server backend demo berjalan di http://0.0.0:${PORT}`);
});
