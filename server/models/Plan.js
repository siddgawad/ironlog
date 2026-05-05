import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema({
  name: String,
  category: String,
  sets: Number,
  reps: Number,
  loadLb: Number,
  rpeTarget: Number,
  restSeconds: Number,
  notes: String,
});

const planSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plannedDate: Date,
  microcycle: Number,
  dayNumber: Number,
  dayType: String,
  status: {
    type: String,
    default: 'planned',
    enum: ['planned', 'completed', 'missed', 'adapted', 'held'],
  },
  adaptationNote: String,
  exercises: [exerciseSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Plan', planSchema);
