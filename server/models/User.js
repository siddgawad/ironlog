import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },

    // Profile (optional, set during onboarding)
    age: Number,
    sex: { type: String, enum: ['male', 'female', 'other', null], default: null },
    weightKg: Number,
    heightCm: Number,

    // Goals + preferences (drive AI program generation)
    primaryGoal: {
      type: String,
      enum: ['strength', 'hypertrophy', 'powerlifting', 'weight_loss', 'general_fitness', 'athletic_performance', null],
      default: null,
    },
    experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', null], default: null },
    daysPerWeek: { type: Number, min: 1, max: 7, default: null },
    equipment: {
      type: String,
      enum: ['full_gym', 'home_gym', 'dumbbells_only', 'bodyweight', null],
      default: null,
    },

    // Current strength benchmarks (lb) — optional, used for load prescriptions
    currentLifts: {
      bench: Number,
      squat: Number,
      deadlift: Number,
      overheadPress: Number,
    },

    // Targets (what they want to hit)
    targetLifts: {
      bench: Number,
      squat: Number,
      deadlift: Number,
      overheadPress: Number,
    },

    // Free-form context the AI uses
    notes: { type: String, default: '' },
    injuries: { type: String, default: '' },

    isPro: { type: Boolean, default: false },
    proExpiresAt: { type: Date, default: null },

    onboardingComplete: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

export default mongoose.model('User', userSchema);
