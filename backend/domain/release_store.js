'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function writeAtomicSync(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  try {
    const fd = fs.openSync(temp, 'wx', 0o644);
    try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, target);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function restoreJournal(journal) {
  for (const entry of journal.entries) {
    if (entry.before === null) fs.rmSync(entry.target, { force: true });
    else {
      const before = fs.readFileSync(entry.before);
      if (!fs.existsSync(entry.target) || !fs.readFileSync(entry.target).equals(before)) writeAtomicSync(entry.target, before);
    }
  }
}

function withReleaseLock(releasesDir, fn, isCommitted = () => false, deferUnlock = null) {
  fs.mkdirSync(releasesDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(releasesDir, 0o700);
  const lock = path.join(releasesDir, '.publisher.lock');
  for (let attempt = 0; ; attempt++) {
    try {
      const fd = fs.openSync(lock, 'wx', 0o600);
      try { fs.writeFileSync(fd, String(process.pid)); } finally { fs.closeSync(fd); }
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // A process killed during publishing leaves a journal and lock. Recover
      // only when its PID is demonstrably gone, never by a time-based guess.
      let alive = true;
      const pid = Number(fs.readFileSync(lock, 'utf8'));
      try { if (pid > 0) process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
      if (alive || attempt > 0) throw new Error('Another publisher is active; retry after it finishes');
      fs.unlinkSync(lock);
    }
  }
  try {
    const journalPath = path.join(releasesDir, 'pending.json');
    if (fs.existsSync(journalPath)) {
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      if (!isCommitted(journal.releaseId)) restoreJournal(journal);
      fs.unlinkSync(journalPath);
    }
    return fn();
  } finally {
    const unlock = () => fs.rmSync(lock, { force: true });
    if (deferUnlock) deferUnlock(unlock);
    else unlock();
  }
}

// Individual files switch atomically. A persistent undo journal restores the
// complete previous release on an error or the next run after a process crash.
// Readers can still see a brief transition between files; this is recoverable
// multi-file promotion, not a single atomic filesystem operation.
function publishBatch(releasesDir, releaseId, targets, afterPromotion = () => {}) {
  const snapshotDir = path.join(releasesDir, releaseId);
  fs.mkdirSync(snapshotDir, { recursive: true, mode: 0o700 });
  const entries = targets.map(([target, content], index) => {
    const before = fs.existsSync(target) ? path.join(snapshotDir, `${index}.before`) : null;
    if (before) fs.copyFileSync(target, before);
    const next = path.join(snapshotDir, `${index}.next`);
    fs.writeFileSync(next, content, { mode: 0o600 });
    return { target, before, next };
  });
  const journalPath = path.join(releasesDir, 'pending.json');
  writeAtomicSync(journalPath, JSON.stringify({ releaseId, entries }));
  try {
    for (const entry of entries) writeAtomicSync(entry.target, fs.readFileSync(entry.next));
    afterPromotion();
    writeAtomicSync(path.join(snapshotDir, 'snapshot.json'), JSON.stringify({ releaseId, entries }, null, 2));
    return {
      commit: () => fs.rmSync(journalPath, { force: true }),
      rollback: () => { restoreJournal({ entries }); fs.rmSync(journalPath, { force: true }); }
    };
  } catch (err) {
    try { restoreJournal({ entries }); fs.unlinkSync(journalPath); }
    catch (restoreError) { err.message += `; recovery pending: ${restoreError.message}`; }
    throw err;
  }
}

module.exports = { writeAtomicSync, withReleaseLock, publishBatch };
