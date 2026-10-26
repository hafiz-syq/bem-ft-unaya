import prisma from '../lib/prisma';

export interface DataError {
  message: string;
  stack?: string | null;
  method: string;
  path: string;
  statusCode?: number;
  userId?: string | null;
}

/**
 * Menyimpan kesalahan server yang tidak terduga ke database. Tidak pernah
 * melempar error: kegagalan pencatatan tidak boleh menutupi kegagalan aslinya.
 * Data sensitif (password, token) tidak dicatat karena hanya pesan & stack yang
 * diberikan pemanggil.
 */
export async function catatErrorLog(data: DataError): Promise<void> {
  try {
    await prisma.errorLog.create({
      data: {
        message: String(data.message || 'Kesalahan tidak diketahui').slice(0, 5000),
        stack: data.stack ? String(data.stack).slice(0, 20000) : null,
        method: String(data.method || 'UNKNOWN').slice(0, 10),
        path: String(data.path || '/').slice(0, 500),
        statusCode: data.statusCode || 500,
        userId: data.userId || null,
      },
    });
  } catch (error) {
    console.error('[error-log] Gagal menyimpan catatan kesalahan:', error);
  }
}
