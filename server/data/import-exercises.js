import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Exercise from '../models/Exercise.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const COMBINED_SOURCE_URL = 'https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises.json';
const TREE_URL = 'https://api.github.com/repos/wrkout/exercises.json/git/trees/master?recursive=1';
const RAW_ROOT = 'https://raw.githubusercontent.com/wrkout/exercises.json/master';
const CONCURRENCY = 20;

function encodePath(filePath) {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ironlog-importer',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchCombinedExercises() {
  const data = await fetchJson(COMBINED_SOURCE_URL);
  if (!Array.isArray(data)) {
    throw new Error('Combined exercise payload was not an array');
  }
  return data;
}

async function fetchExerciseFiles() {
  const tree = await fetchJson(TREE_URL);
  const exercisePaths = (tree.tree || [])
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter((filePath) => /^exercises\/[^/]+\/exercise\.json$/.test(filePath));

  const exercises = [];
  for (let i = 0; i < exercisePaths.length; i += CONCURRENCY) {
    const batch = exercisePaths.slice(i, i + CONCURRENCY);
    const batchExercises = await Promise.all(
      batch.map((filePath) => fetchJson(`${RAW_ROOT}/${encodePath(filePath)}`))
    );
    exercises.push(...batchExercises);
    console.log(`Fetched ${Math.min(i + CONCURRENCY, exercisePaths.length)}/${exercisePaths.length}`);
  }

  return exercises;
}

async function loadSourceExercises() {
  try {
    return await fetchCombinedExercises();
  } catch (err) {
    console.warn(`${err.message}. Falling back to per-exercise files.`);
    return fetchExerciseFiles();
  }
}

function mapEquipment(equipment) {
  const value = String(equipment || '').toLowerCase();
  if (value.includes('barbell') || value.includes('e-z curl')) return 'barbell';
  if (value.includes('dumbbell')) return 'dumbbell';
  if (value.includes('body') || value === 'none') return 'bodyweight';
  if (value.includes('cable')) return 'cable';
  if (value.includes('machine')) return 'machine';
  if (value.includes('kettlebell')) return 'kettlebell';
  if (value.includes('band')) return 'band';
  return 'other';
}

function mapCategory(category, mechanic) {
  const rawCategory = String(category || '').toLowerCase();
  const rawMechanic = String(mechanic || '').toLowerCase();
  if (rawCategory.includes('cardio')) return 'cardio';
  if (rawCategory.includes('stretch')) return 'flexibility';
  if (rawMechanic === 'isolation') return 'isolation';
  return 'compound';
}

function mapDifficulty(level) {
  const value = String(level || '').toLowerCase();
  if (value === 'beginner') return 'beginner';
  if (value === 'intermediate') return 'intermediate';
  return 'advanced';
}

function buildAliases(name) {
  const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
  const withoutEquipment = normalizedName
    .replace(/^(barbell|dumbbell|cable|machine|kettlebell|band)\s+/, '')
    .trim();

  return [...new Set([normalizedName, withoutEquipment].filter(Boolean).filter((alias) => alias !== name))];
}

function normalizeExercise(source) {
  const name = String(source.name || '').trim();
  if (!name) return null;

  const primaryMuscles = Array.isArray(source.primaryMuscles)
    ? source.primaryMuscles
    : [source.primaryMuscle].filter(Boolean);
  const secondaryMuscles = Array.isArray(source.secondaryMuscles)
    ? source.secondaryMuscles
    : [source.secondaryMuscles].filter(Boolean);

  const instructions = Array.isArray(source.instructions)
    ? source.instructions.join('\n')
    : String(source.instructions || '');

  return {
    name,
    aliases: buildAliases(name),
    primaryMuscle: primaryMuscles[0] || '',
    secondaryMuscles,
    equipment: mapEquipment(source.equipment),
    category: mapCategory(source.category, source.mechanic),
    instructions,
    difficulty: mapDifficulty(source.level || source.difficulty),
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in server/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const rawExercises = await loadSourceExercises();
  const exercises = rawExercises.map(normalizeExercise).filter(Boolean);
  const uniqueByName = new Map(exercises.map((exercise) => [exercise.name, exercise]));

  const operations = [...uniqueByName.values()].map((exercise) => ({
    updateOne: {
      filter: { name: exercise.name },
      update: { $set: exercise },
      upsert: true,
    },
  }));

  const result = operations.length ? await Exercise.bulkWrite(operations) : null;
  const total = await Exercise.countDocuments();

  console.log(`Imported ${uniqueByName.size} exercises.`);
  console.log(`MongoDB now has ${total} exercises.`);
  if (result) {
    console.log(`Upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
