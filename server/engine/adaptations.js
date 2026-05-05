import Plan from '../models/Plan.js';
import { BENCH_LOADS, SQUAT_LOADS, DEADLIFT_LOADS, RPE_CAPS, DAY_TEMPLATES } from '../data/program.js';

export async function runAdaptations(log, programState) {
  const adaptationDocs = [];
  const updatedFlags = JSON.parse(JSON.stringify(programState.flags));
  const updatedState = {};

  const extractedData = log.extractedData || {};
  const sessionType = log.sessionType;

  const planDay = await Plan.findById(log.planDayId);

  // RULE 1 — MISSED SESSION
  if (sessionType === 'missed') {
    const futurePlans = await Plan.find({
      status: 'planned',
      plannedDate: { $gt: new Date() },
    }).sort({ plannedDate: 1 });

    for (const plan of futurePlans) {
      const newDate = new Date(plan.plannedDate);
      newDate.setDate(newDate.getDate() + 1);
      await Plan.findByIdAndUpdate(plan._id, { plannedDate: newDate, updatedAt: new Date() });
    }

    adaptationDocs.push({
      logId: log._id,
      rule: 'RULE_1_MISSED',
      trigger: 'Session missed',
      action: `All future sessions shifted +1 day (${futurePlans.length} affected)`,
    });
  }

  // RULE 2 — FAILED BENCH SETS
  if (extractedData.bench && planDay) {
    const plannedBench = planDay.exercises.find(
      (e) => e.name === 'Competition Bench Press' && e.category === 'main'
    );
    if (
      plannedBench &&
      extractedData.bench.setsCompleted != null &&
      extractedData.bench.setsCompleted < plannedBench.sets
    ) {
      updatedFlags.benchFailedThisMicrocycle = true;
      adaptationDocs.push({
        logId: log._id,
        rule: 'RULE_2_FAILED_BENCH',
        trigger: `Completed ${extractedData.bench.setsCompleted} of ${plannedBench.sets} planned bench sets`,
        action: 'Bench failure flag set — loads will not advance at microcycle boundary',
      });
    }
  }

  // RULE 2 — MICROCYCLE BOUNDARY (day 8 completion)
  if (planDay && planDay.dayNumber === 8 && sessionType !== 'missed') {
    const currentMC = programState.currentMicrocycle;
    const nextMC = currentMC + 1;

    if (updatedFlags.benchFailedThisMicrocycle && nextMC <= 3) {
      const nextMCPlans = await Plan.find({
        microcycle: nextMC,
        status: { $in: ['planned', 'adapted'] },
      });

      for (const plan of nextMCPlans) {
        const template = DAY_TEMPLATES.find((t) => t.dayNumber === plan.dayNumber);
        if (!template) continue;

        const updatedExercises = plan.exercises.map((ex) => {
          const tmplEx = template.exercises.find((t) => t.name === ex.name);
          if (!tmplEx?.loadKey) return ex.toObject();

          let newLoad = ex.loadLb;
          const lk = tmplEx.loadKey;
          if (lk.startsWith('bench_')) {
            const variant = lk.slice(6);
            newLoad = BENCH_LOADS[currentMC]?.[variant] ?? ex.loadLb;
          } else if (lk === 'squat_comp') {
            newLoad = SQUAT_LOADS.comp[currentMC] ?? ex.loadLb;
          } else if (lk === 'squat_pause') {
            newLoad = SQUAT_LOADS.pause[currentMC] ?? ex.loadLb;
          } else if (lk === 'deadlift') {
            newLoad = DEADLIFT_LOADS[currentMC] ?? ex.loadLb;
          }

          return { ...ex.toObject(), loadLb: newLoad };
        });

        await Plan.findByIdAndUpdate(plan._id, {
          exercises: updatedExercises,
          adaptationNote: `MC${currentMC} loads maintained — bench sets failed`,
          status: 'adapted',
          updatedAt: new Date(),
        });
      }

      updatedFlags.benchFailedThisMicrocycle = false;
      adaptationDocs.push({
        logId: log._id,
        rule: 'RULE_2_MC_BOUNDARY',
        trigger: `Day 8 completed with bench failure flag active`,
        action: `MC${nextMC} loads not advanced — held at MC${currentMC} values`,
      });
    }
  }

  // RULE 3 — HEADACHE GRADE 1
  if (extractedData.squat?.headacheGrade === 1) {
    updatedFlags.consecutiveGrade1Headaches = (updatedFlags.consecutiveGrade1Headaches || 0) + 1;

    if (updatedFlags.consecutiveGrade1Headaches >= 2) {
      const newSquatMax = programState.squatTrainingMax - 10;
      updatedState.squatTrainingMax = newSquatMax;

      const futurePlans = await Plan.find({
        plannedDate: { $gt: new Date() },
        status: { $in: ['planned', 'adapted'] },
      });

      for (const plan of futurePlans) {
        const hasSquat = plan.exercises.some((e) =>
          e.name.toLowerCase().includes('squat')
        );
        if (!hasSquat) continue;

        const updatedExercises = plan.exercises.map((e) => {
          const obj = e.toObject();
          return e.name.toLowerCase().includes('squat')
            ? { ...obj, loadLb: Math.max(0, obj.loadLb - 10) }
            : obj;
        });

        await Plan.findByIdAndUpdate(plan._id, {
          exercises: updatedExercises,
          status: 'adapted',
          adaptationNote: 'Squat load reduced 10lb — 2 consecutive Grade 1 headaches',
          updatedAt: new Date(),
        });
      }

      updatedFlags.consecutiveGrade1Headaches = 0;
      adaptationDocs.push({
        logId: log._id,
        rule: 'RULE_3_HEADACHE_GRADE1_REPEATED',
        trigger: '2 consecutive Grade 1 headaches reported',
        action: `Squat loads reduced 10lb across all future sessions. New squat training max: ${newSquatMax}lb`,
      });
    } else {
      adaptationDocs.push({
        logId: log._id,
        rule: 'RULE_3_HEADACHE_GRADE1',
        trigger: 'Grade 1 headache reported',
        action: `Consecutive Grade 1 headache counter: ${updatedFlags.consecutiveGrade1Headaches}/2`,
      });
    }
  } else if (extractedData.squat?.headacheGrade === 0) {
    updatedFlags.consecutiveGrade1Headaches = 0;
  }

  // RULE 4 — HEADACHE GRADE 2
  if (extractedData.squat?.headacheGrade === 2) {
    const nextPlan = await Plan.findOne({
      plannedDate: { $gt: new Date() },
      status: { $in: ['planned', 'adapted'] },
    }).sort({ plannedDate: 1 });

    if (nextPlan) {
      const updatedExercises = nextPlan.exercises
        .filter((e) => !e.name.toLowerCase().includes('squat'))
        .map((e) => e.toObject());

      await Plan.findByIdAndUpdate(nextPlan._id, {
        exercises: updatedExercises,
        status: 'adapted',
        adaptationNote: 'Squats removed — Grade 2 headache',
        updatedAt: new Date(),
      });
    }

    updatedFlags.squatBlockedUntil = new Date(Date.now() + 72 * 60 * 60 * 1000);

    adaptationDocs.push({
      logId: log._id,
      rule: 'RULE_4_HEADACHE_GRADE2',
      trigger: 'Grade 2 headache reported',
      action: 'Squats removed from next session and blocked for 72 hours',
    });
  }

  // RULE 5 — HEADACHE GRADE 3
  if (extractedData.squat?.headacheGrade === 3) {
    updatedFlags.medicalStop = true;

    await Plan.updateMany(
      { plannedDate: { $gte: new Date() }, status: { $in: ['planned', 'adapted'] } },
      { status: 'held', updatedAt: new Date() }
    );

    adaptationDocs.push({
      logId: log._id,
      rule: 'RULE_5_HEADACHE_GRADE3',
      trigger: 'Grade 3 headache reported — possible medical emergency',
      action: 'MEDICAL STOP — training halted pending medical clearance',
    });
  }

  // RULE 6 — RPE OVER CAP
  if (extractedData.bench?.rpeReported != null && planDay) {
    const benchEx = planDay.exercises.find(
      (e) => e.name === 'Competition Bench Press' && e.category === 'main'
    );
    if (benchEx) {
      const rpeCapKey = `bench_${benchEx.sets}x${benchEx.reps}`;
      const rpeCap = RPE_CAPS[rpeCapKey] ?? RPE_CAPS['bench_6x6'];

      if (extractedData.bench.rpeReported > rpeCap) {
        updatedFlags.activeRPEWarning = true;
        adaptationDocs.push({
          logId: log._id,
          rule: 'RULE_6_RPE_OVER_CAP',
          trigger: `RPE ${extractedData.bench.rpeReported} reported, cap is ${rpeCap} for ${rpeCapKey}`,
          action: `RPE warning flag set — exceeded cap by ${(extractedData.bench.rpeReported - rpeCap).toFixed(1)}`,
        });
      } else {
        updatedFlags.activeRPEWarning = false;
      }
    }
  }

  // RULE 7 — ELBOW OR SHOULDER PAIN
  if (extractedData.painFlags?.elbow) {
    updatedFlags.elbowPainFlagged = true;
    adaptationDocs.push({
      logId: log._id,
      rule: 'RULE_7_PAIN_FLAG',
      trigger: 'Elbow pain reported',
      action: 'Elbow pain flag set — severity prompt will appear on next dashboard load',
    });
  }
  if (extractedData.painFlags?.shoulder) {
    updatedFlags.shoulderPainFlagged = true;
    adaptationDocs.push({
      logId: log._id,
      rule: 'RULE_7_PAIN_FLAG',
      trigger: 'Shoulder pain reported',
      action: 'Shoulder pain flag set — severity prompt will appear on next dashboard load',
    });
  }

  return { updatedFlags, updatedState, adaptationDocs };
}
