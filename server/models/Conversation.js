import mongoose from 'mongoose';

// One chat thread per user, append-only message history.
// Modelled after WhatsApp/iMessage: a single ongoing conversation,
// not multiple sessions.

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  // Optional metadata: link a message to the session it discussed
  planDayId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  // Marker for messages that triggered a side-effect (logged a session,
  // generated a plan, etc.) so the UI can render an inline event card
  eventType: {
    type: String,
    enum: [null, 'session_logged', 'plan_generated', 'medical_stop', 'adaptation_applied'],
    default: null,
  },
}, { _id: true });

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,  // enforce one thread per user
      index: true,
    },
    messages: [messageSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Conversation', conversationSchema);
