import mongoose from 'mongoose';

const programStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  phase: { type: String, default: 'smolov_jr_bench' },
  programStartDate: Date,
  currentMicrocycle: { type: Number, default: 1 },
  currentDayIndex: { type: Number, default: 0 },
  benchTrainingMax: { type: Number, default: 235 },
  squatTrainingMax: { type: Number, default: 250 },
  deadliftTrainingMax: { type: Number, default: 430 },
  flags: {
    medicalStop: { type: Boolean, default: false },
    squatBlockedUntil: { type: Date, default: null },
    benchPaused: { type: Boolean, default: false },
    consecutiveGrade1Headaches: { type: Number, default: 0 },
    benchFailedThisMicrocycle: { type: Boolean, default: false },
    activeRPEWarning: { type: Boolean, default: false },
    elbowPainFlagged: { type: Boolean, default: false },
    shoulderPainFlagged: { type: Boolean, default: false },
  },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('ProgramState', programStateSchema);
