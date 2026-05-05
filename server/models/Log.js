import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planDayId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  date: { type: Date, default: Date.now },
  sessionType: { type: String, enum: ['completed', 'missed', 'partial'] },
  missedReason: String,
  extractedData: {
    bench: {
      setsCompleted: Number,
      repsPerSet: [Number],
      loadLb: Number,
      rpeReported: Number,
      estimatedOneRM: Number,
      notes: String,
    },
    squat: {
      setsCompleted: Number,
      loadLb: Number,
      headacheGrade: Number,
      notes: String,
    },
    deadlift: {
      setsCompleted: Number,
      loadLb: Number,
      rpeReported: Number,
      notes: String,
    },
    accessoriesDone: [String],
    painFlags: {
      elbow: Boolean,
      shoulder: Boolean,
      lowerBack: Boolean,
      other: String,
    },
    generalFeeling: String,
    extraNotes: String,
  },
  chatHistory: [
    {
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  adaptationsTriggered: [String],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Log', logSchema);
