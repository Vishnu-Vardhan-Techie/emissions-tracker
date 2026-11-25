import mongoose from 'mongoose';

export const ROLES = ['admin', 'analyst', 'viewer'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'viewer' },
    org: { type: String, required: true, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    org: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    factorKey: { type: String, required: true },
    category: { type: String, required: true, index: true },
    scope: { type: Number, enum: [1, 2, 3], required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    quantityNative: Number,
    kgCo2e: { type: Number, required: true },
    facility: { type: String, default: '' },
    description: { type: String, default: '' },
    source: { type: String, enum: ['manual', 'csv', 'invoice'], default: 'manual' },
    externalRef: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
activitySchema.index({ org: 1, date: 1 });

const factorSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    category: String,
    label: String,
    scope: Number,
    unit: String,
    factor: { type: Number, required: true },
    source: String,
    year: Number,
  },
  { timestamps: true }
);

const targetSchema = new mongoose.Schema(
  {
    org: { type: String, required: true, index: true },
    name: { type: String, required: true },
    baselineYear: { type: Number, required: true },
    targetYear: { type: Number, required: true },
    reductionPct: { type: Number, required: true, min: 0, max: 100 },
    baselineKgOverride: { type: Number, min: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
export const Activity = mongoose.model('Activity', activitySchema);
export const Factor = mongoose.model('Factor', factorSchema);
export const Target = mongoose.model('Target', targetSchema);
