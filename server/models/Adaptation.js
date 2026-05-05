import mongoose from 'mongoose';

const adaptationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  logId: { type: mongoose.Schema.Types.ObjectId, ref: 'Log' },
  timestamp: { type: Date, default: Date.now },
  rule: String,
  trigger: String,
  action: String,
});

export default mongoose.model('Adaptation', adaptationSchema);
