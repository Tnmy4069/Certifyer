import fs from 'fs';
import path from 'path';
import { renderCertificatePng } from '../src/lib/generation/render';

async function main() {
  const bgPath = path.join(process.cwd(), 'public', 'bg.png'); // assuming there's a background or we can use a dummy buffer
  const background = Buffer.alloc(100 * 100 * 4); // dummy 100x100 white image or just a 1x1 png
  // To avoid sharp crashing on invalid background, let's create a valid 1x1 png buffer:
  const sharp = require('sharp');
  const validBg = await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();

  try {
    await renderCertificatePng({
      background: validBg,
      width: 800,
      height: 600,
      configuration: {
        fields: [
          { source: 'name', label: 'Name', x: 100, y: 100, width: 200, fontSize: 24, fontFamily: 'Inter', color: '#000000', align: 'center', fontWeight: 400 }
        ],
        qr: { enabled: true, x: 500, y: 500, size: 50 }
      },
      context: {
        candidate: { name: 'Test Candidate', email: 'test@example.com' },
        event: { name: 'Test Event', organizerName: 'Test Org', eventDate: new Date() },
        certificateNumber: 'CERT-123',
        baseUrl: 'http://localhost:3000'
      }
    });
    console.log("Success");
  } catch (err) {
    console.error("Failed:", err);
  }
}
main();
