import mongoose from 'mongoose';
import { createApp } from './app.js';
import { ensureFactors, ensureAdmin, seedDemo } from './bootstrap.js';

const { MONGO_URI = 'mongodb://localhost:27017/emissions', JWT_SECRET, PORT = 4000, NODE_ENV } = process.env;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}

await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
console.log(`Factors added: ${await ensureFactors()}`);
const admin = await ensureAdmin();
if (admin) console.log(`Created admin ${admin.email} (org: ${admin.org})`);
if (process.env.SEED_DEMO === 'true') {
  const org = process.env.ORG_NAME || 'My Organization';
  console.log(`Demo activities added: ${await seedDemo(org)}`);
}

const server = createApp().listen(PORT, () => console.log(`API listening on :${PORT} (${NODE_ENV || 'development'})`));
const shutdown = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
