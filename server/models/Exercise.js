import mongoose from 'mongoose';

const ExerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  aliases: [String],
  primaryMuscle: String,
  secondaryMuscles: [String],
  equipment: { type: String, enum: ['barbell', 'dumbbell', 'bodyweight', 'cable', 'machine', 'kettlebell', 'band', 'other'] },
  category: { type: String, enum: ['compound', 'isolation', 'cardio', 'flexibility'] },
  instructions: String,
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
});

ExerciseSchema.index({ name: 1 });
ExerciseSchema.index({ aliases: 1 });
ExerciseSchema.index({ primaryMuscle: 1, equipment: 1 });

export default mongoose.model('Exercise', ExerciseSchema);
