export const BENCH_TRAINING_MAX = 235;
export const SQUAT_TRAINING_MAX = 250;
export const DEADLIFT_TRAINING_MAX = 430;

export const BENCH_LOADS = {
  1: { '6x6': 165, '7x5': 175, '8x4': 190, '10x3': 200 },
  2: { '6x6': 175, '7x5': 185, '8x4': 200, '10x3': 210 },
  3: { '6x6': 180, '7x5': 190, '8x4': 205, '10x3': 215 },
};

export const SQUAT_LOADS = {
  comp: { 1: 185, 2: 195, 3: 200 },
  pause: { 1: 170, 2: 180, 3: 185 },
};

export const DEADLIFT_LOADS = { 1: 315, 2: 325, 3: 335 };

export const RPE_CAPS = {
  bench_6x6: 8,
  bench_7x5: 8,
  bench_8x4: 8.5,
  bench_10x3: 9,
  squat: 7,
  deadlift: 7,
};

export const REST_SECONDS = {
  bench_6x6: 180,
  bench_7x5: 210,
  bench_8x4: 210,
  bench_10x3: 270,
  squat: 120,
  deadlift: 210,
  accessory: 90,
};

export const DAY_TEMPLATES = [
  {
    dayNumber: 1,
    dayType: 'bench_squat',
    label: 'Bench 6×6 + Squat',
    exercises: [
      { name: 'Competition Bench Press', category: 'main', sets: 6, reps: 6, loadKey: 'bench_6x6', rpeTarget: 8, restKey: 'bench_6x6' },
      { name: 'Competition Squat', category: 'secondary', sets: 4, reps: 3, loadKey: 'squat_comp', rpeTarget: 7, restKey: 'squat' },
      { name: 'Face Pulls', category: 'accessory', sets: 3, reps: 20, loadLb: 0, notes: 'Light cable or band', restKey: 'accessory' },
      { name: 'Band Pull-Aparts', category: 'accessory', sets: 3, reps: 20, loadLb: 0, notes: 'Light band', restKey: 'accessory' },
    ],
  },
  {
    dayNumber: 2,
    dayType: 'deadlift',
    label: 'Deadlift',
    exercises: [
      { name: 'Competition Deadlift', category: 'main', sets: 4, reps: 3, loadKey: 'deadlift', rpeTarget: 7, restKey: 'deadlift' },
      { name: 'Chest-Supported Row', category: 'accessory', sets: 3, reps: 8, loadLb: 0, notes: 'Moderate weight', restKey: 'accessory' },
      { name: 'Back Extensions', category: 'accessory', sets: 3, reps: 10, loadLb: 0, notes: 'Bodyweight or light plate', restKey: 'accessory' },
    ],
  },
  {
    dayNumber: 3,
    dayType: 'bench_pause_squat',
    label: 'Bench 7×5 + Pause Squat',
    exercises: [
      { name: 'Competition Bench Press', category: 'main', sets: 7, reps: 5, loadKey: 'bench_7x5', rpeTarget: 8, restKey: 'bench_7x5' },
      { name: 'Pause Squat', category: 'secondary', sets: 3, reps: 3, loadKey: 'squat_pause', rpeTarget: 7, restKey: 'squat', notes: '2 second pause in the hole' },
      { name: 'Pull-Ups', category: 'accessory', sets: 3, reps: 6, loadLb: 0, notes: 'Bodyweight, stop 2 reps shy of failure', restKey: 'accessory' },
    ],
  },
  {
    dayNumber: 4,
    dayType: 'rest',
    label: 'Rest',
    exercises: [
      { name: 'Planks', category: 'accessory', sets: 3, reps: 1, loadLb: 0, notes: '45 seconds each, optional', restKey: 'accessory' },
    ],
  },
  {
    dayNumber: 5,
    dayType: 'bench_only',
    label: 'Bench 8×4',
    exercises: [
      { name: 'Competition Bench Press', category: 'main', sets: 8, reps: 4, loadKey: 'bench_8x4', rpeTarget: 8.5, restKey: 'bench_8x4' },
      { name: 'Face Pulls', category: 'accessory', sets: 3, reps: 20, loadLb: 0, notes: 'Light cable or band', restKey: 'accessory' },
      { name: 'Band Pull-Aparts', category: 'accessory', sets: 3, reps: 20, loadLb: 0, notes: 'Light band', restKey: 'accessory' },
    ],
  },
  {
    dayNumber: 6,
    dayType: 'rest',
    label: 'Rest',
    exercises: [],
  },
  {
    dayNumber: 7,
    dayType: 'bench_only',
    label: 'Bench 10×3',
    exercises: [
      { name: 'Competition Bench Press', category: 'main', sets: 10, reps: 3, loadKey: 'bench_10x3', rpeTarget: 9, restKey: 'bench_10x3', notes: 'Bench only today — no accessories' },
    ],
  },
  {
    dayNumber: 8,
    dayType: 'rest',
    label: 'Rest',
    exercises: [],
  },
];

export function calcWarmup(workingLb) {
  return [
    { label: 'Bar warm-up', loadLb: 45, reps: 15 },
    { label: '50%', loadLb: Math.round((workingLb * 0.5) / 5) * 5, reps: 5 },
    { label: '70%', loadLb: Math.round((workingLb * 0.7) / 5) * 5, reps: 3 },
    { label: '85%', loadLb: Math.round((workingLb * 0.85) / 5) * 5, reps: 1 },
  ];
}

export function epley1RM(loadLb, reps) {
  if (reps === 1) return loadLb;
  return Math.round(loadLb * (1 + reps / 30));
}
