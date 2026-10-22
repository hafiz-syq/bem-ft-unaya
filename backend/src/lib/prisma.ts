import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import os from 'os';
import path from 'path';

// CA proyek Aiven bersifat publik (bukan kunci rahasia). Disimpan di dalam
// function supaya tidak bergantung pada file yang mungkin tidak ikut ter-trace
// oleh builder Vercel. Tanpa CA ini, Prisma menolak sertifikat server Aiven
// dengan pesan "self-signed certificate in certificate chain".
const AIVEN_PROJECT_CA = `-----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIUeP3M3/VEaoYhgCEFY50A+Qsx7QcwDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvNWNjMzdkMGItZjE4Yy00MDcwLTg1OTktZjExZTI5NDkw
NjUwIFByb2plY3QgQ0EwHhcNMjYxMDIwMTYyMzUxWhcNMzYxMDE3MTYyMzUxWjA6
MTgwNgYDVQQDDC81Y2MzN2QwYi1mMThjLTQwNzAtODU5OS1mMTFlMjk0OTA2NTAg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAL9U/Q3T
Rjm34oumXLq9KeP8yC81CaqwTNJ3TMDtUKNH8cbbUva5DoIvp4c+e39rOksUoT+k
J4tZ1oq3AhZpcS+U5NJNmW8V0GRS5TwgrequWltePLuAC05R+FhDkdK3/HGoqyug
nhMxa5U2Jv1fkTcLmnX5flpiMWt4W5KLxM4gU5yBFXj4IjdlGwN7DRTcc18wuDBb
EkrZ/p7wRd1wfy3S37lHhK7yTvK7f1twA9xQN6j68ctC5VD0VdqVr52zoDhBidz9
IP5QFcV6oGyJ7K2NJTBJ6NLCiki0b2kIKz2NiaROML8xOxsGHIp57gxU9FzKYNer
ugrqETWtkhXqZDQGYww0O/hmw/++FxAgBjEgjQe+T5cYa/XrCHzTBze9UplKXsUE
8slo3TcUgbgM44NMaTU2oWNy+hr+mcWWVq+kISBGAQxCzdkNkcu7+bpX94LnsXg8
egHT6QQnDIZUhr4yqpvJ6AoDJO6cDOPFvoTMXcpzKdVlHnjx8q2Nu0ye2wIDAQAB
o0IwQDAdBgNVHQ4EFgQUe2DII1RTAyQU9WxKlWjUdWymFfcwEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAIQnfKDnoD9v
qhRSLs3gIBTHdAp+9md5EulShpG7Q906q0DmlgLMgEEfsLSI4n8/9dOt6sQoGs7F
IiKE0jtptL3mPhlrlMTgB28WsImlTG2OJCfEpQaSnuOFYxow0OuTlSQUc/xgRV+E
Aa5GJUEZCCTio/PUTFC74WqYaO6XG5Z9Sr4RQdyEyquuztz+7ELdLD54zumCBlFT
A5/aOnoLVck2YBw5RZ7KGklMbX3DDFLaySfrfjWAfhwbDZs1lgMGYj1VMLa4RzXg
ZgzXufoORcRZgrE7s8BatRuuHNC5ewSoZJvgiLZTW+rDIjfzHuCVcOhzzoenxJZc
+byxsq61dUQh2+i4GFgGLjVz/E+x17b5Xu7LswkaqFrQF+i7ReMiCJbsIfVBNE6t
qcIlGbZWT1UIRY9Imfq00fxC/g9vDWX7g1v69XC8DH0Uvcx34RRgyIRQjNM/3/04
8p67GnPa6HxkXiRr98RqOwG9/9quJm/XC0YdDQIKMbGG5Zh3RiH/Mg==
-----END CERTIFICATE-----`;

const siapkanCaAiven = (): void => {
  const url = process.env.DATABASE_URL;

  if (!url || !url.includes('aivencloud.com')) {
    return;
  }

  try {
    const lokasiCa = path.join(os.tmpdir(), 'bem-ft-aiven-ca.pem');
    fs.writeFileSync(lokasiCa, AIVEN_PROJECT_CA, { mode: 0o600 });

    // Ganti nilai lama (bisa menunjuk file yang tidak ada di Vercel), lalu
    // pastikan Prisma memakai verifikasi ketat dengan CA yang baru ditulis.
    const alamat = new URL(url);
    alamat.searchParams.delete('ssl-mode');
    alamat.searchParams.set('sslaccept', 'strict');
    alamat.searchParams.set('sslrootcert', lokasiCa);
    process.env.DATABASE_URL = alamat.toString();
  } catch (error) {
    console.error('[prisma] Gagal menyiapkan CA Aiven:', error);
  }
};

siapkanCaAiven();

const prisma = new PrismaClient();
export default prisma;