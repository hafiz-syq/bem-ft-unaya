import { Response, NextFunction } from 'express';
import {
  hapusLanggananPush,
  kunciPublikPush,
  simpanLanggananPush,
} from '../services/push.service';

/** Kunci publik VAPID untuk didaftarkan browser. Null = fitur belum dikonfigurasi. */
export const getPushPublicKey = async (_req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const publicKey = await kunciPublikPush();
    res.status(200).json({ enabled: Boolean(publicKey), publicKey });
  } catch (error) {
    next(error);
  }
};

export const subscribePush = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { endpoint, keys } = req.body || {};
    if (
      typeof endpoint !== 'string' ||
      endpoint.length < 20 ||
      typeof keys?.p256dh !== 'string' ||
      typeof keys?.auth !== 'string'
    ) {
      res.status(400).json({ message: 'Data langganan notifikasi tidak lengkap.' });
      return;
    }

    await simpanLanggananPush(req.user.id, {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    });

    res.status(201).json({ message: 'Notifikasi browser diaktifkan untuk perangkat ini.' });
  } catch (error) {
    next(error);
  }
};

export const unsubscribePush = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const endpoint = String(req.body?.endpoint || '');
    if (!endpoint) {
      res.status(400).json({ message: 'Endpoint langganan tidak diberikan.' });
      return;
    }
    await hapusLanggananPush(req.user.id, endpoint);
    res.status(200).json({ message: 'Notifikasi browser dimatikan untuk perangkat ini.' });
  } catch (error) {
    next(error);
  }
};
