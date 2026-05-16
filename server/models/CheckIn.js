import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, default: Date.now },
    weightKg: { type: Number, default: null },
    energyLevel: { type: Number, min: 1, max: 5, default: null },
    adherence: { type: Number, min: 1, max: 5, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

checkInSchema.index({ userId: 1, date: -1 });

export default mongoose.model('CheckIn', checkInSchema);
